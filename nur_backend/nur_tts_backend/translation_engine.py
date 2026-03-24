from __future__ import annotations

import re
import threading
from typing import Any

from fastapi import HTTPException
from transformers import pipeline

TRANSLATION_MODEL_IDS = {
    'es': 'Helsinki-NLP/opus-mt-en-es',
    'fr': 'Helsinki-NLP/opus-mt-en-fr',
    'ar': 'Helsinki-NLP/opus-mt-en-ar',
}

_translator_lock = threading.Lock()
_translator_cache: dict[str, Any] = {}
_MAX_CHARS_PER_CHUNK = 420


def _get_translator(target_language: str):
    if target_language not in TRANSLATION_MODEL_IDS:
        raise HTTPException(status_code=400, detail='Unsupported translation language')

    with _translator_lock:
        cached = _translator_cache.get(target_language)
        if cached is not None:
            return cached

        model_id = TRANSLATION_MODEL_IDS[target_language]
        try:
            translator = pipeline(
                'translation',
                model=model_id,
                tokenizer=model_id,
                device=-1,
            )
        except Exception as error:
            raise HTTPException(
                status_code=500,
                detail=f'Could not load translation model {model_id}: {error}',
            ) from error
        _translator_cache[target_language] = translator
        return translator


def _chunk_paragraph(paragraph: str) -> list[str]:
    paragraph = paragraph.strip()
    if not paragraph:
        return []

    if len(paragraph) <= _MAX_CHARS_PER_CHUNK:
        return [paragraph]

    sentence_parts = re.split(r'(?<=[.!?])\s+', paragraph)
    chunks: list[str] = []
    current = ''

    for sentence in sentence_parts:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(sentence) > _MAX_CHARS_PER_CHUNK:
            if current:
                chunks.append(current.strip())
                current = ''

            words = sentence.split()
            word_chunk = ''
            for word in words:
                candidate = f'{word_chunk} {word}'.strip()
                if len(candidate) <= _MAX_CHARS_PER_CHUNK:
                    word_chunk = candidate
                else:
                    if word_chunk:
                        chunks.append(word_chunk.strip())
                    word_chunk = word
            if word_chunk:
                chunks.append(word_chunk.strip())
            continue

        candidate = f'{current} {sentence}'.strip()
        if current and len(candidate) > _MAX_CHARS_PER_CHUNK:
            chunks.append(current.strip())
            current = sentence
        else:
            current = candidate

    if current:
        chunks.append(current.strip())

    return chunks


def build_translation_chunks(text: str) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r'\n\s*\n', text) if part.strip()]
    chunks: list[str] = []

    for paragraph in paragraphs:
        chunks.extend(_chunk_paragraph(paragraph))

    return chunks


def translate_text(text: str, target_language: str) -> str:
    cleaned_text = text.strip()
    if not cleaned_text:
        raise HTTPException(status_code=400, detail='Text cannot be empty')

    translator = _get_translator(target_language)
    chunks = build_translation_chunks(cleaned_text)
    translated_chunks: list[str] = []

    try:
        for chunk in chunks:
            result = translator(chunk, max_length=512, clean_up_tokenization_spaces=True)
            if not result or 'translation_text' not in result[0]:
                raise HTTPException(status_code=500, detail='Translation failed')
            translated_chunks.append(result[0]['translation_text'].strip())
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500, detail=f'Translation failed: {error}'
        ) from error

    return '\n\n'.join(part for part in translated_chunks if part)
