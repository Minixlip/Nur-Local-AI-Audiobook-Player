from __future__ import annotations

import os

from fastapi import HTTPException
from piper import PiperVoice

from .context import RuntimeContext, is_request_cancelled


def ensure_piper_voice(context: RuntimeContext, model_path: str) -> PiperVoice:
    if not model_path or not os.path.exists(model_path):
        print(f'Piper Error: Path not found: {model_path}')
        raise HTTPException(status_code=400, detail='Piper model path invalid')

    if context.piper.loaded_path != model_path:
        print(f'Loading Piper Model: {model_path}')
        try:
            context.piper.voice = PiperVoice.load(model_path)
            context.piper.loaded_path = model_path
        except Exception as error:
            print(f'Failed to load Piper: {error}')
            raise HTTPException(
                status_code=500, detail=f'Failed to load Piper: {error}'
            ) from error

    if context.piper.voice is None:
        raise HTTPException(status_code=500, detail='Piper voice failed to initialize')

    return context.piper.voice


def iter_piper_audio_bytes(context: RuntimeContext, text: str, session_id: str):
    if context.piper.voice is None:
        raise RuntimeError('Piper voice is not loaded')

    stream = context.piper.voice.synthesize(text, None)
    emitted_audio = False

    for chunk in stream:
        if is_request_cancelled(context, session_id):
            print('Cancelling Piper generation for stale session')
            break

        if hasattr(chunk, 'audio_int16_bytes'):
            chunk_bytes = chunk.audio_int16_bytes
        elif hasattr(chunk, 'bytes'):
            chunk_bytes = chunk.bytes
        else:
            print(f'Unknown chunk structure: {dir(chunk)}')
            raise RuntimeError('Cannot extract bytes from AudioChunk')

        if not chunk_bytes:
            continue

        emitted_audio = True
        yield chunk_bytes

    if not emitted_audio and not is_request_cancelled(context, session_id):
        raise RuntimeError('Piper generation yielded no audio data')


def collect_piper_audio_bytes(
    context: RuntimeContext, text: str, session_id: str
) -> bytes:
    raw_audio = b''
    for chunk_bytes in iter_piper_audio_bytes(context, text, session_id):
        raw_audio += chunk_bytes

    if not raw_audio and is_request_cancelled(context, session_id):
        raise HTTPException(status_code=499, detail='Request cancelled')

    if len(raw_audio) == 0:
        raise RuntimeError('Piper generation yielded no audio data')

    return raw_audio
