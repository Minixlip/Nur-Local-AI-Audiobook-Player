import { ElectronAPI } from '@electron-toolkit/preload'
import type { TtsEngine, TtsStatusSnapshot } from '../shared/tts'
import type { RuntimeStatusSnapshot, UpdateStatusSnapshot } from '../shared/runtime'
import type { TranslationResult, TranslationTargetLanguage } from '../shared/translation'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // UPDATED: Added options argument
      generate: (
        text: string,
        speed?: number,
        sessionId?: string,
        options?: {
          engine?: string
          voicePath?: string | null
          quality_mode?: string
          language?: string
        }
      ) => Promise<any>

      setSession: (sessionId: string) => Promise<boolean>
      checkBackend: () => Promise<{ ok: boolean; ttsReady: boolean }>
      getTtsStatus: () => Promise<TtsStatusSnapshot>
      ensureModel: (engine: TtsEngine) => Promise<TtsStatusSnapshot>
      translatePage: (
        text: string,
        targetLanguage: TranslationTargetLanguage
      ) => Promise<TranslationResult>
      getRuntimeStatus: () => Promise<RuntimeStatusSnapshot>
      restartBackend: () => Promise<TtsStatusSnapshot>
      checkForUpdates: () => Promise<UpdateStatusSnapshot>
      quitAndInstallUpdate: () => Promise<boolean>
      revealLogs: () => Promise<boolean>
      loadAudio: (filepath: string) => Promise<any>
      play: (filepath: string) => Promise<void>
      stop: () => Promise<void>
      openFileDialog: () => Promise<string | null>
      openAudioFileDialog: () => Promise<string | null>
      onDownloadProgress: (callback: (progress: number) => void) => () => void
      readFile: (filepath: string) => Promise<ArrayBuffer>
      revealPath: (filepath: string) => Promise<boolean>
      openPath: (filepath: string) => Promise<boolean>
      checkPiper: () => Promise<{ exists: boolean; path: string }>
      downloadPiper: () => Promise<boolean>
      listVoices: () => Promise<any[]>
      addVoice: (filePath: string, name: string) => Promise<{ success: boolean; voice?: any }>
      removeVoice: (id: string) => Promise<boolean>
      saveBook: (path: string, title: string, cover: string | null) => Promise<any>
      getLibrary: () => Promise<any[]>
      deleteBook: (id: string) => Promise<boolean>
      updateBookProgress: (bookId: string, progress: any) => Promise<boolean>
    }
  }
}
