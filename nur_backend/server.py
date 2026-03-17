# -*- coding: utf-8 -*-
import io
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
from fastapi.responses import Response
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

piper_voice = None
loaded_piper_path = None


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


def warmup_xtts(model):
    print("Warming up XTTS...")
    warmup_speaker = resolve_resource_path("default_speaker.wav")
    if not os.path.exists(warmup_speaker):
        print("Warmup skipped: 'default_speaker.wav' not found in backend folder.")
        return

    with torch.inference_mode():
        model.tts("Ready.", language="en", speaker_wav=warmup_speaker, speed=1.2)
    if device == "cuda":
        torch.cuda.synchronize()


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
    if not speaker_wav or xtts_model is None:
        return None
    try:
        speaker_path = resolve_resource_path(speaker_wav)
        if hasattr(xtts_model, "get_conditioning_latents"):
            latents = xtts_model.get_conditioning_latents(speaker_wav=speaker_path)
            if isinstance(latents, (list, tuple)) and len(latents) >= 2:
                return latents[0], latents[1]
            return latents
    except Exception as error:
        print(f"Speaker embed cache failed: {error}")
    return None


app = FastAPI()


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


class PrepareModelRequest(BaseModel):
    engine: str


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


@app.post("/tts")
def generate_speech(request: SpeakRequest):
    global piper_voice, loaded_piper_path

    if request.session_id != state.active_session_id:
        print("Dropping orphaned request")
        raise HTTPException(status_code=499, detail="Request cancelled")

    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_data = None

        if request.engine == "piper":
            if not request.piper_model_path or not os.path.exists(request.piper_model_path):
                print(f"Piper Error: Path not found: {request.piper_model_path}")
                raise HTTPException(status_code=400, detail="Piper model path invalid")

            if loaded_piper_path != request.piper_model_path:
                print(f"Loading Piper Model: {request.piper_model_path}")
                try:
                    piper_voice = PiperVoice.load(request.piper_model_path)
                    loaded_piper_path = request.piper_model_path
                except Exception as error:
                    print(f"Failed to load Piper: {error}")
                    raise HTTPException(status_code=500, detail=f"Failed to load Piper: {error}")

            try:
                stream = piper_voice.synthesize(request.text, None)
                raw_audio = b""

                for chunk in stream:
                    if hasattr(chunk, "audio_int16_bytes"):
                        raw_audio += chunk.audio_int16_bytes
                    elif hasattr(chunk, "bytes"):
                        raw_audio += chunk.bytes
                    else:
                        print(f"Unknown chunk structure: {dir(chunk)}")
                        raise Exception("Cannot extract bytes from AudioChunk")

                if len(raw_audio) == 0:
                    raise Exception("Piper generation yielded no audio data")

                audio_np = np.frombuffer(raw_audio, dtype=np.int16)
                audio_np = trim_silence_int16(audio_np, piper_voice.config.sample_rate)

                out_buf = io.BytesIO()
                scipy.io.wavfile.write(out_buf, piper_voice.config.sample_rate, audio_np)
                audio_data = out_buf.getvalue()
                out_buf.close()
            except Exception as error:
                print(f"Piper internal error: {error}")
                import traceback

                traceback.print_exc()
                raise error

        elif request.engine == "xtts":
            current_status = get_xtts_status()
            if current_status["state"] != "ready" or xtts_model is None:
                raise HTTPException(status_code=409, detail="XTTS is not ready yet")

            with gpu_lock:
                if request.session_id != state.active_session_id:
                    raise HTTPException(status_code=499, detail="Request cancelled")

                current_xtts = xtts_model
                if current_xtts is None:
                    raise HTTPException(status_code=409, detail="XTTS is not ready yet")

                tts_kwargs = {
                    "text": request.text,
                    "language": request.language,
                    "speed": request.speed,
                }

                speaker_path = resolve_resource_path(request.speaker_wav)
                if not os.path.exists(speaker_path):
                    raise HTTPException(status_code=500, detail=f"Missing speaker wav: {speaker_path}")

                speaker_latents = get_speaker_embedding(speaker_path)
                if speaker_latents:
                    if isinstance(speaker_latents, tuple) and len(speaker_latents) == 2:
                        tts_kwargs["gpt_cond_latent"] = speaker_latents[0]
                        tts_kwargs["speaker_embedding"] = speaker_latents[1]
                    else:
                        tts_kwargs["speaker_embedding"] = speaker_latents
                else:
                    tts_kwargs["speaker_wav"] = speaker_path

                with torch.inference_mode():
                    wav_out = current_xtts.tts(**tts_kwargs)
                if device == "cuda":
                    torch.cuda.synchronize()

                wav_np = np.array(wav_out)
                wav_np = np.clip(wav_np, -1, 1)
                wav_int16 = (wav_np * 32767).astype(np.int16)

                out_buf = io.BytesIO()
                scipy.io.wavfile.write(out_buf, 24000, wav_int16)
                audio_data = out_buf.getvalue()
                out_buf.close()

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
