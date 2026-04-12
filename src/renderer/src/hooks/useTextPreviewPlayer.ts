import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslationTargetLanguage } from '../../../shared/translation'
import { getStoredTtsEngine } from '../utils/tts'
import { getStoredTtsSpeed, getStoredXttsQualityMode } from './audioPlayer/config'

interface UseTextPreviewPlayerOptions {
  onBeforePlay?: () => Promise<void> | void
}

interface UseTextPreviewPlayerResult {
  isGenerating: boolean
  isPlaying: boolean
  error: string | null
  playText: (text: string, targetLanguage?: TranslationTargetLanguage) => Promise<boolean>
  stop: () => Promise<void>
  clearError: () => void
}

const toUint8Array = (value: Uint8Array | ArrayBuffer | number[]): Uint8Array => {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return new Uint8Array(value)
}

export function useTextPreviewPlayer({
  onBeforePlay
}: UseTextPreviewPlayerOptions = {}): UseTextPreviewPlayerResult {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const sessionIdRef = useRef('')

  const getAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      if (!AudioContextCtor) {
        throw new Error('Audio playback is not supported in this environment.')
      }

      audioContextRef.current = new AudioContextCtor()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }, [])

  const clearSource = useCallback((stopPlayback = false): void => {
    if (!sourceRef.current) return

    sourceRef.current.onended = null

    if (stopPlayback) {
      try {
        sourceRef.current.stop()
      } catch (stopError) {
        console.warn('Failed to stop translated preview source', stopError)
      }
    }

    try {
      sourceRef.current.disconnect()
    } catch (disconnectError) {
      console.warn('Failed to disconnect translated preview source', disconnectError)
    }

    sourceRef.current = null
  }, [])

  const resetSession = useCallback(async () => {
    if (!sessionIdRef.current) return
    sessionIdRef.current = ''
    try {
      await window.api.setSession('')
    } catch (sessionError) {
      console.warn('Failed to clear preview TTS session', sessionError)
    }
  }, [])

  const stop = useCallback(async () => {
    clearSource(true)
    setIsPlaying(false)
    setIsGenerating(false)

    if (audioContextRef.current?.state === 'running') {
      try {
        await audioContextRef.current.suspend()
      } catch (suspendError) {
        console.warn('Failed to suspend translated preview audio context', suspendError)
      }
    }

    await resetSession()
  }, [clearSource, resetSession])

  const playText = useCallback(
    async (text: string, targetLanguage?: TranslationTargetLanguage) => {
      const cleanText = text.trim()
      if (!cleanText) {
        setError('There is no translated text to play yet.')
        return false
      }

      await onBeforePlay?.()
      await stop()

      try {
        setError(null)
        setIsGenerating(true)

        const sessionId = `translation-preview-${Date.now()}`
        sessionIdRef.current = sessionId
        await window.api.setSession(sessionId)

        const engine = targetLanguage ? 'piper' : getStoredTtsEngine()
        const voicePath =
          engine === 'piper'
            ? localStorage.getItem('piper_model_path')
            : localStorage.getItem('custom_voice_path')

        const result = await window.api.generate(cleanText, getStoredTtsSpeed(), sessionId, {
          engine,
          voicePath,
          quality_mode: getStoredXttsQualityMode(),
          language: targetLanguage
        })

        if (result?.status !== 'success' || !result.audio_data) {
          throw new Error(
            result?.status === 'cancelled'
              ? 'Translated speech generation was cancelled.'
              : 'Could not generate speech for the translated page.'
          )
        }

        const audioContext = await getAudioContext()
        const audioBytes = toUint8Array(result.audio_data)
        const audioBuffer = audioBytes.buffer.slice(
          audioBytes.byteOffset,
          audioBytes.byteOffset + audioBytes.byteLength
        ) as ArrayBuffer
        const decodedBuffer = await audioContext.decodeAudioData(audioBuffer)

        const source = audioContext.createBufferSource()
        source.buffer = decodedBuffer
        source.connect(audioContext.destination)
        sourceRef.current = source

        source.onended = () => {
          if (sourceRef.current !== source) return
          clearSource()
          setIsPlaying(false)
          setIsGenerating(false)
          void resetSession()
        }

        source.start()
        setIsPlaying(true)
        setIsGenerating(false)
        return true
      } catch (playbackError) {
        clearSource(true)
        setIsPlaying(false)
        setIsGenerating(false)
        setError(playbackError instanceof Error ? playbackError.message : 'Playback failed.')
        await resetSession()
        return false
      }
    },
    [clearSource, getAudioContext, onBeforePlay, resetSession, stop]
  )

  useEffect(() => {
    return () => {
      void (async () => {
        await stop()

        if (audioContextRef.current) {
          try {
            await audioContextRef.current.close()
          } catch (closeError) {
            console.warn('Failed to close translated preview audio context', closeError)
          }
          audioContextRef.current = null
        }
      })()
    }
  }, [stop])

  const clearError = useCallback(() => setError(null), [])

  return {
    isGenerating,
    isPlaying,
    error,
    playText,
    stop,
    clearError
  }
}
