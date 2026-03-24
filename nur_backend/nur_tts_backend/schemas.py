from pydantic import BaseModel


class SessionControl(BaseModel):
    session_id: str


class SpeakRequest(BaseModel):
    text: str
    session_id: str
    engine: str = 'piper'
    speaker_wav: str = ''
    piper_model_path: str = ''
    language: str = 'en'
    speed: float = 1.0
    quality_mode: str = 'studio'


class PrepareModelRequest(BaseModel):
    engine: str


class TranslateRequest(BaseModel):
    text: str
    target_language: str
