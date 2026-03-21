from __future__ import annotations

import os
import threading

import librosa
import numpy as np
import soundfile as sf
import torch
import torch.nn.functional as F
from chatterbox.models.t3.modules.cond_enc import T3Cond
from chatterbox.tts import ChatterboxTTS, Conditionals, drop_invalid_tokens
from fastapi import HTTPException

from .audio import (
    apply_edge_fade,
    ensure_mono_float32,
    finalize_chatterbox_audio,
    normalize_chatterbox_text,
    trim_silence_float,
)
from .constants import (
    CHATTERBOX_APPLY_WATERMARK,
    CHATTERBOX_ENGINE_ALIASES,
    CHATTERBOX_MEMORY_COND_CACHE_LIMIT,
    CHATTERBOX_SAMPLE_RATE_FALLBACK,
    PREPAREABLE_ENGINES,
)
from .context import (
    RuntimeContext,
    get_chatterbox_status,
    is_request_cancelled,
    set_chatterbox_status,
)
from .resources import (
    build_chatterbox_conditionals_cache_path,
    build_chatterbox_reference_cache_path,
    resolve_resource_path,
)


def clone_optional_tensor(value):
    return value.clone() if torch.is_tensor(value) else value


def clone_conditionals_for_generation(
    conds: Conditionals, device: str, exaggeration: float
) -> Conditionals:
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
        sf.write(cache_path, samples, sample_rate, subtype='PCM_16')
        return cache_path
    except Exception as error:
        print(f'Reference audio preprocessing skipped: {error}')
        return speaker_path


def set_cached_conditionals(
    context: RuntimeContext, cache_key: str, conds: Conditionals
) -> None:
    if cache_key not in context.chatterbox.conditionals_cache:
        context.chatterbox.conditionals_cache_keys.append(cache_key)
    context.chatterbox.conditionals_cache[cache_key] = conds
    if (
        len(context.chatterbox.conditionals_cache_keys)
        > CHATTERBOX_MEMORY_COND_CACHE_LIMIT
    ):
        oldest = context.chatterbox.conditionals_cache_keys.pop(0)
        context.chatterbox.conditionals_cache.pop(oldest, None)


def load_cached_conditionals_from_disk(
    speaker_path: str, device: str
) -> Conditionals | None:
    cache_path = build_chatterbox_conditionals_cache_path(speaker_path)
    if not os.path.exists(cache_path):
        return None
    try:
        return Conditionals.load(cache_path, map_location='cpu').to(device)
    except Exception as error:
        print(f'Chatterbox conditioning cache load failed: {error}')
        try:
            os.remove(cache_path)
        except OSError:
            pass
        return None


def save_cached_conditionals_to_disk(
    speaker_path: str, conds: Conditionals
) -> None:
    cache_path = build_chatterbox_conditionals_cache_path(speaker_path)
    try:
        conds.save(cache_path)
    except Exception as error:
        print(f'Chatterbox conditioning cache save failed: {error}')


def is_default_voice_request(speaker_wav: str) -> bool:
    speaker_name = os.path.basename((speaker_wav or '').strip())
    return speaker_name in {'', 'default_speaker.wav'}


def resolve_conditionals_for_request(
    context: RuntimeContext, model: ChatterboxTTS, speaker_wav: str
) -> Conditionals:
    if is_default_voice_request(speaker_wav) and getattr(model, 'conds', None) is not None:
        return model.conds

    speaker_path = (
        resolve_resource_path('default_speaker.wav')
        if is_default_voice_request(speaker_wav)
        else resolve_resource_path(speaker_wav)
    )

    if not os.path.exists(speaker_path):
        raise HTTPException(status_code=500, detail=f'Missing speaker wav: {speaker_path}')

    prepared_path = preprocess_reference_audio(speaker_path)
    if not os.path.exists(prepared_path):
        raise HTTPException(status_code=500, detail=f'Missing speaker wav: {prepared_path}')

    cached = context.chatterbox.conditionals_cache.get(prepared_path)
    if cached is not None:
        return cached

    disk_cached = load_cached_conditionals_from_disk(prepared_path, context.device)
    if disk_cached is not None:
        set_cached_conditionals(context, prepared_path, disk_cached)
        return disk_cached

    previous_conds = getattr(model, 'conds', None)
    try:
        model.prepare_conditionals(prepared_path)
        conds = getattr(model, 'conds', None)
        if conds is None:
            raise RuntimeError('Chatterbox conditioning failed')
        save_cached_conditionals_to_disk(prepared_path, conds)
        set_cached_conditionals(context, prepared_path, conds)
        return conds
    finally:
        model.conds = previous_conds


def get_chatterbox_generation_profile(quality_mode: str) -> dict[str, float]:
    if quality_mode == 'studio':
        return {
            'exaggeration': 0.45,
            'cfg_weight': 0.35,
            'temperature': 0.72,
            'top_p': 0.95,
            'min_p': 0.05,
            'repetition_penalty': 1.12,
        }

    return {
        'exaggeration': 0.5,
        'cfg_weight': 0.5,
        'temperature': 0.8,
        'top_p': 1.0,
        'min_p': 0.05,
        'repetition_penalty': 1.2,
    }


def warmup_chatterbox(model: ChatterboxTTS, device: str) -> None:
    print('Warming up Chatterbox...')
    with torch.inference_mode():
        model.generate('Ready.', exaggeration=0.2, cfg_weight=0.5, temperature=0.8)
    if device == 'cuda':
        torch.cuda.synchronize()


