from __future__ import annotations

import hashlib
import os
import sys

from .constants import (
    CHATTERBOX_COND_CACHE_VERSION,
    CHATTERBOX_REFERENCE_CACHE_VERSION,
)


def resolve_resource_path(filename: str) -> str:
    if os.path.isabs(filename):
        return filename

    if getattr(sys, 'frozen', False):
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


def get_user_cache_dir() -> str:
    if sys.platform == 'win32':
        base = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
        return os.path.join(base, 'Nur', 'cache')
    if sys.platform == 'darwin':
        return os.path.join(os.path.expanduser('~/Library/Caches'), 'Nur')
    return os.path.join(
        os.environ.get('XDG_CACHE_HOME', os.path.expanduser('~/.cache')), 'nur'
    )


def get_chatterbox_reference_cache_dir() -> str:
    cache_dir = os.path.join(get_user_cache_dir(), 'chatterbox_refs')
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def get_chatterbox_conditionals_cache_dir() -> str:
    cache_dir = os.path.join(get_user_cache_dir(), 'chatterbox_conds')
    os.makedirs(cache_dir, exist_ok=True)
    return cache_dir


def build_chatterbox_reference_cache_path(speaker_path: str) -> str:
    stats = os.stat(speaker_path)
    payload = (
        f'{CHATTERBOX_REFERENCE_CACHE_VERSION}|'
        f'{os.path.abspath(speaker_path)}|'
        f'{stats.st_mtime_ns}|'
        f'{stats.st_size}'
    )
    digest = hashlib.sha256(payload.encode('utf-8')).hexdigest()
    return os.path.join(get_chatterbox_reference_cache_dir(), f'{digest}.wav')


def build_chatterbox_conditionals_cache_path(speaker_path: str) -> str:
    stats = os.stat(speaker_path)
    payload = (
        f'{CHATTERBOX_COND_CACHE_VERSION}|'
        f'{os.path.abspath(speaker_path)}|'
        f'{stats.st_mtime_ns}|'
        f'{stats.st_size}'
    )
    digest = hashlib.sha256(payload.encode('utf-8')).hexdigest()
    return os.path.join(get_chatterbox_conditionals_cache_dir(), f'{digest}.pt')
