import { useEffect, useState } from 'react'
import { EMPTY_TTS_STATUS, type TtsStatusSnapshot } from '../../../shared/tts'
import {
  ensureStoredTtsEngine,
  getStoredTtsEngine,
  setStoredPiperModelPath,
  TTS_ENGINE_CHANGED_EVENT,
  type TtsEngine
} from '../utils/tts'

export function useTtsStatus(pollMs = 1000) {
  const [engine, setEngine] = useState<TtsEngine>(() => ensureStoredTtsEngine())
  const [status, setStatus] = useState<TtsStatusSnapshot>(EMPTY_TTS_STATUS)

  useEffect(() => {
    let isMounted = true

    const refresh = async () => {
      try {
        const snapshot = await window.api.getTtsStatus()
        if (!isMounted) return
        setStatus(snapshot)
        setStoredPiperModelPath(snapshot.piper.ready ? snapshot.piper.path : null)
      } catch {}
    }

    refresh()
    const intervalId = window.setInterval(refresh, pollMs)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [pollMs])

  useEffect(() => {
    const syncEngine = () => setEngine(getStoredTtsEngine())
    window.addEventListener(TTS_ENGINE_CHANGED_EVENT, syncEngine)
    return () => window.removeEventListener(TTS_ENGINE_CHANGED_EVENT, syncEngine)
  }, [])

  return { engine, status }
}
