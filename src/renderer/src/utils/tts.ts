import {
  DEFAULT_TTS_ENGINE,
  type TtsEngine,
  type TtsStatusSnapshot
} from '../../../shared/tts'

export type { TtsEngine }
export { DEFAULT_TTS_ENGINE }

export const TTS_ENGINE_CHANGED_EVENT = 'tts:engine-changed'

export const getStoredTtsEngine = (): TtsEngine => {
  const stored = localStorage.getItem('tts_engine')
  return stored === 'xtts' || stored === 'chatterbox' ? 'chatterbox' : DEFAULT_TTS_ENGINE
}

export const ensureStoredTtsEngine = (): TtsEngine => {
  const engine = getStoredTtsEngine()
  if (!localStorage.getItem('tts_engine')) {
    localStorage.setItem('tts_engine', engine)
  }
  return engine
}

export const setStoredTtsEngine = (engine: TtsEngine) => {
  localStorage.setItem('tts_engine', engine)
  window.dispatchEvent(new CustomEvent(TTS_ENGINE_CHANGED_EVENT, { detail: engine }))
}

export const setStoredPiperModelPath = (path: string | null) => {
  if (path) {
    localStorage.setItem('piper_model_path', path)
    return
  }
  localStorage.removeItem('piper_model_path')
}

export const getModelStatusForEngine = (status: TtsStatusSnapshot, engine: TtsEngine) =>
  engine === 'chatterbox' ? status.chatterbox : status.piper

export const isEngineReady = (status: TtsStatusSnapshot, engine: TtsEngine) =>
  status.backendOk && getModelStatusForEngine(status, engine).ready
