import type { RuntimeStatusSnapshot } from '../../../../../shared/runtime'
import type { TtsStatusSnapshot } from '../../../../../shared/tts'
import { getAppTheme, type AppThemeMode } from '../../../theme/appTheme'
import Tooltip from '../../ui/Tooltip'

interface ModelStorageSectionProps {
  theme: AppThemeMode
  piperPath: string
  premiumEngineName: string
  onRevealPiperPath: () => void | Promise<void>
}

export function ModelStorageSection({
  theme,
  piperPath,
  premiumEngineName,
  onRevealPiperPath
}: ModelStorageSectionProps) {
  const chrome = getAppTheme(theme)
  return (
    <div className={`p-6 rounded-2xl border backdrop-blur-xl space-y-4 ${chrome.card}`}>
      <div>
        <h2 className={`text-xl font-semibold ${chrome.title}`}>Model Storage</h2>
        <p className={`text-sm mt-1 ${chrome.muted}`}>
          Where models are stored on disk. Useful for backups and cleanup.
        </p>
      </div>
      <div className={`rounded-xl border px-4 py-3 ${chrome.insetCard}`}>
        <div className={`text-sm font-semibold ${chrome.body}`}>Piper model path</div>
        <div className={`text-xs mt-1 break-all ${chrome.muted}`}>
          {piperPath ? piperPath : 'Not downloaded yet.'}
        </div>
        <div className="mt-3">
          <Tooltip label={piperPath ? 'Reveal in File Explorer' : 'Download Piper to enable'}>
            <button
              onClick={onRevealPiperPath}
              disabled={!piperPath}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-40 ${chrome.secondaryButton}`}
            >
              Reveal in Explorer
            </button>
          </Tooltip>
        </div>
      </div>
      <div className={`rounded-xl border px-4 py-3 ${chrome.insetCard}`}>
        <div className={`text-sm font-semibold ${chrome.body}`}>{premiumEngineName} cache location</div>
        <div className={`text-xs mt-1 ${chrome.muted}`}>
          Stored by the TTS engine in the user cache directory. Typical path:
        </div>
        <div className={`text-xs mt-1 break-all ${chrome.subtle}`}>
          Windows: %USERPROFILE%\.cache\tts - macOS/Linux: ~/.cache/tts
        </div>
      </div>
    </div>
  )
}

interface DiagnosticsSectionProps {
  theme: AppThemeMode
  runtime: RuntimeStatusSnapshot
  status: TtsStatusSnapshot
  onRevealLogs: () => void | Promise<void>
  onRestartBackend: () => void | Promise<void>
  onCheckUpdates: () => void | Promise<void>
  onInstallUpdate: () => void | Promise<void>
  onOpenUserData: () => void | Promise<void>
  onOpenModelsDir: () => void | Promise<void>
  onOpenVoicesDir: () => void | Promise<void>
  onRevealBackendBinary: () => void | Promise<void>
}

export function DiagnosticsSection({
  theme,
  runtime,
  status,
  onRevealLogs,
  onRestartBackend,
  onCheckUpdates,
  onInstallUpdate,
  onOpenUserData,
  onOpenModelsDir,
  onOpenVoicesDir,
  onRevealBackendBinary
}: DiagnosticsSectionProps) {
  const chrome = getAppTheme(theme)
  return (
    <div className={`p-6 rounded-2xl border backdrop-blur-xl space-y-4 ${chrome.card}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-semibold ${chrome.title}`}>App & Diagnostics</h2>
          <p className={`text-sm mt-1 ${chrome.muted}`}>
            Release status, backend recovery, logs, and update controls.
          </p>
        </div>
        <div className={`text-xs uppercase tracking-[0.2em] ${chrome.subtle}`}>
          v{runtime.diagnostics.appVersion}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`rounded-xl border px-4 py-3 space-y-3 ${chrome.insetCard}`}>
          <div>
            <div className={`text-sm font-semibold ${chrome.body}`}>Backend status</div>
            <div className={`text-xs mt-1 ${chrome.muted}`}>
              {status.backendOk ? 'Nur engine is reachable.' : runtime.diagnostics.backendMessage}
            </div>
          </div>
          <div className={`text-xs break-all ${chrome.subtle}`}>
            {runtime.diagnostics.backendPath || 'Backend executable path unavailable.'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onRestartBackend}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${chrome.secondaryButton}`}
            >
              Restart Engine
            </button>
            <button
              onClick={onRevealLogs}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${chrome.secondaryButton}`}
            >
              Reveal Logs
            </button>
          </div>
        </div>

        <div className={`rounded-xl border px-4 py-3 space-y-3 ${chrome.insetCard}`}>
          <div>
            <div className={`text-sm font-semibold ${chrome.body}`}>Updates</div>
            <div className={`text-xs mt-1 ${chrome.muted}`}>
              {runtime.update.message ||
                (runtime.update.supported
                  ? 'Ready to check for updates.'
                  : 'Updates are only available in packaged builds.')}
            </div>
          </div>
          {runtime.update.progress !== null && (
            <div className={`h-2 w-full overflow-hidden rounded-full ${chrome.progressTrack}`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${chrome.overlayProgressFill}`}
                style={{ width: `${runtime.update.progress}%` }}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onCheckUpdates}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-40 ${chrome.primaryButton}`}
              disabled={!runtime.update.supported || runtime.update.state === 'checking'}
            >
              {runtime.update.state === 'checking' ? 'Checking...' : 'Check for Updates'}
            </button>
            <button
              onClick={onInstallUpdate}
              disabled={runtime.update.state !== 'downloaded'}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-40 ${chrome.secondaryButton}`}
            >
              Install Downloaded Update
            </button>
          </div>
          {runtime.update.lastCheckedAt && (
            <div className={`text-[11px] ${chrome.subtle}`}>
              Last checked: {new Date(runtime.update.lastCheckedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className={`rounded-xl border px-4 py-3 ${chrome.insetCard}`}>
        <div className={`text-sm font-semibold ${chrome.body}`}>Build details</div>
        <div className={`mt-2 grid gap-2 text-xs md:grid-cols-2 ${chrome.muted}`}>
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
            onClick={onOpenUserData}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${chrome.secondaryButton}`}
          >
            Open User Data
          </button>
          <button
            onClick={onOpenModelsDir}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${chrome.secondaryButton}`}
          >
            Open Models
          </button>
          <button
            onClick={onOpenVoicesDir}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${chrome.secondaryButton}`}
          >
            Open Voices
          </button>
          <button
            onClick={onRevealBackendBinary}
            disabled={!runtime.diagnostics.backendPath}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition disabled:opacity-40 ${chrome.secondaryButton}`}
          >
            Reveal Backend Binary
          </button>
        </div>
      </div>
    </div>
  )
}

