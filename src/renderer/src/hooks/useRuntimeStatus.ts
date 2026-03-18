import { useEffect, useState } from 'react'
import type { RuntimeStatusSnapshot } from '../../../shared/runtime'

const EMPTY_RUNTIME_STATUS: RuntimeStatusSnapshot = {
  diagnostics: {
    appName: 'Nur',
    appVersion: '0.0.0',
    platform: 'unknown',
    packaged: false,
    appId: 'com.minixlip.nur',
    repositoryUrl: 'https://github.com/Minixlip/nur',
    userDataPath: '',
    modelsDir: '',
    voicesDir: '',
    logsDir: '',
    mainLogPath: '',
    backendLogPath: '',
    backendPath: null,
    backendConfigured: false,
    backendRunning: false,
    backendMessage: 'Starting Nur engine...'
  },
  update: {
    state: 'idle',
    supported: false,
    currentVersion: '0.0.0',
    availableVersion: null,
    downloadedVersion: null,
    progress: null,
    message: null,
    lastCheckedAt: null
  }
}

export function useRuntimeStatus(pollMs = 2500) {
  const [runtime, setRuntime] = useState<RuntimeStatusSnapshot>(EMPTY_RUNTIME_STATUS)

  useEffect(() => {
    let isMounted = true

    const refresh = async () => {
      try {
        const snapshot = await window.api.getRuntimeStatus()
        if (!isMounted) return
        setRuntime(snapshot)
      } catch {}
    }

    refresh()
    const intervalId = window.setInterval(refresh, pollMs)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [pollMs])

  return runtime
}
