import { useEffect, useState } from 'react'
import { useReaderSettings } from '../../../hooks/useReaderSettings'
import {
  usePlaybackPreferences,
  type PlaybackQualityMode
} from '../../../hooks/usePlaybackPreferences'
import { useRuntimeStatus } from '../../../hooks/useRuntimeStatus'
import { useTtsStatus } from '../../../hooks/useTtsStatus'
import { setStoredTtsEngine, type TtsEngine } from '../../../utils/tts'
import {
  clampTtsSpeed,
  PerformanceSection,
  VoiceDeliverySection
} from './SettingsPlaybackSections'
import {
  AboutPrivacySection,
  DiagnosticsSection,
  ModelStorageSection
} from './SettingsDiagnosticsSections'
import Tooltip from '../../ui/Tooltip'

export default function Settings(): React.JSX.Element {
  const { settings } = useReaderSettings()
  const { preferences, updatePreference, resetPreferences } = usePlaybackPreferences()
  const { engine, status } = useTtsStatus(900)
  const runtime = useRuntimeStatus(2500)
  const [customVoicePath, setCustomVoicePath] = useState<string>('')

  const piperStatus = status.piper
  const chatterboxStatus = status.chatterbox
  const piperPath = piperStatus.path || ''
  const piperProgress = piperStatus.progress ?? 0
  const { lowEndMode } = preferences

  useEffect(() => {
    const savedVoice = localStorage.getItem('custom_voice_path') || ''

    setCustomVoicePath(savedVoice)
  }, [])

  const handleDownload = async (engineToPrepare: TtsEngine, event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (engineToPrepare === 'chatterbox') {
      setStoredTtsEngine('chatterbox')
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

  const handlePremiumQualityModeChange = (mode: PlaybackQualityMode) => {
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

  const premiumEngineName = 'Chatterbox'

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
                engine === 'chatterbox'
                  ? 'bg-zinc-900/40 border-white/20 shadow-lg'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <Tooltip label={`Select ${premiumEngineName}`} className="w-full">
                <button
                  onClick={() => handleEngineChange('chatterbox')}
                  className="w-full px-5 py-4 text-left flex justify-between items-center gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-lg flex items-center gap-2 text-zinc-100">
                      {premiumEngineName}
                      <span className="text-xs bg-zinc-800 text-zinc-200 px-2 py-0.5 rounded border border-white/10">
                        HQ
                      </span>
                    </div>
                    <div className="text-sm text-zinc-300 mt-1">
                      Realistic, emotive local narration. Supports cloning.
                      <span className="ml-2 text-yellow-500 text-xs font-mono">Requires GPU</span>
                    </div>
                    {status.device && (
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Backend device: {status.device.toUpperCase()}
                      </div>
                    )}
                    {chatterboxStatus.message && !chatterboxStatus.ready && (
                      <div className="text-xs text-zinc-400 mt-2">{chatterboxStatus.message}</div>
                    )}
                  </div>
                  {chatterboxStatus.ready ? (
                    engine === 'chatterbox' ? (
                      <div className="h-6 w-6 rounded-full bg-white shadow-inner shadow-black/20"></div>
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-white/20"></div>
                    )
                  ) : chatterboxStatus.state === 'preparing' ||
                    chatterboxStatus.state === 'downloading' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                        Preparing
                      </span>
                      <div className="animate-spin h-5 w-5 border-2 border-white/70 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <div className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-200">
                      {chatterboxStatus.state === 'error' ? 'Retry' : 'Download & Use'}
                    </div>
                  )}
                </button>
              </Tooltip>

              {engine === 'chatterbox' && chatterboxStatus.ready && (
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
                        Using the built-in {premiumEngineName} voice. Upload a short WAV file
                        (6-10s) to clone a voice.
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

        <VoiceDeliverySection
          theme={settings.theme}
          premiumEngineName={premiumEngineName}
          preferences={preferences}
          onTtsSpeedChange={handleTtsSpeedChange}
          onPremiumQualityModeChange={handlePremiumQualityModeChange}
        />

        <PerformanceSection
          theme={settings.theme}
          preferences={preferences}
          onResetPreferences={resetPreferences}
          onLowEndToggle={handleLowEndToggle}
          onInitialBufferChange={handleInitialBufferChange}
          onSteadyBufferChange={handleSteadyBufferChange}
          onCrossfadeChange={handleCrossfadeChange}
        />

        <ModelStorageSection
          piperPath={piperPath}
          premiumEngineName={premiumEngineName}
          onRevealPiperPath={handleRevealPiperPath}
        />

        <DiagnosticsSection
          runtime={runtime}
          status={status}
          onRevealLogs={handleRevealLogs}
          onRestartBackend={handleRestartBackend}
          onCheckUpdates={handleCheckUpdates}
          onInstallUpdate={handleInstallUpdate}
          onOpenUserData={handleOpenUserData}
          onOpenModelsDir={handleOpenModelsDir}
          onOpenVoicesDir={handleOpenVoicesDir}
          onRevealBackendBinary={handleRevealBackendBinary}
        />

        <AboutPrivacySection runtime={runtime} />
      </div>
    </div>
  )
}
