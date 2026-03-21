from __future__ import annotations

import io
import re

import numpy as np
import scipy.io.wavfile

from .constants import (
    CHATTERBOX_SILENCE_PAD_MS,
    CHATTERBOX_SILENCE_THRESHOLD,
    CHATTERBOX_STUDIO_SILENCE_PAD_MS,
    CHATTERBOX_STUDIO_SILENCE_THRESHOLD,
)


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
        return 'You need to add some text for me to talk.'

    normalized = (
        text.replace('\u00a0', ' ')
        .replace('â€¦', '...')
        .replace('â€œ', '"')
        .replace('â€\x9d', '"')
        .replace('â€˜', "'")
        .replace('â€™', "'")
        .replace('â€”', ' - ')
        .replace('â€“', ' - ')
    )
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    normalized = re.sub(r'\s+([,.;:!?])', r'\1', normalized)
    normalized = re.sub(r'([(\[{])\s+', r'\1', normalized)
    normalized = re.sub(r'\s+([)\]}])', r'\1', normalized)

    if normalized and normalized[0].islower():
        normalized = normalized[0].upper() + normalized[1:]

    if not re.search(r'[.!?,;:\-]["\')\]}]*$', normalized):
        normalized += '.'

    return normalized


def encode_wav_bytes(samples, sample_rate: int) -> bytes:
    out_buf = io.BytesIO()
    scipy.io.wavfile.write(out_buf, sample_rate, samples)
    audio_data = out_buf.getvalue()
    out_buf.close()
    return audio_data


def finalize_chatterbox_audio(
    wav_out,
    sample_rate: int,
    quality_mode: str = 'studio',
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
        if quality_mode == 'studio'
        else CHATTERBOX_SILENCE_THRESHOLD
    )
    pad_ms = (
        CHATTERBOX_STUDIO_SILENCE_PAD_MS
        if quality_mode == 'studio'
        else CHATTERBOX_SILENCE_PAD_MS
    )
    wav_np = trim_silence_float(wav_np, sample_rate, threshold=threshold, pad_ms=pad_ms)
    wav_np = apply_edge_fade(wav_np, sample_rate, fade_ms=10)
    wav_int16 = np.round(wav_np * 32767).astype(np.int16)
    return encode_wav_bytes(wav_int16, sample_rate)
