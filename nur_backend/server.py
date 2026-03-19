# -*- coding: utf-8 -*-
import io
import hashlib
import os
import re
import sys
import threading
import types
import warnings

import librosa
import numpy as np
import perth
import scipy.io.wavfile
import soundfile as sf
import torch
import torch.nn.functional as F
from chatterbox.models.t3 import t3 as chatterbox_t3_module
from chatterbox.models.t3.modules.cond_enc import T3Cond
from chatterbox.tts import ChatterboxTTS, Conditionals, drop_invalid_tokens
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from piper import PiperVoice
from pydantic import BaseModel

if os.environ.get("NUR_DISABLE_TYPEGUARD", "1") == "1":
    typeguard_stub = types.ModuleType("typeguard")

    def _typechecked(func=None, **kwargs):
        if func is None:
            return lambda inner: inner
        return func

    class TypeCheckError(Exception):
        pass

    typeguard_stub.typechecked = _typechecked
    typeguard_stub.TypeCheckError = TypeCheckError
    sys.modules.setdefault("typeguard", typeguard_stub)


def resolve_resource_path(filename: str) -> str:
    if os.path.isabs(filename):
        return filename
    if getattr(sys, "frozen", False):
        executable_dir = os.path.dirname(sys.executable)
        candidates = [
            os.path.join(executable_dir, filename),
            os.path.join(os.path.dirname(executable_dir), filename),
            os.path.join(os.getcwd(), filename),
        ]
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(base_dir, filename),
            os.path.join(os.path.dirname(base_dir), filename),
            os.path.join(os.getcwd(), filename),
        ]

    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate

    return candidates[0]


warnings.filterwarnings("ignore", category=FutureWarning)
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

gpu_lock = threading.Lock()
chatterbox_status_lock = threading.Lock()
chatterbox_prepare_lock = threading.Lock()


class AppState:
    active_session_id: str = None


state = AppState()

if torch.cuda.is_available():
    device = "cuda"
elif torch.backends.mps.is_available():
    device = "mps"
else:
    device = "cpu"

if device == "cuda":
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    if hasattr(torch, "set_float32_matmul_precision"):
        torch.set_float32_matmul_precision("high")

print(f"Initializing TTS Engine on: {device.upper()}")

chatterbox_model = None
chatterbox_status = {
    "state": "missing",
    "message": "Chatterbox is available as an optional download.",
}
CHATTERBOX_REFERENCE_CACHE_VERSION = "chatterbox_ref_v1"
CHATTERBOX_COND_CACHE_VERSION = "chatterbox_cond_v1"
CHATTERBOX_SAMPLE_RATE_FALLBACK = 24000
CHATTERBOX_SILENCE_THRESHOLD = 0.0042
CHATTERBOX_SILENCE_PAD_MS = 92
CHATTERBOX_STUDIO_SILENCE_THRESHOLD = 0.0031
CHATTERBOX_STUDIO_SILENCE_PAD_MS = 132
CHATTERBOX_MEMORY_COND_CACHE_LIMIT = 8
CHATTERBOX_APPLY_WATERMARK = False

piper_voice = None
loaded_piper_path = None
chatterbox_conditionals_cache: dict[str, Conditionals] = {}
chatterbox_conditionals_cache_keys: list[str] = []


class PassthroughWatermarker:
    def apply_watermark(self, wav, sample_rate=None, **kwargs):
        return wav

    def get_watermark(self, watermarked_wav, sample_rate=None, watermark_length=None, **kwargs):
        length = watermark_length if watermark_length is not None else 32
        return np.zeros(length, dtype=np.float32)


if getattr(perth, "PerthImplicitWatermarker", None) is None:
    perth.PerthImplicitWatermarker = PassthroughWatermarker


def _silent_tqdm(iterable, *args, **kwargs):
    return iterable


chatterbox_t3_module.tqdm = _silent_tqdm


def is_request_cancelled(session_id: str) -> bool:
    return session_id != state.active_session_id


def set_chatterbox_status(state_name: str, message: str):
    with chatterbox_status_lock:
        chatterbox_status["state"] = state_name
        chatterbox_status["message"] = message


def get_chatterbox_status():
    with chatterbox_status_lock:
        return {
            "state": chatterbox_status["state"],
            "message": chatterbox_status["message"],
            "device": device,
            "ready": chatterbox_status["state"] == "ready",
        }


