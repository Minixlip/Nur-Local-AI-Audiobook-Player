import type { RuntimeStatusSnapshot } from '../../../../../shared/runtime'
import type { TtsStatusSnapshot } from '../../../../../shared/tts'
import Tooltip from '../../ui/Tooltip'

interface ModelStorageSectionProps {
  piperPath: string
  premiumEngineName: string
  onRevealPiperPath: () => void | Promise<void>
}

export function ModelStorageSection({
  piperPath,
  premiumEngineName,
  onRevealPiperPath
}: ModelStorageSectionProps) {
  return (
    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">Model Storage</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Where models are stored on disk. Useful for backups and cleanup.
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-200">Piper model path</div>
        <div className="text-xs text-zinc-400 mt-1 break-all">
          {piperPath ? piperPath : 'Not downloaded yet.'}
        </div>
        <div className="mt-3">
          <Tooltip label={piperPath ? 'Reveal in File Explorer' : 'Download Piper to enable'}>
            <button
              onClick={onRevealPiperPath}
              disabled={!piperPath}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 transition"
            >
              Reveal in Explorer
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <div className="text-sm font-semibold text-zinc-200">{premiumEngineName} cache location</div>
        <div className="text-xs text-zinc-400 mt-1">
          Stored by the TTS engine in the user cache directory. Typical path:
        </div>
        <div className="text-xs text-zinc-500 mt-1 break-all">
          Windows: %USERPROFILE%\.cache\tts - macOS/Linux: ~/.cache/tts
        </div>
      </div>
    </div>
  )
}

interface DiagnosticsSectionProps {
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
  return (
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
              onClick={onRestartBackend}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
            >
              Restart Engine
            </button>
            <button
              onClick={onRevealLogs}
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
              onClick={onCheckUpdates}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white text-black hover:bg-zinc-200 transition disabled:opacity-40"
              disabled={!runtime.update.supported || runtime.update.state === 'checking'}
            >
              {runtime.update.state === 'checking' ? 'Checking...' : 'Check for Updates'}
            </button>
            <button
              onClick={onInstallUpdate}
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
            onClick={onOpenUserData}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
          >
            Open User Data
          </button>
          <button
            onClick={onOpenModelsDir}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
          >
            Open Models
          </button>
          <button
            onClick={onOpenVoicesDir}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
          >
            Open Voices
          </button>
          <button
            onClick={onRevealBackendBinary}
            disabled={!runtime.diagnostics.backendPath}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition disabled:opacity-40"
          >
            Reveal Backend Binary
          </button>
        </div>
      </div>
    </div>
  )
}

interface AboutPrivacySectionProps {
  runtime: RuntimeStatusSnapshot
}

export function AboutPrivacySection({ runtime }: AboutPrivacySectionProps) {
  return (
    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">About & Privacy</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Release-facing metadata and the app&apos;s local-first privacy model.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
        Nur keeps your library, voice references, downloaded models, and playback state on your
        machine. Network access is only used for model downloads and update checks.
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
  )
}
