# -*- coding: utf-8 -*-
import io
import hashlib
import os
import sys
import threading
import types
import warnings
from functools import lru_cache

import numpy as np
import scipy.io.wavfile
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from piper import PiperVoice
from pydantic import BaseModel
from TTS.api import TTS

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
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, filename)


warnings.filterwarnings("ignore", category=FutureWarning)
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"

gpu_lock = threading.Lock()
xtts_status_lock = threading.Lock()
xtts_prepare_lock = threading.Lock()


class AppState:
    active_session_id: str = None


state = AppState()

if torch.cuda.is_available():
    device = "cuda"
elif torch.backends.mps.is_available():
    device = "mps"
else:
    device = "cpu"

print(f"Initializing TTS Engine on: {device.upper()}")

xtts_model = None
xtts_status = {
    "state": "missing",
    "message": "XTTS is available as an optional download.",
}
XTTS_SAMPLE_RATE = 24000
XTTS_LATENT_CACHE_VERSION = "xtts_v2"
XTTS_SILENCE_THRESHOLD = 350
XTTS_SILENCE_PAD_MS = 55
XTTS_STUDIO_SILENCE_THRESHOLD = 220
XTTS_STUDIO_SILENCE_PAD_MS = 95
XTTS_STREAM_CHUNK_SIZE = 12
XTTS_STREAM_OVERLAP_SAMPLES = 1024

piper_voice = None
loaded_piper_path = None


def is_request_cancelled(session_id: str) -> bool:
    return session_id != state.active_session_id


def set_xtts_status(state_name: str, message: str):
    with xtts_status_lock:
        xtts_status["state"] = state_name
        xtts_status["message"] = message