def trim_silence_int16(samples, sample_rate, threshold=500, pad_ms=30):
    if samples is None or len(samples) == 0:
        return samples
    abs_samples = np.abs(samples)
    non_silent = np.where(abs_samples > threshold)[0]
    if non_silent.size == 0:
        return samples
    start = int(non_silent[0])
    end = int(non_silent[-1]) + 1
    pad = int(sample_rate * (pad_ms / 1000.0))
    start = max(0, start - pad)
    end = min(len(samples), end + pad)
    return samples[start:end]


def trim_silence_float(samples, sample_rate, threshold=0.01, pad_ms=30):
    if samples is None or len(samples) == 0:
        return samples
    abs_samples = np.abs(samples)
    non_silent = np.where(abs_samples > threshold)[0]
    if non_silent.size == 0:
        return samples
    start = int(non_silent[0])
    end = int(non_silent[-1]) + 1
    pad = int(sample_rate * (pad_ms / 1000.0))
    start = max(0, start - pad)
    end = min(len(samples), end + pad)
    return samples[start:end]


def get_user_cache_dir() -> str:
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base, "Nur", "cache")
    if sys.platform == "darwin":
        return os.path.join(os.path.expanduser("~/Library/Caches"), "Nur")
    return os.path.join(
        os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")), "nur"
    )


