# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

backend_dir = Path.cwd()
datas = []
binaries = []
hiddenimports = []
for package_name in (
    'chatterbox',
    'perth',
    'librosa',
    'conformer',
    'huggingface_hub',
    'omegaconf',
    'trainer',
    'gruut',
    'jamo',
    'pypinyin',
    'bnunicodenormalizer',
    'sudachipy',
    's3tokenizer',
    'pyloudnorm',
    'pykakasi',
    'safetensors',
    'spacy_pkuseg',
    'transformers',
    'piper'
):
    tmp_ret = collect_all(package_name)
    datas += tmp_ret[0]
    binaries += tmp_ret[1]
    hiddenimports += tmp_ret[2]

datas += [(str(backend_dir / 'default_speaker.wav'), '.')]


a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['expecttest'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='nur_engine',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='nur_engine',
)
