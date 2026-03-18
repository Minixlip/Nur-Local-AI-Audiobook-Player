import { useEffect, useState } from 'react'
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import { useTtsStatus } from './hooks/useTtsStatus'
import { useRuntimeStatus } from './hooks/useRuntimeStatus'
import { getModelStatusForEngine, isEngineReady, setStoredTtsEngine } from './utils/tts'

/* Pages */
import Library from './components/pages/library/Library'
import Reader from './components/pages/reader/Reader'
import Voice from './components/pages/voice/Voice'
import Settings from './components/pages/settings/Settings'

const routeMeta: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Library',
    description: 'Browse your shelf, resume a book, or import something new.'
  },
  '/voice-market': {
    title: 'Voice Studio',
    description: 'Manage voices, cloning, and TTS preferences.'
  },
  '/settings': {
    title: 'Settings',
    description: 'Tune playback, diagnostics, and release options.'
  }
}

type AppFrameProps = {
  collapsed: boolean
  engine: string
  backendReady: boolean
  backendOk: boolean
  backendState: string
  appVersion: string
  packaged: boolean
  statusMessage: string | null
  backendMessage: string | null
  progress: number | null
  selectedModelState: string
  selectedModelMessage: string | null
  onToggleSidebar: () => void
  onRetry: () => void | Promise<void>
  onRevealLogs: () => void | Promise<void>
  onUsePiper: () => void | Promise<void>
}

function AppFrame({
  collapsed,
  engine,
  backendReady,
  backendOk,
  backendState,
  appVersion,
  packaged,
  statusMessage,
  backendMessage,
  progress,
  selectedModelState,
  selectedModelMessage,
  onToggleSidebar,
  onRetry,
  onRevealLogs,
  onUsePiper
}: AppFrameProps): React.JSX.Element {
  const location = useLocation()
  const meta =
    routeMeta[location.pathname] ||
    (location.pathname.startsWith('/read/')
      ? { title: 'Reader', description: 'Continue reading with synced playback.' }
      : routeMeta['/'])
  const isReaderRoute = location.pathname.startsWith('/read/')

  const overlayHint = () => {
    if (!backendOk) {
      return statusMessage || 'Starting Nur engine...'
    }

    if (engine === 'piper') {
      if (selectedModelState === 'downloading') {
        return `Downloading the default Piper voice... ${Math.round(progress ?? 0)}%`
      }
      if (selectedModelState === 'error') {
        return selectedModelMessage || 'The default Piper download failed.'
      }
      return selectedModelMessage || 'Preparing the default Piper voice...'
    }

    if (selectedModelState === 'preparing' || selectedModelState === 'downloading') {
      return selectedModelMessage || 'Preparing XTTS. This can take several minutes.'
    }
    if (selectedModelState === 'error') {
      return selectedModelMessage || 'XTTS preparation failed.'
    }
    return selectedModelMessage || 'Preparing XTTS...'
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#08090c] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(148,163,184,0.08),transparent_30%),linear-gradient(180deg,rgba(10,10,12,0.92),rgba(6,7,10,1))]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-white/[0.08] blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-48 right-[-8%] h-[420px] w-[520px] rounded-full bg-slate-500/10 blur-[140px]" />

      <div className="relative z-10 flex h-full w-full">
        <Sidebar collapsed={collapsed} onToggleCollapse={onToggleSidebar} />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl">
          {!isReaderRoute && (
            <header className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4 lg:px-8">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">Nur</div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h1 className="text-lg font-semibold text-zinc-50">{meta.title}</h1>
                  <p className="text-sm text-zinc-400">{meta.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]">
                <div
                  className={`rounded-full border px-3 py-1.5 ${
                    backendOk
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                      : 'border-amber-400/20 bg-amber-400/10 text-amber-100'
                  }`}
                >
                  {backendOk ? 'Engine ready' : 'Preparing engine'}
                </div>
                <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-zinc-300 md:block">
                  {engine.toUpperCase()}
                </div>
              </div>
            </header>
          )}

          <div className="relative flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Library />} />
              <Route path="/read/:bookId" element={<Reader />} />
              <Route path="/voice-market" element={<Voice />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>

      {!backendReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/82 backdrop-blur-2xl">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.05] px-8 py-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div
              className={`mx-auto h-12 w-12 rounded-full border-2 ${
                selectedModelState === 'error' || backendState === 'error'
                  ? 'border-red-400/30 border-t-red-400'
                  : 'border-white/20 border-t-emerald-300'
              } animate-spin`}
            />
            <div className="mt-5 text-[11px] uppercase tracking-[0.35em] text-zinc-500">Nur</div>
            <div className="mt-3 text-xl font-semibold text-zinc-50">
              {engine === 'piper' ? 'Preparing your default voice' : 'Preparing XTTS'}
            </div>
            <div className="mt-3 text-sm leading-6 text-zinc-400">{overlayHint()}</div>
            {!backendOk && backendMessage && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-left text-xs leading-5 text-amber-100">
                {backendMessage}
              </div>
            )}
            {engine === 'piper' && selectedModelState === 'downloading' && (
              <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-300 transition-all duration-300"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {(selectedModelState === 'error' || !backendOk) && (
                <button
                  onClick={onRetry}
                  className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  {backendOk ? 'Retry' : 'Restart Engine'}
                </button>
              )}
              {!backendOk && (
                <button
                  onClick={onRevealLogs}
                  className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15"
                >
                  Reveal Logs
                </button>
              )}
              <Link
                to="/settings"
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15"
              >
                Open Settings
              </Link>
              {engine === 'xtts' && (
                <button
                  onClick={onUsePiper}
                  className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15"
                >
                  Use Piper Instead
                </button>
              )}
            </div>
            <div className="mt-5 text-[11px] uppercase tracking-[0.2em] text-white/40">
              v{appVersion} {packaged ? 'packaged' : 'dev'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App(): React.JSX.Element {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { engine, status } = useTtsStatus(800)
  const runtime = useRuntimeStatus(2500)

  const toggleSidebar = () => setIsSidebarCollapsed((prev) => !prev)
  const selectedModel = getModelStatusForEngine(status, engine)
  const backendReady = isEngineReady(status, engine)

  useEffect(() => {
    if (!status.backendOk) return
    if (selectedModel.ready) return
    if (selectedModel.state !== 'missing') return
    window.api.ensureModel(engine).catch(() => {})
  }, [engine, selectedModel.ready, selectedModel.state, status.backendOk])

  const handleRetry = async () => {
    if (!status.backendOk) {
      await window.api.restartBackend()
      return
    }
    await window.api.ensureModel(engine)
  }

  const handleUsePiper = async () => {
    setStoredTtsEngine('piper')
    await window.api.ensureModel('piper')
  }

  const handleRevealLogs = async () => {
    await window.api.revealLogs()
  }

  return (
    <Router>
      <AppFrame
        collapsed={isSidebarCollapsed}
        engine={engine}
        backendReady={backendReady}
        backendOk={status.backendOk}
        backendState={status.backendState}
        appVersion={runtime.diagnostics.appVersion}
        packaged={runtime.diagnostics.packaged}
        statusMessage={status.backendMessage}
        backendMessage={runtime.diagnostics.backendMessage}
        progress={selectedModel.progress}
        selectedModelState={selectedModel.state}
        selectedModelMessage={selectedModel.message}
        onToggleSidebar={toggleSidebar}
        onRetry={handleRetry}
        onRevealLogs={handleRevealLogs}
        onUsePiper={handleUsePiper}
      />
    </Router>
  )
}

export default App
