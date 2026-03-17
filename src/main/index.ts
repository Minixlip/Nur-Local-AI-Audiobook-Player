import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import path from 'path'
import { net } from 'electron'
import { exec, execFile, ChildProcess } from 'child_process'
import { setupLibraryHandlers } from './library'
import {
  DEFAULT_TTS_ENGINE,
  createModelStatus,
  type TtsEngine,
  type TtsModelStatus,
  type TtsStatusSnapshot
} from '../shared/tts'

let currentPlayer: ChildProcess | null = null
let backendProcess: ChildProcess | null = null

const MODELS_DIR = path.join(app.getPath('userData'), 'models')
const VOICES_DIR = path.join(app.getPath('userData'), 'voices')
const VOICES_DB = path.join(VOICES_DIR, 'voices.json')
const PIPER_FILENAME = 'en_US-lessac-medium.onnx'
const PIPER_JSON = 'en_US-lessac-medium.onnx.json'
const BACKEND_HOST = '127.0.0.1'
const BACKEND_PORT = 8000

const PIPER_URL_ONNX =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true'
const PIPER_URL_JSON =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true'

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true })
}
if (!fs.existsSync(VOICES_DIR)) {
  fs.mkdirSync(VOICES_DIR, { recursive: true })
}

const getPiperOnnxPath = () => path.join(MODELS_DIR, PIPER_FILENAME)
const getPiperJsonPath = () => path.join(MODELS_DIR, PIPER_JSON)

const hasPiperModel = () =>
  fs.existsSync(getPiperOnnxPath()) && fs.existsSync(getPiperJsonPath())

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

const getPiperStatus = (): TtsModelStatus => {
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

const readVoicesDb = () => {
  if (!fs.existsSync(VOICES_DB)) return []
  try {
    return JSON.parse(fs.readFileSync(VOICES_DB, 'utf-8'))
  } catch {
    return []
  }
}

const writeVoicesDb = (data: any[]) => {
  fs.writeFileSync(VOICES_DB, JSON.stringify(data, null, 2))
}

const backendJsonRequest = <T>(method: 'GET' | 'POST', requestPath: string, body?: unknown) => {
  return new Promise<T | null>((resolve) => {
    const request = net.request({
      method,
      protocol: 'http:',
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: requestPath
    })

    if (body !== undefined) {
      request.setHeader('Content-Type', 'application/json')
    }

    request.on('error', () => resolve(null))
    request.on('response', (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        resolve(null)
        return
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T
          resolve(payload)
        } catch {
          resolve(null)
        }
      })
    })

    if (body !== undefined) {
      request.write(JSON.stringify(body))
    }

    request.end()
  })
}

const getBackendTtsStatus = async (): Promise<{
  backendOk: boolean
  backendMessage: string | null
  device: string | null
  xtts: TtsModelStatus
}> => {
  const payload = await backendJsonRequest<{
    device?: string
    xtts?: { state?: TtsModelStatus['state']; message?: string; device?: string }
  }>('GET', '/models/status')

  if (!payload) {
    return {
      backendOk: false,
      backendMessage: 'Starting Nur engine...',
      device: null,
      xtts: createModelStatus('xtts', 'missing', {
        message: 'Starting Nur engine...'
      })
    }
  }

  const device = payload.xtts?.device || payload.device || 'unknown'
  const state = payload.xtts?.state || 'missing'

  return {
    backendOk: true,
    backendMessage: null,
    device,
    xtts: createModelStatus('xtts', state, {
      message: payload.xtts?.message || 'XTTS is available as an optional download.'
    })
  }
}

