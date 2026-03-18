import { useEffect, useState } from 'react'
import { useReaderSettings } from '../../../hooks/useReaderSettings'
import {
  usePlaybackPreferences,
  type PlaybackQualityMode
} from '../../../hooks/usePlaybackPreferences'
import { useRuntimeStatus } from '../../../hooks/useRuntimeStatus'
import { useTtsStatus } from '../../../hooks/useTtsStatus'
import { setStoredTtsEngine, type TtsEngine } from '../../../utils/tts'
import Tooltip from '../../ui/Tooltip'

const MIN_TTS_SPEED = 0.85
const MAX_TTS_SPEED = 1.15

const clampTtsSpeed = (value: number) => Math.min(MAX_TTS_SPEED, Math.max(MIN_TTS_SPEED, value))

export default function Settings(): React.JSX.Element {
  const { settings } = useReaderSettings()
  const { preferences, updatePreference, resetPreferences } = usePlaybackPreferences()
  const { engine, status } = useTtsStatus(900)
  const runtime = useRuntimeStatus(2500)
  const [customVoicePath, setCustomVoicePath] = useState<string>('')

  const piperStatus = status.piper
  const xttsStatus = status.xtts
  const piperPath = piperStatus.path || ''
  const piperProgress = piperStatus.progress ?? 0
  const { lowEndMode, initialBuffer, steadyBuffer, crossfadeMs, speechRate, qualityMode } =
    preferences

  useEffect(() => {
    const savedVoice = localStorage.getItem('custom_voice_path') || ''

    setCustomVoicePath(savedVoice)
  }, [])

  const handleDownload = async (engineToPrepare: TtsEngine, event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (engineToPrepare === 'xtts') {
      setStoredTtsEngine('xtts')
    }
    await window.api.ensureModel(engineToPrepare)
  }

  const handleEngineChange = async (newEngine: TtsEngine) => {
    setStoredTtsEngine(newEngine)
    await window.api.ensureModel(newEngine)
  }

  const handleVoiceSelect = async () => {
    const path = await window.api.openAudioFileDialog()
    if (path) {
      setCustomVoicePath(path)
      localStorage.setItem('custom_voice_path', path)
    }
  }

  const handleResetVoice = () => {
    setCustomVoicePath('')
    localStorage.removeItem('custom_voice_path')
  }

  const handleLowEndToggle = () => {
    updatePreference('lowEndMode', !lowEndMode)
  }

  const handleInitialBufferChange = (value: number) => {
    updatePreference('initialBuffer', value)
  }

  const handleSteadyBufferChange = (value: number) => {
    updatePreference('steadyBuffer', value)
  }

  const handleCrossfadeChange = (value: number) => {
    updatePreference('crossfadeMs', value)
  }

  const handleTtsSpeedChange = (value: number) => {
    const next = clampTtsSpeed(value)
    updatePreference('speechRate', next)
  }

  const handleXttsQualityModeChange = (mode: PlaybackQualityMode) => {
    updatePreference('qualityMode', mode)
  }

  const handleRevealPiperPath = async () => {
    if (!piperPath) return
    await window.api.revealPath(piperPath)
  }

  const handleRevealLogs = async () => {
    await window.api.revealLogs()
  }

  const handleRestartBackend = async () => {
    await window.api.restartBackend()
  }

  const handleCheckUpdates = async () => {
    await window.api.checkForUpdates()
  }

  const handleInstallUpdate = async () => {
    await window.api.quitAndInstallUpdate()
  }

  const handleOpenUserData = async () => {
    await window.api.openPath(runtime.diagnostics.userDataPath)
  }

  const handleOpenModelsDir = async () => {
    await window.api.openPath(runtime.diagnostics.modelsDir)
  }

  const handleOpenVoicesDir = async () => {
    await window.api.openPath(runtime.diagnostics.voicesDir)
  }

  const handleRevealBackendBinary = async () => {
    if (!runtime.diagnostics.backendPath) return
    await window.api.revealPath(runtime.diagnostics.backendPath)
  }

  const getSliderFill = () => {
    if (settings.theme === 'light') return '#1f2937'
    if (settings.theme === 'sepia') return '#6b4f2a'
    return '#ffffff'
  }

  const getSliderThumbBorder = () => {
    if (settings.theme === 'light') return 'rgba(31,41,55,0.7)'
    if (settings.theme === 'sepia') return 'rgba(107,79,42,0.7)'
    return 'rgba(255,255,255,0.7)'
  }

  const getSliderGlow = () => {
    if (settings.theme === 'light') return 'rgba(31,41,55,0.15)'
    if (settings.theme === 'sepia') return 'rgba(107,79,42,0.15)'
    return 'rgba(255,255,255,0.18)'
  }

  const getSliderPercent = (value: number, min: number, max: number) => {
    const clamped = Math.min(max, Math.max(min, value))
    const percent = ((clamped - min) / (max - min)) * 100
    return `${percent}%`
  }

  const readingPaceLabel =
    speechRate < 0.95 ? 'Measured' : speechRate > 1.05 ? 'Brisk' : 'Natural'

  return (
    <div className="p-8 text-white h-full overflow-y-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-400 mt-1">Personalize your playback and voice settings.</p>
      </div>

      <div className="w-full max-w-none space-y-8">
        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-zinc-100">Audio Engine</h2>
          </div>

          <div className="space-y-4">
            <div
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                engine === 'xtts'
                  ? 'bg-zinc-900/40 border-white/20 shadow-lg'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <Tooltip label="Select Coqui XTTS" className="w-full">
                <button
                  onClick={() => handleEngineChange('xtts')}
                  className="w-full px-5 py-4 text-left flex justify-between items-center gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-lg flex items-center gap-2 text-zinc-100">
                      Coqui XTTS
                      <span className="text-xs bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded border border-white/10">
                        HQ
                      </span>
                    </div>
                    <div className="text-sm text-zinc-300 mt-1">
                      Realistic, emotive voices. Supports cloning.
                      <span className="ml-2 text-yellow-500 text-xs font-mono">Requires GPU</span>
                    </div>
                    {status.device && (
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Backend device: {status.device.toUpperCase()}
                      </div>
                    )}
                    {xttsStatus.message && !xttsStatus.ready && (
                      <div className="text-xs text-zinc-400 mt-2">{xttsStatus.message}</div>
                    )}
                  </div>
                  {xttsStatus.ready ? (
                    engine === 'xtts' ? (
                      <div className="h-6 w-6 rounded-full bg-white shadow-inner shadow-black/20"></div>
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-white/20"></div>
                    )
                  ) : xttsStatus.state === 'preparing' || xttsStatus.state === 'downloading' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                        Preparing
                      </span>
                      <div className="animate-spin h-5 w-5 border-2 border-white/70 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <div className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
                      {xttsStatus.state === 'error' ? 'Retry' : 'Download & Use'}
                    </div>
                  )}
                </button>
              </Tooltip>

              {engine === 'xtts' && xttsStatus.ready && (
                <div className="px-5 pb-5 pt-2 border-t border-white/10 bg-black/20">
                  <div className="mt-3 text-sm font-semibold text-zinc-300 mb-2">
                    Voice Cloning (Reference Audio)
                  </div>

                  <div className="flex items-center gap-3">
                    {customVoicePath ? (
                      <div className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 flex justify-between items-center">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-zinc-300">
                            WAV
                          </div>
                          <div className="truncate text-sm text-zinc-200" title={customVoicePath}>
                            ...{customVoicePath.slice(-40)}
                          </div>
                        </div>
                        <Tooltip label="Remove custom voice">
                          <button
                            onClick={handleResetVoice}
                            className="text-xs text-red-400 hover:text-red-300 px-2 font-semibold"
                          >
                            Remove
                          </button>
                        </Tooltip>
                      </div>
                    ) : (
                      <div className="flex-1 text-xs text-zinc-400 italic bg-black/20 p-3 rounded-lg border border-dashed border-white/10">
                        Using Default Female Voice. Upload a short WAV file (6-10s) to clone a
                        voice.
                      </div>
                    )}

                    <Tooltip
                      label={customVoicePath ? 'Change voice reference' : 'Select voice reference'}
                    >
                      <button
                        onClick={handleVoiceSelect}
                        className="px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg text-sm font-bold shadow transition hover:-translate-y-0.5"
                      >
                        {customVoicePath ? 'Change Voice' : 'Select File'}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`w-full rounded-2xl border transition-all duration-200 overflow-hidden relative ${
                engine === 'piper'
                  ? 'bg-zinc-900/40 border-white/20 shadow-lg scale-[1.01]'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              {piperStatus.state === 'downloading' && (
                <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full">
                  <div
                    className="h-full bg-white/60 transition-all duration-300"
                    style={{ width: `${piperProgress}%` }}
                  />
                </div>
              )}

              {piperStatus.ready ? (
                <Tooltip label="Select Piper TTS" className="w-full">
                  <button
                    onClick={() => handleEngineChange('piper')}
                    className="w-full px-5 py-4 flex justify-between items-center gap-4 text-left"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-lg flex items-center gap-2 text-zinc-100">
                        Piper TTS
                        <span className="text-xs bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded border border-white/10">
                          FAST
                        </span>
                        <span className="text-xs bg-emerald-400/10 text-emerald-200 px-2 py-0.5 rounded border border-emerald-300/20">
                          DEFAULT
                        </span>
                      </div>
                      <div className="text-sm text-zinc-300 mt-1">
                        Ultra-fast generation. Works on any CPU.
                      </div>
                    </div>
                    {engine === 'piper' ? (
                      <div className="h-6 w-6 rounded-full bg-white shadow-inner shadow-black/20"></div>
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-white/20 hover:border-white/50 transition-colors"></div>
                    )}
                  </button>
                </Tooltip>
              ) : (
                <div className="px-5 py-4 flex justify-between items-center gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-lg flex items-center gap-2 text-zinc-100">
                      Piper TTS
                      <span className="text-xs bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded border border-white/10">
                        FAST
                      </span>
                      <span className="text-xs bg-emerald-400/10 text-emerald-200 px-2 py-0.5 rounded border border-emerald-300/20">
                        DEFAULT
                      </span>
                    </div>
                    <div className="text-sm text-zinc-300 mt-1">
                      Ultra-fast generation. Works on any CPU.
                    </div>
                    <div className="text-xs text-zinc-400 mt-2">
                      {piperStatus.message || 'Downloaded automatically on first launch.'}
                    </div>
                  </div>

                  {piperStatus.state === 'downloading' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-200 font-mono">
                        {Math.round(piperProgress)}%
                      </span>
                      <div className="animate-spin h-5 w-5 border-2 border-white/70 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <Tooltip
                      label={
                        piperStatus.state === 'error'
                          ? 'Retry Piper download'
                          : 'Download Piper model'
                      }
                    >
                      <button
                        onClick={(event) => handleDownload('piper', event)}
                        className="z-10 px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg font-bold text-sm shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                      >
                        <span>
                          {piperStatus.state === 'error' ? 'Retry Download' : 'Download Model'}
                        </span>
                        <span className="bg-black/10 px-1.5 rounded text-xs">~60MB</span>
                      </button>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Voice Delivery</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Control pacing and how much XTTS prioritizes natural phrasing over speed.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
              {readingPaceLabel}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.3fr,1fr]">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="flex items-center justify-between text-sm text-zinc-200">
                <span className="font-medium">Reading pace</span>
                <span className="font-semibold text-zinc-100">{speechRate.toFixed(2)}x</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                `1.0x` is the natural baseline. Slower sounds calmer; faster feels more energetic.
              </div>
              <Tooltip label="Speech speed" className="w-full">
                <input
                  type="range"
                  min={MIN_TTS_SPEED}
                  max={MAX_TTS_SPEED}
                  step={0.01}
                  value={speechRate}
                  onChange={(event) => handleTtsSpeedChange(Number(event.target.value))}
                  className="mt-3 w-full glass-slider"
                  style={
                    {
                      '--slider-fill': getSliderFill(),
                      '--slider-percent': getSliderPercent(speechRate, MIN_TTS_SPEED, MAX_TTS_SPEED),
                      '--slider-thumb-border': getSliderThumbBorder(),
                      '--slider-glow': getSliderGlow()
                    } as React.CSSProperties
                  }
                />
              </Tooltip>
              <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                <span>0.85x</span>
                <span>Natural</span>
                <span>1.15x</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-sm font-medium text-zinc-200">XTTS quality preset</div>
              <div className="mt-1 text-[11px] text-zinc-400">
                Studio uses larger batches and less aggressive startup optimization for more natural delivery.
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      value: 'balanced',
                      label: 'Balanced',
                      description: 'Faster start, steadier on weaker machines.'
                    },
                    {
                      value: 'studio',
                      label: 'Studio',
                      description: 'Best phrasing and cadence. Slightly slower to begin.'
                    }
                  ] as const
                ).map((option) => {
                  const active = qualityMode === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleXttsQualityModeChange(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-white/30 bg-white/10 shadow-[0_14px_30px_rgba(0,0,0,0.25)]'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-zinc-100">{option.label}</span>
                        {active && <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />}
                      </div>
                      <div className="mt-2 text-[11px] leading-5 text-zinc-400">
                        {option.description}
                      </div>
                    </button>
                  )
                })}
              </div>
              {lowEndMode && (
                <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100">
                  Low-end mode is on, so playback will still favor stability over maximum XTTS quality.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Performance</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Reduce buffering on low-end devices by using smaller audio batches.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetPreferences}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300 transition hover:bg-white/10"
              >
                Reset Audio
              </button>
              <Tooltip label="Toggle low-end device mode">
                <button
                  onClick={handleLowEndToggle}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-all ${
                    lowEndMode ? 'bg-white/90 border-white/80' : 'bg-white/10 border-white/20'
                  }`}
                  aria-pressed={lowEndMode}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-black transition-all ${
                      lowEndMode ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 gap-4">
            <div>
              <div className="text-sm font-semibold text-zinc-200">Low-end device mode</div>
              <div className="text-xs text-zinc-400">
                Smaller chunks, steadier playback, slightly more pauses between segments.
              </div>
            </div>
            <div
              className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                lowEndMode
                  ? 'bg-emerald-400/10 text-emerald-200 border-emerald-300/30'
                  : 'bg-white/5 text-zinc-300 border-white/10'
              }`}
            >
              {lowEndMode ? 'Enabled' : 'Off'}
            </div>
          </div>
          <details className="group rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-200">Advanced buffering</div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  Fine-tune startup feel, continuity, and segment joins.
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300 transition group-open:bg-white/10">
                Expand
              </div>
            </summary>

            <div className="grid gap-4 pt-4">
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between text-sm text-zinc-200">
                  <span className="font-medium text-zinc-200">Initial buffer (segments)</span>
                  <span className="font-semibold text-zinc-100">{initialBuffer}</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  How many segments load before playback starts.
                </div>
                <Tooltip label="Initial buffer size" className="w-full">
                  <input
                    type="range"
                    min={1}
                    max={6}
                    step={1}
                    value={initialBuffer}
                    onChange={(event) => handleInitialBufferChange(Number(event.target.value))}
                    className="mt-3 w-full glass-slider"
                    style={
                      {
                        '--slider-fill': getSliderFill(),
                        '--slider-percent': getSliderPercent(initialBuffer, 1, 6),
                        '--slider-thumb-border': getSliderThumbBorder(),
                        '--slider-glow': getSliderGlow()
                      } as React.CSSProperties
                    }
                  />
                </Tooltip>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between text-sm text-zinc-200">
                  <span className="font-medium text-zinc-200">Steady buffer (segments)</span>
                  <span className="font-semibold text-zinc-100">{steadyBuffer}</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Keeps playback smooth once it is running.
                </div>
                <Tooltip label="Steady buffer size" className="w-full">
                  <input
                    type="range"
                    min={3}
                    max={14}
                    step={1}
                    value={steadyBuffer}
                    onChange={(event) => handleSteadyBufferChange(Number(event.target.value))}
                    className="mt-3 w-full glass-slider"
                    style={
                      {
                        '--slider-fill': getSliderFill(),
                        '--slider-percent': getSliderPercent(steadyBuffer, 3, 14),
                        '--slider-thumb-border': getSliderThumbBorder(),
                        '--slider-glow': getSliderGlow()
                      } as React.CSSProperties
                    }
                  />
                </Tooltip>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between text-sm text-zinc-200">
                  <span className="font-medium text-zinc-200">Crossfade (ms)</span>
                  <span className="font-semibold text-zinc-100">{crossfadeMs}</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Blends adjacent segments to reduce gaps.
                </div>
                <Tooltip label="Crossfade duration" className="w-full">
                  <input
                    type="range"
                    min={0}
                    max={120}
                    step={5}
                    value={crossfadeMs}
                    onChange={(event) => handleCrossfadeChange(Number(event.target.value))}
                    className="mt-3 w-full glass-slider"
                    style={
                      {
                        '--slider-fill': getSliderFill(),
                        '--slider-percent': getSliderPercent(crossfadeMs, 0, 120),
                        '--slider-thumb-border': getSliderThumbBorder(),
                        '--slider-glow': getSliderGlow()
                      } as React.CSSProperties
                    }
                  />
                </Tooltip>
              </div>
            </div>
          </details>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Model Storage</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Where models are stored on disk. Useful for backups and cleanup.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-200">Piper model path</div>
            <div className="text-xs text-zinc-400 mt-1 break-all">
              {piperPath ? piperPath : 'Not downloaded yet.'}
            </div>
            <div className="mt-3">
              <Tooltip label={piperPath ? 'Reveal in File Explorer' : 'Download Piper to enable'}>
                <button
                  onClick={handleRevealPiperPath}
                  disabled={!piperPath}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 transition"
                >
                  Reveal in Explorer
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-200">XTTS cache location</div>
            <div className="text-xs text-zinc-400 mt-1">
              Stored by the TTS engine in the user cache directory. Typical path:
            </div>
            <div className="text-xs text-zinc-500 mt-1 break-all">
              Windows: %USERPROFILE%\.cache\tts - macOS/Linux: ~/.cache/tts
            </div>
          </div>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">App & Diagnostics</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Release status, backend recovery, logs, and update controls.
              </p>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              v{runtime.diagnostics.appVersion}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 space-y-3">
              <div>
                <div className="text-sm font-semibold text-zinc-200">Backend status</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {status.backendOk ? 'Nur engine is reachable.' : runtime.diagnostics.backendMessage}
                </div>
              </div>
              <div className="text-xs text-zinc-500 break-all">
                {runtime.diagnostics.backendPath || 'Backend executable path unavailable.'}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRestartBackend}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
                >
                  Restart Engine
                </button>
                <button
                  onClick={handleRevealLogs}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
                >
                  Reveal Logs
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 space-y-3">
              <div>
                <div className="text-sm font-semibold text-zinc-200">Updates</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {runtime.update.message ||
                    (runtime.update.supported
                      ? 'Ready to check for updates.'
                      : 'Updates are only available in packaged builds.')}
                </div>
              </div>
              {runtime.update.progress !== null && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-300 transition-all duration-300"
                    style={{ width: `${runtime.update.progress}%` }}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCheckUpdates}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white text-black hover:bg-zinc-200 transition disabled:opacity-40"
                  disabled={!runtime.update.supported || runtime.update.state === 'checking'}
                >
                  {runtime.update.state === 'checking' ? 'Checking...' : 'Check for Updates'}
                </button>
                <button
                  onClick={handleInstallUpdate}
                  disabled={runtime.update.state !== 'downloaded'}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition disabled:opacity-40"
                >
                  Install Downloaded Update
                </button>
              </div>
              {runtime.update.lastCheckedAt && (
                <div className="text-[11px] text-zinc-500">
                  Last checked: {new Date(runtime.update.lastCheckedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-200">Build details</div>
            <div className="mt-2 grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
              <div>Build: {runtime.diagnostics.packaged ? 'Packaged release' : 'Development'}</div>
              <div>App ID: {runtime.diagnostics.appId}</div>
              <div>Platform: {runtime.diagnostics.platform}</div>
              <div className="break-all">Logs: {runtime.diagnostics.mainLogPath}</div>
              <div className="break-all">Backend log: {runtime.diagnostics.backendLogPath}</div>
              <div className="break-all">User data: {runtime.diagnostics.userDataPath}</div>
              <div className="break-all">Models: {runtime.diagnostics.modelsDir}</div>
              <div className="break-all">Voices: {runtime.diagnostics.voicesDir}</div>
              <div className="break-all">Repository: {runtime.diagnostics.repositoryUrl}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleOpenUserData}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
              >
                Open User Data
              </button>
              <button
                onClick={handleOpenModelsDir}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
              >
                Open Models
              </button>
              <button
                onClick={handleOpenVoicesDir}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
              >
                Open Voices
              </button>
              <button
                onClick={handleRevealBackendBinary}
                disabled={!runtime.diagnostics.backendPath}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition disabled:opacity-40"
              >
                Reveal Backend Binary
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">About & Privacy</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Release-facing metadata and the app's local-first privacy model.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
            Nur keeps your library, voice references, downloaded models, and playback state on
            your machine. Network access is only used for model downloads and update checks.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-200">Project</div>
              <a
                href={runtime.diagnostics.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block break-all text-xs text-emerald-300 hover:text-emerald-200"
              >
                {runtime.diagnostics.repositoryUrl}
              </a>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-sm font-semibold text-zinc-200">License</div>
              <div className="mt-2 text-xs text-zinc-400">
                MIT. Keep third-party notices and model licenses with your release build.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
