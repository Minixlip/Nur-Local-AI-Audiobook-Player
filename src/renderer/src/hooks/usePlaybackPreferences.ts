import { useEffect, useState } from 'react'

export type PlaybackQualityMode = 'balanced' | 'studio'

export interface PlaybackPreferences {
  qualityMode: PlaybackQualityMode
  speechRate: number
  lowEndMode: boolean
  initialBuffer: number
  steadyBuffer: number
  crossfadeMs: number
}

const STORAGE_KEYS = {
  qualityMode: 'tts_quality_mode',
  speechRate: 'tts_playback_speed',
  lowEndMode: 'low_end_mode',
  initialBuffer: 'audio_buffer_initial',
  steadyBuffer: 'audio_buffer_steady',
  crossfadeMs: 'audio_crossfade_ms'
} as const

const PLAYBACK_PREFERENCES_CHANGED_EVENT = 'playback:preferences-changed'

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  qualityMode: 'studio',
  speechRate: 1.0,
  lowEndMode: false,
  initialBuffer: 3,
  steadyBuffer: 8,
  crossfadeMs: 30
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const normalizeQualityMode = (value: unknown): PlaybackQualityMode =>
  value === 'balanced' || value === 'studio' ? value : DEFAULT_PLAYBACK_PREFERENCES.qualityMode

export const normalizePlaybackPreferences = (
  value:
    | (Partial<PlaybackPreferences> & {
        qualityMode?: PlaybackQualityMode | null
      })
    | null
    | undefined
): PlaybackPreferences => ({
  qualityMode: normalizeQualityMode(value?.qualityMode),
  speechRate:
    typeof value?.speechRate === 'number' && Number.isFinite(value.speechRate)
      ? clamp(Number(value.speechRate.toFixed(2)), 0.85, 1.15)
      : DEFAULT_PLAYBACK_PREFERENCES.speechRate,
  lowEndMode:
    typeof value?.lowEndMode === 'boolean'
      ? value.lowEndMode
      : DEFAULT_PLAYBACK_PREFERENCES.lowEndMode,
  initialBuffer:
    typeof value?.initialBuffer === 'number' && Number.isFinite(value.initialBuffer)
      ? clamp(Math.round(value.initialBuffer), 1, 6)
      : DEFAULT_PLAYBACK_PREFERENCES.initialBuffer,
  steadyBuffer:
    typeof value?.steadyBuffer === 'number' && Number.isFinite(value.steadyBuffer)
      ? clamp(Math.round(value.steadyBuffer), 3, 14)
      : DEFAULT_PLAYBACK_PREFERENCES.steadyBuffer,
  crossfadeMs:
    typeof value?.crossfadeMs === 'number' && Number.isFinite(value.crossfadeMs)
      ? clamp(Math.round(value.crossfadeMs), 0, 120)
      : DEFAULT_PLAYBACK_PREFERENCES.crossfadeMs
})

export const loadStoredPlaybackPreferences = (): PlaybackPreferences => {
  const readNumber = (key: string, fallback: number) => {
    const value = Number(localStorage.getItem(key))
    return Number.isFinite(value) ? value : fallback
  }

  return normalizePlaybackPreferences({
    qualityMode:
      (localStorage.getItem(STORAGE_KEYS.qualityMode) as PlaybackQualityMode | null) ?? undefined,
    speechRate: readNumber(STORAGE_KEYS.speechRate, DEFAULT_PLAYBACK_PREFERENCES.speechRate),
    lowEndMode: localStorage.getItem(STORAGE_KEYS.lowEndMode) === 'true',
    initialBuffer: readNumber(
      STORAGE_KEYS.initialBuffer,
      DEFAULT_PLAYBACK_PREFERENCES.initialBuffer
    ),
    steadyBuffer: readNumber(STORAGE_KEYS.steadyBuffer, DEFAULT_PLAYBACK_PREFERENCES.steadyBuffer),
    crossfadeMs: readNumber(STORAGE_KEYS.crossfadeMs, DEFAULT_PLAYBACK_PREFERENCES.crossfadeMs)
  })
}

const persistPlaybackPreferences = (preferences: PlaybackPreferences) => {
  localStorage.setItem(STORAGE_KEYS.qualityMode, preferences.qualityMode)
  localStorage.setItem(STORAGE_KEYS.speechRate, String(preferences.speechRate))
  localStorage.setItem(STORAGE_KEYS.lowEndMode, String(preferences.lowEndMode))
  localStorage.setItem(STORAGE_KEYS.initialBuffer, String(preferences.initialBuffer))
  localStorage.setItem(STORAGE_KEYS.steadyBuffer, String(preferences.steadyBuffer))
  localStorage.setItem(STORAGE_KEYS.crossfadeMs, String(preferences.crossfadeMs))
  window.dispatchEvent(
    new CustomEvent<PlaybackPreferences>(PLAYBACK_PREFERENCES_CHANGED_EVENT, {
      detail: preferences
    })
  )
}

export function usePlaybackPreferences() {
  const [preferences, setPreferences] = useState<PlaybackPreferences>(() =>
    loadStoredPlaybackPreferences()
  )

  useEffect(() => {
    const syncFromStorage = () => {
      setPreferences(loadStoredPlaybackPreferences())
    }

    const syncFromEvent = (event: Event) => {
      const customEvent = event as CustomEvent<PlaybackPreferences | undefined>
      if (customEvent.detail) {
        setPreferences(normalizePlaybackPreferences(customEvent.detail))
        return
      }
      syncFromStorage()
    }

    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(PLAYBACK_PREFERENCES_CHANGED_EVENT, syncFromEvent as EventListener)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(
        PLAYBACK_PREFERENCES_CHANGED_EVENT,
        syncFromEvent as EventListener
      )
    }
  }, [])

  const updatePreference = <K extends keyof PlaybackPreferences>(
    key: K,
    value: PlaybackPreferences[K]
  ) => {
    setPreferences((previous) => {
      const next = normalizePlaybackPreferences({ ...previous, [key]: value })
      persistPlaybackPreferences(next)
      return next
    })
  }

  const resetPreferences = () => {
    const next = { ...DEFAULT_PLAYBACK_PREFERENCES }
    persistPlaybackPreferences(next)
    setPreferences(next)
  }

  return { preferences, updatePreference, resetPreferences }
}