def get_chatterbox_reference_cache_dir() -> str:
    cache_dir = os.path.join(get_user_cache_dir(), "chatterbox_refs")
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def get_chatterbox_conditionals_cache_dir() -> str:
    cache_dir = os.path.join(get_user_cache_dir(), "chatterbox_conds")
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def build_chatterbox_reference_cache_path(speaker_path: str) -> str:
    stats = os.stat(speaker_path)
    payload = (
        f"{CHATTERBOX_REFERENCE_CACHE_VERSION}|"
        f"{os.path.abspath(speaker_path)}|"
        f"{stats.st_mtime_ns}|"
        f"{stats.st_size}"
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return os.path.join(get_chatterbox_reference_cache_dir(), f"{digest}.wav")


def build_chatterbox_conditionals_cache_path(speaker_path: str) -> str:
    stats = os.stat(speaker_path)
    payload = (
        f"{CHATTERBOX_COND_CACHE_VERSION}|"
        f"{os.path.abspath(speaker_path)}|"
        f"{stats.st_mtime_ns}|"
        f"{stats.st_size}"
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return os.path.join(get_chatterbox_conditionals_cache_dir(), f"{digest}.pt")


def ensure_mono_float32(samples):
    wav_np = np.asarray(samples, dtype=np.float32)
    if wav_np.ndim == 0:
        return wav_np.reshape(1)
    if wav_np.ndim == 1:
        return wav_np
    if wav_np.ndim == 2:
        if 1 in wav_np.shape:
            return wav_np.reshape(-1)
        if wav_np.shape[0] <= 4 and wav_np.shape[1] > wav_np.shape[0]:
            return np.mean(wav_np, axis=0, dtype=np.float32)
        return np.mean(wav_np, axis=1, dtype=np.float32)
    return wav_np.reshape(-1)


def apply_edge_fade(samples, sample_rate, fade_ms=12):
    if samples is None or len(samples) == 0:
        return samples
    fade_samples = min(len(samples) // 2, int(sample_rate * (fade_ms / 1000.0)))
    if fade_samples <= 1:
        return samples
    fade_in = np.linspace(0.0, 1.0, fade_samples, dtype=np.float32)
    fade_out = np.linspace(1.0, 0.0, fade_samples, dtype=np.float32)
    samples = np.asarray(samples, dtype=np.float32).copy()
    samples[:fade_samples] *= fade_in
    samples[-fade_samples:] *= fade_out
    return samples


def normalize_chatterbox_text(text: str) -> str:
    if not text or not text.strip():
        return "You need to add some text for me to talk."

    normalized = (
        text.replace("\u00a0", " ")
        .replace("…", "...")
        .replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
        .replace("—", " - ")
        .replace("–", " - ")
    )
    normalized = re.sub(r"\s+", " ", normalized).strip()
    normalized = re.sub(r"\s+([,.;:!?])", r"\1", normalized)
    normalized = re.sub(r"([(\[{])\s+", r"\1", normalized)
    normalized = re.sub(r"\s+([)\]}])", r"\1", normalized)

    if normalized and normalized[0].islower():
        normalized = normalized[0].upper() + normalized[1:]

    if not re.search(r'[.!?,;:\-]["\')\]}]*$', normalized):
        normalized += "."

    return normalized


def clone_optional_tensor(value):
    return value.clone() if torch.is_tensor(value) else value


def clone_conditionals_for_generation(conds: Conditionals, exaggeration: float) -> Conditionals:
    base_t3 = conds.t3
    runtime_t3 = T3Cond(
        speaker_emb=clone_optional_tensor(base_t3.speaker_emb),
        clap_emb=clone_optional_tensor(base_t3.clap_emb),
        cond_prompt_speech_tokens=clone_optional_tensor(base_t3.cond_prompt_speech_tokens),
        cond_prompt_speech_emb=clone_optional_tensor(base_t3.cond_prompt_speech_emb),
        emotion_adv=exaggeration * torch.ones(1, 1, 1),
    ).to(device=device)
    runtime_gen = {
        key: clone_optional_tensor(value) if torch.is_tensor(value) else value
        for key, value in conds.gen.items()
    }
    return Conditionals(runtime_t3, runtime_gen).to(device)


def preprocess_reference_audio(speaker_path: str) -> str:
    cache_path = build_chatterbox_reference_cache_path(speaker_path)
    if os.path.exists(cache_path):
        return cache_path

    try:
        try:
            samples, sample_rate = sf.read(speaker_path, always_2d=False)
        except Exception:
            samples, sample_rate = librosa.load(speaker_path, sr=None, mono=False)
        samples = ensure_mono_float32(samples)
        if samples.size == 0:
            return speaker_path

        samples = samples - np.mean(samples, dtype=np.float32)
        samples = trim_silence_float(samples, sample_rate, threshold=0.0032, pad_ms=120)

        peak = float(np.max(np.abs(samples))) if samples.size > 0 else 0.0
        if peak > 0.0001:
            samples = samples / peak * 0.94

        samples = apply_edge_fade(samples, sample_rate, fade_ms=18)
        sf.write(cache_path, samples, sample_rate, subtype="PCM_16")
        return cache_path
    except Exception as error:
        print(f"Reference audio preprocessing skipped: {error}")
        return speaker_path


def encode_wav_bytes(samples, sample_rate: int) -> bytes:
    out_buf = io.BytesIO()
    scipy.io.wavfile.write(out_buf, sample_rate, samples)
    audio_data = out_buf.getvalue()
    out_buf.close()
    return audio_data


def finalize_chatterbox_audio(
    wav_out,
    sample_rate: int,
    quality_mode: str = "studio",
) -> bytes:
    wav_np = ensure_mono_float32(wav_out)
    if wav_np.size == 0:
        return encode_wav_bytes(np.zeros(1, dtype=np.int16), sample_rate)

    wav_np = wav_np - np.mean(wav_np, dtype=np.float32)

    peak = float(np.max(np.abs(wav_np))) if wav_np.size > 0 else 0.0
    if peak > 0.99:
        wav_np = wav_np / peak * 0.97
    else:
        wav_np = np.clip(wav_np, -0.99, 0.99)

    threshold = (
        CHATTERBOX_STUDIO_SILENCE_THRESHOLD
        if quality_mode == "studio"
        else CHATTERBOX_SILENCE_THRESHOLD
    )
    pad_ms = (
        CHATTERBOX_STUDIO_SILENCE_PAD_MS
        if quality_mode == "studio"
        else CHATTERBOX_SILENCE_PAD_MS
    )
    wav_np = trim_silence_float(wav_np, sample_rate, threshold=threshold, pad_ms=pad_ms)
    wav_np = apply_edge_fade(wav_np, sample_rate, fade_ms=10)
    wav_int16 = np.round(wav_np * 32767).astype(np.int16)
    return encode_wav_bytes(wav_int16, sample_rate)


def set_cached_conditionals(cache_key: str, conds: Conditionals):
    if cache_key not in chatterbox_conditionals_cache:
        chatterbox_conditionals_cache_keys.append(cache_key)
    chatterbox_conditionals_cache[cache_key] = conds
    if len(chatterbox_conditionals_cache_keys) > CHATTERBOX_MEMORY_COND_CACHE_LIMIT:
        oldest = chatterbox_conditionals_cache_keys.pop(0)
        chatterbox_conditionals_cache.pop(oldest, None)


def load_cached_conditionals_from_disk(speaker_path: str):
    cache_path = build_chatterbox_conditionals_cache_path(speaker_path)
    if not os.path.exists(cache_path):
        return None
    try:
        return Conditionals.load(cache_path, map_location="cpu").to(device)
    except Exception as error:
        print(f"Chatterbox conditioning cache load failed: {error}")
        try:
            os.remove(cache_path)
        except OSError:
            pass
        return None


def save_cached_conditionals_to_disk(speaker_path: str, conds: Conditionals) -> None:
    cache_path = build_chatterbox_conditionals_cache_path(speaker_path)
    try:
        conds.save(cache_path)
    except Exception as error:
        print(f"Chatterbox conditioning cache save failed: {error}")


def is_default_voice_request(speaker_wav: str) -> bool:
    speaker_name = os.path.basename((speaker_wav or "").strip())
    return speaker_name in {"", "default_speaker.wav"}


def resolve_conditionals_for_request(model: ChatterboxTTS, speaker_wav: str):
    if is_default_voice_request(speaker_wav) and getattr(model, "conds", None) is not None:
        return model.conds

    speaker_path = speaker_wav
    if is_default_voice_request(speaker_wav):
        speaker_path = resolve_resource_path("default_speaker.wav")
    else:
        speaker_path = resolve_resource_path(speaker_wav)

    if not os.path.exists(speaker_path):
        raise HTTPException(status_code=500, detail=f"Missing speaker wav: {speaker_path}")

    prepared_path = preprocess_reference_audio(speaker_path)
    if not os.path.exists(prepared_path):
        raise HTTPException(status_code=500, detail=f"Missing speaker wav: {prepared_path}")

    cached = chatterbox_conditionals_cache.get(prepared_path)
    if cached is not None:
        return cached

    disk_cached = load_cached_conditionals_from_disk(prepared_path)
    if disk_cached is not None:
        set_cached_conditionals(prepared_path, disk_cached)
        return disk_cached

    previous_conds = getattr(model, "conds", None)
    try:
        model.prepare_conditionals(prepared_path)
        conds = getattr(model, "conds", None)
        if conds is None:
            raise RuntimeError("Chatterbox conditioning failed")
        save_cached_conditionals_to_disk(prepared_path, conds)
        set_cached_conditionals(prepared_path, conds)
        return conds
    finally:
        model.conds = previous_conds


def warmup_chatterbox(model):
    print("Warming up Chatterbox...")
    with torch.inference_mode():
        model.generate("Ready.", exaggeration=0.2, cfg_weight=0.5, temperature=0.8)
    if device == "cuda":
        torch.cuda.synchronize()


def prepare_chatterbox_model():
    global chatterbox_model

    try:
        print("Loading Chatterbox...")
        with gpu_lock:
            model = ChatterboxTTS.from_pretrained(device=device)
            try:
                warmup_chatterbox(model)
            except RuntimeError as error:
                print(f"Chatterbox warmup skipped: {error}")
        chatterbox_model = model
        default_speaker = resolve_resource_path("default_speaker.wav")
        if os.path.exists(default_speaker):
            previous_conds = getattr(chatterbox_model, "conds", None)
            try:
                prepared_default_speaker = preprocess_reference_audio(default_speaker)
                generation_profile = get_chatterbox_generation_profile("studio")
                cached = load_cached_conditionals_from_disk(prepared_default_speaker)
                if cached is None and hasattr(chatterbox_model, "prepare_conditionals"):
                    chatterbox_model.prepare_conditionals(
                        prepared_default_speaker,
                        exaggeration=generation_profile["exaggeration"],
                    )
                    cached = getattr(chatterbox_model, "conds", None)
                    if cached is not None:
                        save_cached_conditionals_to_disk(
                            prepared_default_speaker,
                            cached,
                        )
                if cached is not None:
                    set_cached_conditionals(prepared_default_speaker, cached)
            except Exception as error:
                print(f"Chatterbox speaker cache warmup skipped: {error}")
            finally:
                chatterbox_model.conds = previous_conds
        print("Chatterbox ready")
        set_chatterbox_status("ready", f"Chatterbox is ready on {device.upper()}.")
    except Exception as error:
        chatterbox_model = None
        message = f"Chatterbox preparation failed: {error}"
        print(message)
        set_chatterbox_status("error", message)


def start_chatterbox_prepare():
    with chatterbox_prepare_lock:
        current = get_chatterbox_status()
        if current["state"] in {"ready", "preparing"}:
            return current

        set_chatterbox_status(
            "preparing", "Preparing Chatterbox. This can take several minutes."
        )
        thread = threading.Thread(target=prepare_chatterbox_model, daemon=True)
        thread.start()
    return get_chatterbox_status()


def get_chatterbox_generation_profile(quality_mode: str):
    if quality_mode == "studio":
        return {
            "exaggeration": 0.45,
            "cfg_weight": 0.35,
            "temperature": 0.72,
            "top_p": 0.95,
            "min_p": 0.05,
            "repetition_penalty": 1.12,
        }

    return {
        "exaggeration": 0.5,
        "cfg_weight": 0.5,
        "temperature": 0.8,
        "top_p": 1.0,
        "min_p": 0.05,
        "repetition_penalty": 1.2,
    }


def synthesize_chatterbox_waveform(
    model: ChatterboxTTS,
    text: str,
    conds: Conditionals,
    generation_profile: dict,
    session_id: str,
):
    runtime_conds = clone_conditionals_for_generation(
        conds, generation_profile["exaggeration"]
    )
    normalized_text = normalize_chatterbox_text(text)
    text_tokens = model.tokenizer.text_to_tokens(normalized_text).to(model.device)

    if generation_profile["cfg_weight"] > 0.0:
        text_tokens = torch.cat([text_tokens, text_tokens], dim=0)

    sot = model.t3.hp.start_text_token
    eot = model.t3.hp.stop_text_token
    text_tokens = F.pad(text_tokens, (1, 0), value=sot)
    text_tokens = F.pad(text_tokens, (0, 1), value=eot)

    with torch.inference_mode():
        speech_tokens = model.t3.inference(
            t3_cond=runtime_conds.t3,
            text_tokens=text_tokens,
            max_new_tokens=1000,
            temperature=generation_profile["temperature"],
            cfg_weight=generation_profile["cfg_weight"],
            repetition_penalty=generation_profile["repetition_penalty"],
            min_p=generation_profile["min_p"],
            top_p=generation_profile["top_p"],
        )
        speech_tokens = speech_tokens[0]
        speech_tokens = drop_invalid_tokens(speech_tokens)
        speech_tokens = speech_tokens[speech_tokens < 6561]
        speech_tokens = speech_tokens.to(model.device)

        if is_request_cancelled(session_id):
            raise HTTPException(status_code=499, detail="Request cancelled")

        wav, _ = model.s3gen.inference(
            speech_tokens=speech_tokens,
            ref_dict=runtime_conds.gen,
        )

    wav_np = ensure_mono_float32(wav.squeeze(0).detach().cpu().numpy())
    if CHATTERBOX_APPLY_WATERMARK:
        wav_np = model.watermarker.apply_watermark(wav_np, sample_rate=model.sr)
    return wav_np


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Sample-Rate", "X-Audio-Encoding", "X-Audio-Channels"],
)


class SessionControl(BaseModel):
    session_id: str


class SpeakRequest(BaseModel):
    text: str
    session_id: str
    engine: str = "piper"
    speaker_wav: str = ""
    piper_model_path: str = ""
    language: str = "en"
    speed: float = 1.0
    quality_mode: str = "studio"


class PrepareModelRequest(BaseModel):
    engine: str


def ensure_piper_voice(model_path: str) -> PiperVoice:
    global piper_voice, loaded_piper_path

    if not model_path or not os.path.exists(model_path):
        print(f"Piper Error: Path not found: {model_path}")
        raise HTTPException(status_code=400, detail="Piper model path invalid")

    if loaded_piper_path != model_path:
        print(f"Loading Piper Model: {model_path}")
        try:
            piper_voice = PiperVoice.load(model_path)
            loaded_piper_path = model_path
        except Exception as error:
            print(f"Failed to load Piper: {error}")
            raise HTTPException(status_code=500, detail=f"Failed to load Piper: {error}")

    if piper_voice is None:
        raise HTTPException(status_code=500, detail="Piper voice failed to initialize")

    return piper_voice


def iter_piper_audio_bytes(text: str, session_id: str):
    if piper_voice is None:
        raise RuntimeError("Piper voice is not loaded")

    stream = piper_voice.synthesize(text, None)
    emitted_audio = False

    for chunk in stream:
        if is_request_cancelled(session_id):
            print("Cancelling Piper generation for stale session")
            break

        if hasattr(chunk, "audio_int16_bytes"):
            chunk_bytes = chunk.audio_int16_bytes
        elif hasattr(chunk, "bytes"):
            chunk_bytes = chunk.bytes
        else:
            print(f"Unknown chunk structure: {dir(chunk)}")
            raise RuntimeError("Cannot extract bytes from AudioChunk")

        if not chunk_bytes:
            continue

        emitted_audio = True
        yield chunk_bytes

    if not emitted_audio and not is_request_cancelled(session_id):
        raise RuntimeError("Piper generation yielded no audio data")


def collect_piper_audio_bytes(text: str, session_id: str) -> bytes:
    raw_audio = b""
    for chunk_bytes in iter_piper_audio_bytes(text, session_id):
        raw_audio += chunk_bytes

    if not raw_audio and is_request_cancelled(session_id):
        raise HTTPException(status_code=499, detail="Request cancelled")

    if len(raw_audio) == 0:
        raise RuntimeError("Piper generation yielded no audio data")

    return raw_audio


@app.post("/session")
def set_session(control: SessionControl):
    state.active_session_id = control.session_id
    print(f"Session updated to: {state.active_session_id}")
    return {"status": "ok", "active_session": state.active_session_id}


@app.get("/health")
def health_check():
    chatterbox = get_chatterbox_status()
    return {
        "status": "ok",
        "tts_ready": True,
        "device": device,
        "chatterbox": chatterbox,
        "xtts": chatterbox,
    }


@app.get("/models/status")
def models_status():
    chatterbox = get_chatterbox_status()
    return {
        "status": "ok",
        "device": device,
        "chatterbox": chatterbox,
        "xtts": chatterbox,
    }


@app.post("/models/prepare")
def prepare_model(request: PrepareModelRequest):
    if request.engine not in {"chatterbox", "xtts"}:
        raise HTTPException(status_code=400, detail="Unsupported model preparation request")
    chatterbox = start_chatterbox_prepare()
    return {"status": "ok", "chatterbox": chatterbox, "xtts": chatterbox}


@app.post("/tts/stream")
def stream_piper_speech(request: SpeakRequest):
    if is_request_cancelled(request.session_id):
        print("Dropping orphaned stream request")
        raise HTTPException(status_code=499, detail="Request cancelled")

    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    if request.engine != "piper":
        raise HTTPException(status_code=400, detail="Streaming is only supported for Piper")

    voice = ensure_piper_voice(request.piper_model_path)

    def pcm_stream():
        try:
            for chunk_bytes in iter_piper_audio_bytes(request.text, request.session_id):
                yield chunk_bytes
        except Exception as error:
            print(f"PIPER streaming error: {error}")
            raise

    return StreamingResponse(
        pcm_stream(),
        media_type="application/octet-stream",
        headers={
            "X-Sample-Rate": str(voice.config.sample_rate),
            "X-Audio-Encoding": "pcm_s16le",
            "X-Audio-Channels": "1",
        },
    )


@app.post("/tts")
def generate_speech(request: SpeakRequest):
    global chatterbox_model

    if is_request_cancelled(request.session_id):
        print("Dropping orphaned request")
        raise HTTPException(status_code=499, detail="Request cancelled")

    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_data = None

        if request.engine == "piper":
            voice = ensure_piper_voice(request.piper_model_path)
            raw_audio = collect_piper_audio_bytes(request.text, request.session_id)
            audio_np = np.frombuffer(raw_audio, dtype=np.int16)
            audio_np = trim_silence_int16(audio_np, voice.config.sample_rate)
            audio_data = encode_wav_bytes(audio_np, voice.config.sample_rate)

        elif request.engine in {"chatterbox", "xtts"}:
            current_status = get_chatterbox_status()
            if current_status["state"] != "ready" or chatterbox_model is None:
                raise HTTPException(status_code=409, detail="Chatterbox is not ready yet")

            with gpu_lock:
                if request.session_id != state.active_session_id:
                    raise HTTPException(status_code=499, detail="Request cancelled")

                resolved_conds = resolve_conditionals_for_request(
                    chatterbox_model, request.speaker_wav
                )
                generation_profile = get_chatterbox_generation_profile(request.quality_mode)
                wav_np = synthesize_chatterbox_waveform(
                    chatterbox_model,
                    request.text,
                    resolved_conds,
                    generation_profile,
                    request.session_id,
                )
                if device == "cuda":
                    torch.cuda.synchronize()
                sample_rate = int(
                    getattr(chatterbox_model, "sr", CHATTERBOX_SAMPLE_RATE_FALLBACK)
                )
                audio_data = finalize_chatterbox_audio(
                    wav_np, sample_rate, request.quality_mode
                )

        else:
            raise HTTPException(status_code=400, detail="Unknown engine")

        return Response(content=audio_data, media_type="audio/wav")

    except HTTPException as error:
        raise error
    except Exception as error:
        print(f"Error: {error}")
        raise HTTPException(status_code=500, detail=str(error))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
