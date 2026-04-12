import os
import sys
import types
import warnings


def _install_typeguard_stub_if_needed() -> None:
    if os.environ.get('NUR_DISABLE_TYPEGUARD', '1') != '1':
        return

    typeguard_stub = types.ModuleType('typeguard')

    def _typechecked(func=None, **_kwargs):
        if func is None:
            return lambda inner: inner
        return func

    class TypeCheckError(Exception):
        pass

    typeguard_stub.typechecked = _typechecked
    typeguard_stub.TypeCheckError = TypeCheckError
    sys.modules.setdefault('typeguard', typeguard_stub)


class PassthroughWatermarker:
    def apply_watermark(self, wav, sample_rate=None, **_kwargs):
        return wav

    def get_watermark(
        self,
        watermarked_wav,
        sample_rate=None,
        watermark_length=None,
        **_kwargs
    ):
        import numpy as np

        length = watermark_length if watermark_length is not None else 32
        return np.zeros(length, dtype=np.float32)


def _silent_tqdm(iterable, *args, **kwargs):
    return iterable


def bootstrap_runtime_environment() -> None:
    _install_typeguard_stub_if_needed()

    warnings.filterwarnings('ignore', category=FutureWarning)
    os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
    os.environ.setdefault('HF_HUB_ETAG_TIMEOUT', '30')
    os.environ.setdefault('HF_HUB_DOWNLOAD_TIMEOUT', '60')

    import perth
    from chatterbox.models.t3 import t3 as chatterbox_t3_module

    if getattr(perth, 'PerthImplicitWatermarker', None) is None:
        perth.PerthImplicitWatermarker = PassthroughWatermarker

    chatterbox_t3_module.tqdm = _silent_tqdm