const getTtsStatus = async (): Promise<TtsStatusSnapshot> => {
  const backendStatus = await getBackendTtsStatus()
  return {
    backendOk: backendStatus.backendOk,
    backendMessage: backendStatus.backendMessage,
    device: backendStatus.device,
    piper: getPiperStatus(),
    xtts: backendStatus.xtts
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

const ensurePiperDownloaded = async (): Promise<boolean> => {
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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 900,
    minHeight: 670,
    minimizable: false,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const getBackendExecutablePath = () => {
  const candidates: string[] = []
  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, 'nur_backend', 'nur_engine', 'nur_engine.exe'))
    candidates.push(path.join(process.resourcesPath, 'nur_backend', 'nur_engine', 'nur_engine'))
    candidates.push(path.join(process.resourcesPath, 'nur_backend', 'nur_engine.exe'))
    candidates.push(path.join(process.resourcesPath, 'nur_backend', 'nur_engine'))
    candidates.push(path.join(process.resourcesPath, 'nur_engine.exe'))
    candidates.push(path.join(process.resourcesPath, 'nur_engine'))
  } else {
    candidates.push(path.join(app.getAppPath(), 'nur_backend', 'dist', 'nur_engine', 'nur_engine.exe'))
    candidates.push(path.join(app.getAppPath(), 'nur_backend', 'dist', 'nur_engine', 'nur_engine'))
    candidates.push(path.join(app.getAppPath(), 'nur_backend', 'nur_engine', 'nur_engine.exe'))
    candidates.push(path.join(app.getAppPath(), 'nur_backend', 'nur_engine', 'nur_engine'))
    candidates.push(path.join(app.getAppPath(), 'nur_backend', 'nur_engine.exe'))
    candidates.push(path.join(app.getAppPath(), 'nur_backend', 'nur_engine'))
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

const startBackend = () => {
  if (backendProcess) return
  const backendPath = getBackendExecutablePath()
  if (!backendPath) {
    console.warn('[Main] Backend executable not found. Skipping auto-start.')
    return
  }
  backendProcess = execFile(backendPath, [], { windowsHide: true }, (error) => {
    if (error) {
      console.error('[Main] Backend exited with error:', error.message)
    }
    backendProcess = null
  })
}

const stopBackend = () => {
  if (!backendProcess) return
  try {
    backendProcess.kill()
  } catch (err) {}
  backendProcess = null
}

// --- NEW: FILE DIALOG HANDLER ---
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'EPUB Books', extensions: ['epub'] }]
  })
  if (canceled) {
    return null
  } else {
    // Return the path so frontend can read it
    return filePaths[0]
  }
})

ipcMain.handle('dialog:openAudioFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Audio Files', extensions: ['wav', 'mp3'] }]
  })
  if (canceled) {
    return null
  } else {
    return filePaths[0]
  }
})

ipcMain.handle('tts:checkPiper', () => {
  const exists = hasPiperModel()
  return {
    exists,
    path: getPiperOnnxPath()
  }
})

ipcMain.handle('tts:downloadPiper', async () => ensurePiperDownloaded())

ipcMain.handle('tts:getStatus', async () => getTtsStatus())

ipcMain.handle('tts:ensureModel', async (_event, engine: TtsEngine) => {
  if (engine === 'piper') {
    await ensurePiperDownloaded()
    return getTtsStatus()
  }

  await backendJsonRequest('POST', '/models/prepare', { engine: 'xtts' })
  return getTtsStatus()
})

ipcMain.handle('tts:setSession', async (_event, sessionId) => {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'POST',
      protocol: 'http:',
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: '/session'
    })
    request.setHeader('Content-Type', 'application/json')
    request.on('error', (err) => {
      console.warn('Backend session error:', err.message)
      resolve(false)
    })
    request.on('response', () => resolve(true))
    request.write(JSON.stringify({ session_id: sessionId }))
    request.end()
  })
})

ipcMain.handle('tts:health', async () => {
  const status = await getTtsStatus()
  return {
    ok: status.backendOk,
    ttsReady: status.backendOk
  }
})

ipcMain.handle('tts:generate', async (_event, { text, speed, sessionId, engine, voicePath }) => {
  const safeSpeed = speed || 1.0
  const safeEngine: TtsEngine = engine === 'xtts' ? 'xtts' : DEFAULT_TTS_ENGINE

  let safeVoice = voicePath
  if (!safeVoice && safeEngine === 'xtts') {
    safeVoice = 'default_speaker.wav'
  }
  if (!safeVoice && safeEngine === 'piper') {
    safeVoice = hasPiperModel() ? getPiperOnnxPath() : ''
  }

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      protocol: 'http:',
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: '/tts'
    })

    request.setHeader('Content-Type', 'application/json')

    request.on('response', (response) => {
      const chunks: Buffer[] = []

      // 499 = Client Closed Request (Our custom cancellation code)
      if (response.statusCode === 499) {
        resolve({ status: 'cancelled', audio_data: null })
        return
      }
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        if (response.statusCode !== 200) {
          const raw = Buffer.concat(chunks).toString('utf-8')
          try {
            const payload = JSON.parse(raw) as { detail?: string }
            reject(payload.detail || `Python Error: ${response.statusCode}`)
          } catch {
            reject(raw || `Python Error: ${response.statusCode}`)
          }
          return
        }
        const buffer = Buffer.concat(chunks)
        resolve({ status: 'success', audio_data: buffer })
      })
    })

    request.on('error', (err) => reject(err.message))

    request.write(
      JSON.stringify({
        text: text,
        session_id: sessionId,
        engine: safeEngine,
        speaker_wav: safeVoice,
        piper_model_path: safeVoice,
        language: 'en',
        speed: safeSpeed
      })
    )

    request.end()
  })
})

