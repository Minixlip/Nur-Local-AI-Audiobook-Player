export type TtsEngine = 'piper' | 'xtts'

export type TtsModelState = 'missing' | 'downloading' | 'preparing' | 'ready' | 'error'

export interface TtsModelStatus {
  engine: TtsEngine
  state: TtsModelState
  ready: boolean
  progress: number | null
  path: string | null
  message: string | null
}

export interface TtsStatusSnapshot {
  backendOk: boolean
  backendMessage: string | null
  device: string | null
  piper: TtsModelStatus
  xtts: TtsModelStatus
}

export const DEFAULT_TTS_ENGINE: TtsEngine = 'piper'

export const createModelStatus = (
  engine: TtsEngine,
  state: TtsModelState,
  overrides: Partial<Omit<TtsModelStatus, 'engine' | 'state' | 'ready'>> = {}
): TtsModelStatus => ({
  engine,
  state,
  ready: state === 'ready',
  progress: overrides.progress ?? null,
  path: overrides.path ?? null,
  message: overrides.message ?? null
})

export const EMPTY_TTS_STATUS: TtsStatusSnapshot = {
  backendOk: false,
  backendMessage: 'Starting Nur engine...',
  device: null,
  piper: createModelStatus('piper', 'missing'),
  xtts: createModelStatus('xtts', 'missing')
}
