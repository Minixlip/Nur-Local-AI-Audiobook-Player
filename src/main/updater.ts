import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import {
  EMPTY_UPDATE_STATUS,
  type UpdateState,
  type UpdateStatusSnapshot
} from '../shared/runtime'

let listenersBound = false

const updatesSupported = app.isPackaged

let updateStatus: UpdateStatusSnapshot = {
  ...EMPTY_UPDATE_STATUS,
  supported: updatesSupported,
  currentVersion: app.getVersion(),
  message: updatesSupported ? 'Updates are idle.' : 'Updates are only available in packaged builds.'
}

const setUpdateStatus = (
  state: UpdateState,
  overrides: Partial<Omit<UpdateStatusSnapshot, 'state' | 'supported' | 'currentVersion'>> = {}
) => {
  updateStatus = {
    ...updateStatus,
    ...overrides,
    state,
    supported: updatesSupported,
    currentVersion: app.getVersion()
  }
}

export const getUpdateStatus = () => ({ ...updateStatus })

export const initAutoUpdater = () => {
  if (!updatesSupported || listenersBound) return
  listenersBound = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setUpdateStatus('checking', {
      progress: null,
      message: 'Checking for updates...',
      lastCheckedAt: new Date().toISOString()
    })
  })

  autoUpdater.on('update-available', (info) => {
    setUpdateStatus('available', {
      availableVersion: info.version,
      progress: 0,
      message: `Downloading version ${info.version}...`,
      lastCheckedAt: new Date().toISOString()
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    setUpdateStatus('downloading', {
      progress: Math.round(progress.percent),
      message: `Downloading update... ${Math.round(progress.percent)}%`
    })
  })

  autoUpdater.on('update-not-available', () => {
    setUpdateStatus('not-available', {
      availableVersion: null,
      downloadedVersion: null,
      progress: null,
      message: 'You are up to date.',
      lastCheckedAt: new Date().toISOString()
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateStatus('downloaded', {
      downloadedVersion: info.version,
      availableVersion: info.version,
      progress: 100,
      message: `Version ${info.version} is ready to install.`
    })
  })

  autoUpdater.on('error', (error) => {
    setUpdateStatus('error', {
      progress: null,
      message: error?.message || 'Update check failed.',
      lastCheckedAt: new Date().toISOString()
    })
  })
}

export const checkForUpdates = async () => {
  if (!updatesSupported) {
    setUpdateStatus('unsupported', {
      message: 'Updates are only available in packaged builds.'
    })
    return getUpdateStatus()
  }

  try {
    await autoUpdater.checkForUpdates()
  } catch (error: any) {
    setUpdateStatus('error', {
      progress: null,
      message: error?.message || 'Update check failed.',
      lastCheckedAt: new Date().toISOString()
    })
  }

  return getUpdateStatus()
}

export const quitAndInstallUpdate = () => {
  if (updateStatus.state !== 'downloaded') return false
  autoUpdater.quitAndInstall()
  return true
}