def prepare_chatterbox_model(context: RuntimeContext) -> None:
    try:
        print('Loading Chatterbox...')
        with context.gpu_lock:
            model = ChatterboxTTS.from_pretrained(device=context.device)
            try:
                warmup_chatterbox(model, context.device)
            except RuntimeError as error:
                print(f'Chatterbox warmup skipped: {error}')

        context.chatterbox.model = model

        default_speaker = resolve_resource_path('default_speaker.wav')
        if os.path.exists(default_speaker):
            previous_conds = getattr(context.chatterbox.model, 'conds', None)
            try:
                prepared_default_speaker = preprocess_reference_audio(default_speaker)
                generation_profile = get_chatterbox_generation_profile('studio')
                cached = load_cached_conditionals_from_disk(
                    prepared_default_speaker, context.device
                )
                if cached is None and hasattr(context.chatterbox.model, 'prepare_conditionals'):
                    context.chatterbox.model.prepare_conditionals(
                        prepared_default_speaker,
                        exaggeration=generation_profile['exaggeration'],
                    )
                    cached = getattr(context.chatterbox.model, 'conds', None)
                    if cached is not None:
                        save_cached_conditionals_to_disk(
                            prepared_default_speaker, cached
                        )
                if cached is not None:
                    set_cached_conditionals(context, prepared_default_speaker, cached)
            except Exception as error:
                print(f'Chatterbox speaker cache warmup skipped: {error}')
            finally:
                context.chatterbox.model.conds = previous_conds

        print('Chatterbox ready')
        set_chatterbox_status(
            context,
            'ready',
            f'Chatterbox is ready on {context.device.upper()}.',
        )
    except Exception as error:
        context.chatterbox.model = None
        message = f'Chatterbox preparation failed: {error}'
        print(message)
        set_chatterbox_status(context, 'error', message)


def start_chatterbox_prepare(context: RuntimeContext) -> dict[str, object]:
    with context.chatterbox_prepare_lock:
        current = get_chatterbox_status(context)
        if current['state'] in {'ready', 'preparing'}:
            return current

        set_chatterbox_status(
            context,
            'preparing',
            'Preparing Chatterbox. This can take several minutes.',
        )
        thread = threading.Thread(
            target=prepare_chatterbox_model, args=(context,), daemon=True
        )
        thread.start()

    return get_chatterbox_status(context)


def synthesize_chatterbox_waveform(
    context: RuntimeContext,
    model: ChatterboxTTS,
    text: str,
    conds: Conditionals,
    generation_profile: dict[str, float],
    session_id: str,
):
    runtime_conds = clone_conditionals_for_generation(
        conds, context.device, generation_profile['exaggeration']
    )
    normalized_text = normalize_chatterbox_text(text)
    text_tokens = model.tokenizer.text_to_tokens(normalized_text).to(model.device)

    if generation_profile['cfg_weight'] > 0.0:
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
            temperature=generation_profile['temperature'],
            cfg_weight=generation_profile['cfg_weight'],
            repetition_penalty=generation_profile['repetition_penalty'],
            min_p=generation_profile['min_p'],
            top_p=generation_profile['top_p'],
        )
        speech_tokens = speech_tokens[0]
        speech_tokens = drop_invalid_tokens(speech_tokens)
        speech_tokens = speech_tokens[speech_tokens < 6561]
        speech_tokens = speech_tokens.to(model.device)

        if is_request_cancelled(context, session_id):
            raise HTTPException(status_code=499, detail='Request cancelled')

        wav, _ = model.s3gen.inference(
            speech_tokens=speech_tokens,
            ref_dict=runtime_conds.gen,
        )

    wav_np = ensure_mono_float32(wav.squeeze(0).detach().cpu().numpy())
    if CHATTERBOX_APPLY_WATERMARK:
        wav_np = model.watermarker.apply_watermark(wav_np, sample_rate=model.sr)
    return wav_np


def generate_chatterbox_audio(
    context: RuntimeContext,
    text: str,
    session_id: str,
    speaker_wav: str,
    quality_mode: str,
) -> bytes:
    current_status = get_chatterbox_status(context)
    if current_status['state'] != 'ready' or context.chatterbox.model is None:
        raise HTTPException(status_code=409, detail='Chatterbox is not ready yet')

    with context.gpu_lock:
        if is_request_cancelled(context, session_id):
            raise HTTPException(status_code=499, detail='Request cancelled')

        resolved_conds = resolve_conditionals_for_request(
            context, context.chatterbox.model, speaker_wav
        )
        generation_profile = get_chatterbox_generation_profile(quality_mode)
        wav_np = synthesize_chatterbox_waveform(
            context,
            context.chatterbox.model,
            text,
            resolved_conds,
            generation_profile,
            session_id,
        )
        if context.device == 'cuda':
            torch.cuda.synchronize()
        sample_rate = int(
            getattr(
                context.chatterbox.model,
                'sr',
                CHATTERBOX_SAMPLE_RATE_FALLBACK,
            )
        )
        return finalize_chatterbox_audio(wav_np, sample_rate, quality_mode)


def validate_prepare_engine(engine: str) -> None:
    if engine not in PREPAREABLE_ENGINES:
        raise HTTPException(
            status_code=400, detail='Unsupported model preparation request'
        )


def is_chatterbox_engine(engine: str) -> bool:
    return engine in CHATTERBOX_ENGINE_ALIASES