// 2. PLAY FILE (Native Fallback)
ipcMain.handle('audio:play', async (_event, { filepath }) => {
  return new Promise((resolve, reject) => {
    if (currentPlayer) {
      try {
        currentPlayer.kill()
      } catch (e) {}
    }
    const platform = process.platform
    let fullCommand = ''
    if (platform === 'darwin') {
      fullCommand = `afplay "${filepath}"`
    } else if (platform === 'win32') {
      const safePath = filepath.replace(/'/g, "''")
      fullCommand = `powershell -c "(New-Object Media.SoundPlayer '${safePath}').PlaySync();"`
    } else {
      fullCommand = `aplay "${filepath}"`
    }
    currentPlayer = exec(fullCommand, (error) => {
      currentPlayer = null
      if (error && !error.killed) {
        reject(error.message)
      } else {
        fs.unlink(filepath, () => {})
        resolve('done')
      }
    })
  })
})

// 3. STOP PLAYBACK
ipcMain.handle('audio:stop', async () => {
  if (currentPlayer) {
    currentPlayer.kill()
    currentPlayer = null
  }
  return true
})

// 4. LOAD AUDIO FILE
ipcMain.handle('audio:load', async (_event, { filepath }) => {
  try {
    const buffer = fs.readFileSync(filepath)
    try {
      fs.unlinkSync(filepath)
    } catch (e) {}
    return buffer
  } catch (err: any) {
    console.error(`[Main] Failed to load audio: ${err.message}`)
    throw err
  }
})

// 5. READ FILE
ipcMain.handle('fs:readFile', async (_event, { filepath }) => {
  return fs.readFileSync(filepath)
})

// 6. REVEAL PATH IN FILE EXPLORER
ipcMain.handle('fs:revealPath', async (_event, { filepath }) => {
  try {
    if (!filepath) return false
    shell.showItemInFolder(filepath)
    return true
  } catch (err) {
    console.error('[Main] Reveal path failed:', err)
    return false
  }
})

// 7. VOICE LIBRARY
ipcMain.handle('voice:list', async () => {
  return readVoicesDb()
})

ipcMain.handle('voice:add', async (_event, { filePath, name }) => {
  try {
    if (!filePath || !name) return { success: false }
    const voices = readVoicesDb()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const ext = path.extname(filePath) || '.wav'
    const safeName = String(name).trim().replace(/[^\w\- ]+/g, '').slice(0, 60) || 'Voice'
    const filename = `${id}-${safeName.replace(/\s+/g, '_')}${ext}`
    const destination = path.join(VOICES_DIR, filename)
    await fs.promises.copyFile(filePath, destination)
    const voice = {
      id,
      name: safeName,
      path: destination,
      createdAt: new Date().toISOString()
    }
    voices.unshift(voice)
    writeVoicesDb(voices)
    return { success: true, voice }
  } catch (err) {
    console.error('[Main] Voice add failed:', err)
    return { success: false }
  }
})

ipcMain.handle('voice:remove', async (_event, { id }) => {
  try {
    const voices = readVoicesDb()
    const index = voices.findIndex((v: any) => v.id === id)
    if (index === -1) return false
    const voice = voices[index]
    try {
      await fs.promises.unlink(voice.path)
    } catch (err) {}
    voices.splice(index, 1)
    writeVoicesDb(voices)
    return true
  } catch (err) {
    console.error('[Main] Voice remove failed:', err)
    return false
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupLibraryHandlers()

  startBackend()
  void ensurePiperDownloaded()
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackend()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackend()
})
