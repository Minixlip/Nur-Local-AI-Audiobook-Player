import React from 'react'

type AppErrorBoundaryState = {
  hasError: boolean
  message: string
}

export default class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: ''
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unknown renderer error'
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Renderer crash', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleRevealLogs = async () => {
    try {
      await window.api.revealLogs()
    } catch (error) {
      console.error(error)
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Nur</div>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-100">The renderer crashed.</h1>
          <p className="mt-3 text-sm text-zinc-400">
            The app hit an unexpected UI error. You can reload immediately or reveal the log file
            to inspect what failed.
          </p>
          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {this.state.message}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={this.handleReload}
              className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Reload App
            </button>
            <button
              onClick={this.handleRevealLogs}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-white/15"
            >
              Reveal Logs
            </button>
          </div>
        </div>
      </div>
    )
  }
}
