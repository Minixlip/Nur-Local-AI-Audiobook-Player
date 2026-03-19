import { app, net } from 'electron'
import fs from 'fs'
import path from 'path'
import { createModelStatus, type TtsModelStatus } from '../shared/tts'

const MODELS_DIR = path.join(app.getPath('userData'), 'models')
const PIPER_FILENAME = 'en_US-lessac-medium.onnx'
const PIPER_JSON = 'en_US-lessac-medium.onnx.json'

const PIPER_URL_ONNX =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true'
const PIPER_URL_JSON =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true'

const ensureModelDirectory = () => {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true })
  }
}

ensureModelDirectory()

export const getPiperOnnxPath = () => path.join(MODELS_DIR, PIPER_FILENAME)

export const getPiperJsonPath = () => path.join(MODELS_DIR, PIPER_JSON)

export const hasPiperModel = () => fs.existsSync(getPiperOnnxPath()) && fs.existsSync(getPiperJsonPath())

const createMissingPiperState = (): TtsModelStatus =>
  createModelStatus('piper', 'missing', {
    progress: 0,
    path: getPiperOnnxPath(),
    message: 'Piper will be downloaded automatically on first launch.'
  })

let piperState: TtsModelStatus = hasPiperModel()
  ? createModelStatus('piper', 'ready', {
      progress: 100,
      path: getPiperOnnxPath(),
      message: 'Piper is ready.'
    })
  : createMissingPiperState()

let piperDownloadPromise: Promise<boolean> | null = null

export const getPiperStatus = (): TtsModelStatus => {
  if (hasPiperModel()) {
    piperState = createModelStatus('piper', 'ready', {
      progress: 100,
      path: getPiperOnnxPath(),
      message: 'Piper is ready.'
    })
  } else if (piperState.state !== 'downloading' && piperState.state !== 'error') {
    piperState = createMissingPiperState()
  }

  return piperState
}

const setPiperStatus = (next: Partial<TtsModelStatus>) => {
  piperState = {
    ...piperState,
    ...next,
    engine: 'piper',
    path: getPiperOnnxPath(),
    ready: (next.state ?? piperState.state) === 'ready'
  }
}

const downloadToFile = (url: string, destination: string, onProgress?: (progress: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const tempPath = `${destination}.download`
    try {
      fs.rmSync(tempPath, { force: true })
    } catch {}

    const file = fs.createWriteStream(tempPath)
    let completed = false

    const finishWithError = (error: Error) => {
      if (completed) return
      completed = true
      try {
        file.destroy()
      } catch {}
      fs.rm(tempPath, { force: true }, () => reject(error))
    }

    const request = net.request(url)
    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        finishWithError(new Error(`Failed to download ${path.basename(destination)}: ${response.statusCode}`))
        return
      }

      const totalBytes = Number(response.headers['content-length'] || 0)
      let receivedBytes = 0

      response.on('data', (chunk) => {
        receivedBytes += chunk.length
        file.write(chunk)
        if (onProgress && totalBytes > 0) {
          onProgress((receivedBytes / totalBytes) * 100)
        }
      })

      response.on('end', () => {
        file.end(async () => {
          try {
            await fs.promises.rm(destination, { force: true })
            await fs.promises.rename(tempPath, destination)
            if (!completed) {
              completed = true
              resolve()
            }
          } catch (error: any) {
            finishWithError(error)
          }
        })
      })

      response.on('error', (error) => finishWithError(error))
    })

    request.on('error', (error) => finishWithError(error))
    request.end()
  })

export const ensurePiperDownloaded = async (): Promise<boolean> => {
  ensureModelDirectory()

  if (hasPiperModel()) {
    setPiperStatus({
      state: 'ready',
      progress: 100,
      message: 'Piper is ready.'
    })
    return true
  }

  if (piperDownloadPromise) {
    return piperDownloadPromise
  }

  piperDownloadPromise = (async () => {
    try {
      setPiperStatus({
        state: 'downloading',
        progress: 2,
        message: 'Downloading Piper voice configuration...'
      })
      await downloadToFile(PIPER_URL_JSON, getPiperJsonPath())

      setPiperStatus({
        state: 'downloading',
        progress: 10,
        message: 'Downloading default Piper voice...'
      })
      await downloadToFile(PIPER_URL_ONNX, getPiperOnnxPath(), (progress) => {
        const scaled = 10 + progress * 0.9
        setPiperStatus({
          state: 'downloading',
          progress: Math.min(99, Math.round(scaled)),
          message: 'Downloading default Piper voice...'
        })
      })

      setPiperStatus({
        state: 'ready',
        progress: 100,
        message: 'Piper is ready.'
      })
      return true
    } catch (error) {
      console.error('[Main] Piper download failed:', error)
      setPiperStatus({
        state: 'error',
        progress: 0,
        message: 'Piper download failed. Retry from Settings.'
      })
      return false
    } finally {
      piperDownloadPromise = null
    }
  })()

  return piperDownloadPromise
}
