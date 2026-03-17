import { useEffect, useState } from 'react'

export interface ReaderSettings {
  theme: 'light' | 'dark' | 'sepia'
  fontSize: number
  fontFamily: 'serif' | 'sans' | 'mono'
  lineHeight: number
}

const STORAGE_KEY = 'reader_settings'
const READER_SETTINGS_CHANGED_EVENT = 'reader:settings-changed'

const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'dark',
  fontSize: 160,
  fontFamily: 'sans',
  lineHeight: 1.6
}

const isTheme = (value: unknown): value is ReaderSettings['theme'] =>
  value === 'light' || value === 'dark' || value === 'sepia'

const isFontFamily = (value: unknown): value is ReaderSettings['fontFamily'] =>
  value === 'serif' || value === 'sans' || value === 'mono'

const normalizeSettings = (value: unknown): ReaderSettings => {
  const candidate = typeof value === 'object' && value !== null ? value : {}
  const next = candidate as Partial<ReaderSettings>

  return {
    theme: isTheme(next.theme) ? next.theme : DEFAULT_SETTINGS.theme,
    fontSize:
      typeof next.fontSize === 'number' && Number.isFinite(next.fontSize)
        ? Math.min(200, Math.max(80, next.fontSize))
        : DEFAULT_SETTINGS.fontSize,
    fontFamily: isFontFamily(next.fontFamily) ? next.fontFamily : DEFAULT_SETTINGS.fontFamily,
    lineHeight:
      typeof next.lineHeight === 'number' && Number.isFinite(next.lineHeight)
        ? next.lineHeight
        : DEFAULT_SETTINGS.lineHeight
  }
}

const loadStoredReaderSettings = (): ReaderSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_SETTINGS
    return normalizeSettings(JSON.parse(saved))
  } catch (error) {
    console.error('Failed to load reader settings', error)
    return DEFAULT_SETTINGS
  }
}

const persistReaderSettings = (settings: ReaderSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(
    new CustomEvent<ReaderSettings>(READER_SETTINGS_CHANGED_EVENT, { detail: settings })
  )
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(() => loadStoredReaderSettings())

  useEffect(() => {
    const syncFromStorage = () => {
      setSettings(loadStoredReaderSettings())
    }

    const syncFromEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ReaderSettings | undefined>
      if (customEvent.detail) {
        setSettings(normalizeSettings(customEvent.detail))
        return
      }
      syncFromStorage()
    }

    window.addEventListener('storage', syncFromStorage)
    window.addEventListener(READER_SETTINGS_CHANGED_EVENT, syncFromEvent as EventListener)

    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener(READER_SETTINGS_CHANGED_EVENT, syncFromEvent as EventListener)
    }
  }, [])

  const updateSetting = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
    setSettings((previous) => {
      const next = normalizeSettings({ ...previous, [key]: value })
      persistReaderSettings(next)
      return next
    })
  }

  return { settings, updateSetting }
}