interface AboutPrivacySectionProps {
  theme: AppThemeMode
  runtime: RuntimeStatusSnapshot
}

export function AboutPrivacySection({ theme, runtime }: AboutPrivacySectionProps) {
  const chrome = getAppTheme(theme)
  return (
    <div className={`p-6 rounded-2xl border backdrop-blur-xl space-y-4 ${chrome.card}`}>
      <div>
        <h2 className={`text-xl font-semibold ${chrome.title}`}>About & Privacy</h2>
        <p className={`text-sm mt-1 ${chrome.muted}`}>
          Release-facing metadata and the app&apos;s local-first privacy model.
        </p>
      </div>

      <div className={`rounded-xl border px-4 py-3 text-sm ${chrome.insetCard} ${chrome.body}`}>
        Nur keeps your library, voice references, downloaded models, and playback state on your
        machine. Network access is only used for model downloads and update checks.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={`rounded-xl border px-4 py-3 ${chrome.insetCard}`}>
          <div className={`text-sm font-semibold ${chrome.body}`}>Project</div>
          <a
            href={runtime.diagnostics.repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-2 inline-block break-all text-xs ${chrome.link}`}
          >
            {runtime.diagnostics.repositoryUrl}
          </a>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${chrome.insetCard}`}>
          <div className={`text-sm font-semibold ${chrome.body}`}>License</div>
          <div className={`mt-2 text-xs ${chrome.muted}`}>
            MIT. Keep third-party notices and model licenses with your release build.
          </div>
        </div>
      </div>
    </div>
  )
}
