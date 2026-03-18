export type UpdateState =
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

export interface UpdateStatusSnapshot {
  state: UpdateState
  supported: boolean
  currentVersion: string
  availableVersion: string | null
  downloadedVersion: string | null
  progress: number | null
  message: string | null
  lastCheckedAt: string | null
}

export interface DiagnosticsSnapshot {
  appName: string
  appVersion: string
  platform: string
  packaged: boolean
  appId: string
  repositoryUrl: string
  userDataPath: string
  modelsDir: string
  voicesDir: string
  logsDir: string
  mainLogPath: string
  backendLogPath: string
  backendPath: string | null
  backendConfigured: boolean
  backendRunning: boolean
  backendMessage: string | null
}

export interface RuntimeStatusSnapshot {
  diagnostics: DiagnosticsSnapshot
  update: UpdateStatusSnapshot
}

export const EMPTY_UPDATE_STATUS: UpdateStatusSnapshot = {
  state: 'idle',
  supported: false,
  currentVersion: '0.0.0',
  availableVersion: null,
  downloadedVersion: null,
  progress: null,
  message: null,
  lastCheckedAt: null
}