def get_xtts_status():
    with xtts_status_lock:
        return {
            "state": xtts_status["state"],
            "message": xtts_status["message"],
            "device": device,
            "ready": xtts_status["state"] == "ready",
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


def get_user_cache_dir() -> str:
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
        return os.path.join(base, "Nur", "cache")
    if sys.platform == "darwin":
        return os.path.join(os.path.expanduser("~/Library/Caches"), "Nur")
    return os.path.join(
        os.environ.get("XDG_CACHE_HOME", os.path.expanduser("~/.cache")), "nur"
    )


def get_xtts_latent_cache_dir() -> str:
    cache_dir = os.path.join(get_user_cache_dir(), "xtts_latents")
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def build_xtts_latent_cache_path(speaker_path: str) -> str:
    stats = os.stat(speaker_path)
    payload = (
        f"{XTTS_LATENT_CACHE_VERSION}|"
        f"{os.path.abspath(speaker_path)}|"
        f"{stats.st_mtime_ns}|"
        f"{stats.st_size}"
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    return os.path.join(get_xtts_latent_cache_dir(), f"{digest}.pt")


def move_latents_to_cpu(latents):
    if torch.is_tensor(latents):
        return latents.detach().cpu()
    if isinstance(latents, tuple):
        return tuple(move_latents_to_cpu(item) for item in latents)
    if isinstance(latents, list):
        return [move_latents_to_cpu(item) for item in latents]
    return latents


def move_latents_to_device(latents):
    if torch.is_tensor(latents):
        return latents.to(device)
    if isinstance(latents, tuple):
        return tuple(move_latents_to_device(item) for item in latents)
    if isinstance(latents, list):
        return [move_latents_to_device(item) for item in latents]
    return latents


def load_cached_speaker_embedding(speaker_path: str):
    cache_path = build_xtts_latent_cache_path(speaker_path)
    if not os.path.exists(cache_path):
        return None

    try:
        cached = torch.load(cache_path, map_location="cpu")
        return move_latents_to_device(cached)
    except Exception as error:
        print(f"Speaker embed disk cache load failed: {error}")
        try:
            os.remove(cache_path)
        except OSError:
            pass
        return None


def save_cached_speaker_embedding(speaker_path: str, latents) -> None:
    cache_path = build_xtts_latent_cache_path(speaker_path)
    try:
        torch.save(move_latents_to_cpu(latents), cache_path)
    except Exception as error:
        print(f"Speaker embed disk cache save failed: {error}")


def warmup_xtts(model):
    print("Warming up XTTS...")
    warmup_speaker = resolve_resource_path("default_speaker.wav")
    if not os.path.exists(warmup_speaker):
        print("Warmup skipped: 'default_speaker.wav' not found in backend folder.")
        return

    with torch.inference_mode():
        model.tts("Ready.", language="en", speaker_wav=warmup_speaker, speed=1.0)
    if device == "cuda":
        torch.cuda.synchronize()


def encode_wav_bytes(samples, sample_rate: int) -> bytes:
    out_buf = io.BytesIO()
    scipy.io.wavfile.write(out_buf, sample_rate, samples)
    audio_data = out_buf.getvalue()
    out_buf.close()
    return audio_data


def finalize_xtts_audio(wav_out, quality_mode: str = "balanced") -> bytes:
    wav_np = np.asarray(wav_out, dtype=np.float32)
    wav_np = np.clip(wav_np, -1, 1)
    wav_int16 = (wav_np * 32767).astype(np.int16)
    threshold = XTTS_STUDIO_SILENCE_THRESHOLD if quality_mode == "studio" else XTTS_SILENCE_THRESHOLD
    pad_ms = XTTS_STUDIO_SILENCE_PAD_MS if quality_mode == "studio" else XTTS_SILENCE_PAD_MS
    wav_int16 = trim_silence_int16(
        wav_int16,
        XTTS_SAMPLE_RATE,
        threshold=threshold,
        pad_ms=pad_ms,
    )
    return encode_wav_bytes(wav_int16, XTTS_SAMPLE_RATE)


def get_xtts_runtime_model():
    if xtts_model is None:
        return None

    synthesizer = getattr(xtts_model, "synthesizer", None)
    runtime_model = getattr(synthesizer, "tts_model", None)
    if runtime_model is not None:
        return runtime_model

    return xtts_model


def prepare_xtts_model():
    global xtts_model

    try:
        print("Loading XTTS Model...")
        with gpu_lock:
            model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
            try:
                warmup_xtts(model)
            except RuntimeError as error:
                print(f"XTTS warmup skipped: {error}")
        xtts_model = model
        get_speaker_embedding.cache_clear()
        default_speaker = resolve_resource_path("default_speaker.wav")
        if os.path.exists(default_speaker):
            try:
                get_speaker_embedding(default_speaker)
            except Exception as error:
                print(f"XTTS speaker cache warmup skipped: {error}")
        print("XTTS Ready")
        set_xtts_status("ready", f"XTTS is ready on {device.upper()}.")
    except Exception as error:
        xtts_model = None
        get_speaker_embedding.cache_clear()
        message = f"XTTS preparation failed: {error}"
        print(message)
        set_xtts_status("error", message)


def start_xtts_prepare():
    with xtts_prepare_lock:
        current = get_xtts_status()
        if current["state"] in {"ready", "preparing"}:
            return current

        set_xtts_status("preparing", "Preparing XTTS. This can take several minutes.")
        thread = threading.Thread(target=prepare_xtts_model, daemon=True)
        thread.start()
    return get_xtts_status()


@lru_cache(maxsize=8)
def get_speaker_embedding(speaker_wav: str):
    runtime_model = get_xtts_runtime_model()
    if not speaker_wav or runtime_model is None:
        return None
    try:
        speaker_path = resolve_resource_path(speaker_wav)
        cached_latents = load_cached_speaker_embedding(speaker_path)
        if cached_latents is not None:
            return cached_latents
        if hasattr(runtime_model, "get_conditioning_latents"):
            latents = runtime_model.get_conditioning_latents(audio_path=speaker_path)
            if latents is not None:
                save_cached_speaker_embedding(speaker_path, latents)
            if isinstance(latents, (list, tuple)) and len(latents) >= 2:
                return latents[0], latents[1]
            return latents
    except Exception as error:
        print(f"Speaker embed cache failed: {error}")
    return None


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
    speaker_wav: str = "default_speaker.wav"
    piper_model_path: str = ""
    language: str = "en"
    speed: float = 1.0
    quality_mode: str = "balanced"


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
    return {
        "status": "ok",
        "tts_ready": True,
        "device": device,
        "xtts": get_xtts_status(),
    }


@app.get("/models/status")
def models_status():
    return {
        "status": "ok",
        "device": device,
        "xtts": get_xtts_status(),
    }


@app.post("/models/prepare")
def prepare_model(request: PrepareModelRequest):
    if request.engine != "xtts":
        raise HTTPException(status_code=400, detail="Unsupported model preparation request")
    return {"status": "ok", "xtts": start_xtts_prepare()}


@app.post("/tts/stream")
def stream_piper_speech(request: SpeakRequest):
    if is_request_cancelled(request.session_id):
        print("Dropping orphaned stream request")
        raise HTTPException(status_code=499, detail="Request cancelled")

    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    voice = ensure_piper_voice(request.piper_model_path) if request.engine == "piper" else None
    xtts_speaker_path = None
    xtts_speaker_latents = None

    if request.engine == "xtts":
        current_status = get_xtts_status()
        if current_status["state"] != "ready" or xtts_model is None:
            raise HTTPException(status_code=409, detail="XTTS is not ready yet")

        xtts_speaker_path = resolve_resource_path(request.speaker_wav)
        if not os.path.exists(xtts_speaker_path):
            raise HTTPException(status_code=500, detail=f"Missing speaker wav: {xtts_speaker_path}")

        xtts_speaker_latents = load_cached_speaker_embedding(xtts_speaker_path)

    def pcm_stream():
        try:
            if request.engine == "piper":
                for chunk_bytes in iter_piper_audio_bytes(request.text, request.session_id):
                    yield chunk_bytes
                return

            if request.engine != "xtts":
                raise HTTPException(status_code=400, detail="Unknown engine")

            with gpu_lock:
                if request.session_id != state.active_session_id:
                    print("Cancelling XTTS stream for stale session")
                    return

                runtime_model = get_xtts_runtime_model()
                if runtime_model is None or not hasattr(runtime_model, "inference_stream"):
                    raise RuntimeError("XTTS runtime does not support streaming")

                speaker_latents = xtts_speaker_latents
                if speaker_latents is None:
                    speaker_latents = get_speaker_embedding(xtts_speaker_path)

                if not (
                    isinstance(speaker_latents, tuple)
                    and len(speaker_latents) == 2
                    and speaker_latents[0] is not None
                    and speaker_latents[1] is not None
                ):
                    raise RuntimeError("XTTS speaker conditioning is unavailable")

                emitted_audio = False
                with torch.inference_mode():
                    stream = runtime_model.inference_stream(
                        text=request.text,
                        language=request.language,
                        gpt_cond_latent=speaker_latents[0],
                        speaker_embedding=speaker_latents[1],
                        stream_chunk_size=XTTS_STREAM_CHUNK_SIZE,
                        overlap_wav_len=XTTS_STREAM_OVERLAP_SAMPLES,
                        speed=request.speed,
                        enable_text_splitting=True,
                    )

                    for wav_chunk in stream:
                        if is_request_cancelled(request.session_id):
                            print("Cancelling XTTS stream for stale session")
                            return

                        if torch.is_tensor(wav_chunk):
                            wav_np = wav_chunk.detach().cpu().numpy()
                        else:
                            wav_np = np.asarray(wav_chunk, dtype=np.float32)

                        wav_np = np.asarray(wav_np, dtype=np.float32).reshape(-1)
                        if wav_np.size == 0:
                            continue

                        wav_np = np.clip(wav_np, -1, 1)
                        chunk_bytes = (wav_np * 32767).astype(np.int16).tobytes()
                        if not chunk_bytes:
                            continue

                        emitted_audio = True
                        yield chunk_bytes

                if device == "cuda":
                    torch.cuda.synchronize()

                if not emitted_audio and not is_request_cancelled(request.session_id):
                    raise RuntimeError("XTTS generation yielded no audio data")
        except Exception as error:
            print(f"{request.engine.upper()} streaming error: {error}")
            raise

    if request.engine not in {"piper", "xtts"}:
        raise HTTPException(status_code=400, detail="Unknown engine")

    sample_rate = XTTS_SAMPLE_RATE if request.engine == "xtts" else voice.config.sample_rate
    return StreamingResponse(
        pcm_stream(),
        media_type="application/octet-stream",
        headers={
            "X-Sample-Rate": str(sample_rate),
            "X-Audio-Encoding": "pcm_s16le",
            "X-Audio-Channels": "1",
        },
    )


@app.post("/tts")
def generate_speech(request: SpeakRequest):
    if is_request_cancelled(request.session_id):
        print("Dropping orphaned request")
        raise HTTPException(status_code=499, detail="Request cancelled")

    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_data = None

        if request.engine == "piper":
            voice = ensure_piper_voice(request.piper_model_path)
            try:
                raw_audio = collect_piper_audio_bytes(request.text, request.session_id)
                audio_np = np.frombuffer(raw_audio, dtype=np.int16)
                audio_np = trim_silence_int16(audio_np, voice.config.sample_rate)
                audio_data = encode_wav_bytes(audio_np, voice.config.sample_rate)
            except Exception as error:
                print(f"Piper internal error: {error}")
                import traceback

                traceback.print_exc()
                raise error

        elif request.engine == "xtts":
            current_status = get_xtts_status()
            if current_status["state"] != "ready" or xtts_model is None:
                raise HTTPException(status_code=409, detail="XTTS is not ready yet")

            speaker_path = resolve_resource_path(request.speaker_wav)
            if not os.path.exists(speaker_path):
                raise HTTPException(status_code=500, detail=f"Missing speaker wav: {speaker_path}")

            with gpu_lock:
                if request.session_id != state.active_session_id:
                    raise HTTPException(status_code=499, detail="Request cancelled")

                with torch.inference_mode():
                    xtts_out = xtts_model.tts(
                        text=request.text,
                        speaker_wav=speaker_path,
                        language=request.language,
                        speed=request.speed,
                    )
                if device == "cuda":
                    torch.cuda.synchronize()
                wav_out = xtts_out["wav"] if isinstance(xtts_out, dict) else xtts_out
                audio_data = finalize_xtts_audio(wav_out, request.quality_mode)

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
