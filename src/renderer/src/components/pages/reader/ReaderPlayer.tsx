import {
  FiChevronLeft,
  FiChevronRight,
  FiCrosshair,
  FiList,
  FiLoader,
  FiPause,
  FiPlay,
  FiSliders,
  FiStopCircle
} from 'react-icons/fi'
import Tooltip from '../../ui/Tooltip'
import type { ReaderPlayerTheme } from './readerThemes'

const PLAYER_WAVEFORM_HEIGHTS = [10, 15, 21, 13, 18, 24, 16, 20, 12, 19, 14, 17]

interface PlaybackBufferState {
  active: boolean
  engine: string | null
  progress: number
  readySeconds: number
  targetSeconds: number
  label: string
  detail: string
}

interface ReaderPlayerProps {
  buffering: PlaybackBufferState
  isPlaying: boolean
  isPaused: boolean
  status: string
  isCompactHeight: boolean
  playerTheme: ReaderPlayerTheme
  progressFillClassName: string
  canGoPrev: boolean
  canGoNext: boolean
  onPrimaryAction: () => void
  onJumpToHighlight: () => void
  onToggleAppearance: () => void
  onToggleToc: () => void
  onPrevPage: () => void
  onNextPage: () => void
  onStop: () => void
}

export function ReaderPlayer({
  buffering,
  isPlaying,
  isPaused,
  status,
  isCompactHeight,
  playerTheme,
  progressFillClassName,
  canGoPrev,
  canGoNext,
  onPrimaryAction,
  onJumpToHighlight,
  onToggleAppearance,
  onToggleToc,
  onPrevPage,
  onNextPage,
  onStop
}: ReaderPlayerProps) {
  const bufferingPercent = Math.round(buffering.progress * 100)
  const bufferingReadyLabel =
    buffering.targetSeconds > 0
      ? `${Math.round(buffering.readySeconds)}s of ${Math.round(buffering.targetSeconds)}s ready`
      : ''
  const isPreparingNarration = buffering.active && buffering.engine === 'chatterbox'
  const primaryPlayerLabel = buffering.active
    ? 'Cancel narration preparation'
    : isPlaying && !isPaused
      ? 'Pause playback'
      : 'Start playback'
  const secondaryButtonSize = isCompactHeight ? 'h-9 w-9' : 'h-8 w-8 lg:h-9 lg:w-9'

  return (
    <div
      className={`${
        isCompactHeight ? 'sticky bottom-4' : 'fixed bottom-6'
      } inset-x-0 z-50 flex justify-center px-4`}
    >
      <div className="w-full max-w-180 flex flex-col gap-3">
        {buffering.active && (
          <div
            className={`rounded-3xl border backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.32)] px-5 py-4 ${playerTheme.shell}`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`mt-0.5 h-10 w-10 rounded-full border flex items-center justify-center ${playerTheme.iconButton}`}
                aria-hidden="true"
              >
                <FiLoader className="animate-spin text-base" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-[0.2em] uppercase opacity-70">
                      {buffering.label}
                    </div>
                    <p className="mt-1 text-sm opacity-85 max-w-2xl">{buffering.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-semibold ${playerTheme.statusValue}`}>
                      {bufferingPercent}%
                    </div>
                    <div className={`text-[11px] ${playerTheme.statusLabel}`}>
                      {bufferingReadyLabel}
                    </div>
                  </div>
                </div>
                <div className={`mt-3 h-2 rounded-full overflow-hidden ${playerTheme.separator}`}>
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ease-out ${progressFillClassName}`}
                    style={{ width: `${Math.max(6, bufferingPercent)}%` }}
                  />
                </div>
                {isPreparingNarration && (
                  <p className={`mt-2 text-xs ${playerTheme.statusLabel}`}>
                    First start is a little slower so the rest of the narration can stay smooth.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          className={`w-full backdrop-blur-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-all ${playerTheme.shell} ${
            isCompactHeight
              ? 'rounded-2xl px-4 py-2 flex items-center gap-3'
              : 'rounded-[2rem] px-4 py-3 flex flex-wrap items-center gap-3 lg:rounded-full lg:flex-nowrap lg:gap-4 lg:pl-4 lg:pr-6'
          }`}
        >
          <Tooltip label={primaryPlayerLabel}>
            <button
              onClick={onPrimaryAction}
              className={`rounded-full flex items-center justify-center shadow-lg transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                playerTheme.button
              } ${isCompactHeight ? 'w-10 h-10' : 'w-12 h-12'}`}
              aria-label={primaryPlayerLabel}
              aria-pressed={isPlaying && !isPaused && !buffering.active}
            >
              {buffering.active ? (
                <FiLoader className={`${isCompactHeight ? 'text-base' : 'text-xl'} animate-spin`} />
              ) : isPlaying && !isPaused ? (
                <FiPause className={isCompactHeight ? 'text-base' : 'text-xl'} />
              ) : (
                <FiPlay className={isCompactHeight ? 'text-base' : 'text-xl'} />
              )}
            </button>
          </Tooltip>

          <div
            className={`flex-col gap-1 flex-1 min-w-30 ${
              isCompactHeight ? 'flex max-w-40' : 'hidden lg:flex max-w-55'
            }`}
          >
            <div className="h-6 flex items-center gap-1 opacity-50">
              {PLAYER_WAVEFORM_HEIGHTS.map((height, index) => (
                <div
                  key={index}
                  className={`w-1 ${playerTheme.wave} rounded-full transition-all duration-300 ${
                    isPlaying && !isPaused && !buffering.active ? 'animate-pulse' : ''
                  }`}
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          </div>

          <div
            className={`flex items-center gap-3 ${
              isCompactHeight
                ? `border-l pl-3 ${playerTheme.separator}`
                : `order-3 w-full justify-between border-t pt-3 lg:order-none lg:w-auto lg:justify-start lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0 ${playerTheme.separator}`
            }`}
          >
            <div className="text-xs">
              <div className={playerTheme.statusLabel}>Status</div>
              <div className={`font-mono ${playerTheme.statusValue}`}>
                {buffering.active ? `${bufferingPercent}% ready` : status}
              </div>
            </div>
          </div>

          <div
            className={`flex items-center justify-end gap-1.5 sm:gap-2 ${
              isCompactHeight ? 'ml-auto' : 'ml-auto flex-wrap'
            }`}
          >
            <Tooltip label="Jump to current highlighted passage">
              <button
                onClick={onJumpToHighlight}
                className={`${secondaryButtonSize} rounded-full border transition flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
                aria-label="Jump to current highlighted passage"
              >
                <FiCrosshair className="text-sm" />
              </button>
            </Tooltip>
            <Tooltip label="Appearance settings">
              <button
                onClick={onToggleAppearance}
                className={`${secondaryButtonSize} rounded-full border transition flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
                aria-label="Open appearance settings"
              >
                <FiSliders className="text-sm" />
              </button>
            </Tooltip>
            <Tooltip label="Table of contents">
              <button
                onClick={onToggleToc}
                className={`${secondaryButtonSize} rounded-full border transition flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
                aria-label="Toggle table of contents"
              >
                <FiList className="text-sm" />
              </button>
            </Tooltip>
            <Tooltip label="Previous page">
              <button
                onClick={onPrevPage}
                disabled={!canGoPrev}
                className={`${secondaryButtonSize} rounded-full border transition flex items-center justify-center disabled:opacity-40 hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
                aria-label="Previous page"
              >
                <FiChevronLeft className="text-sm" />
              </button>
            </Tooltip>
            <Tooltip label="Next page">
              <button
                onClick={onNextPage}
                disabled={!canGoNext}
                className={`${secondaryButtonSize} rounded-full border transition flex items-center justify-center disabled:opacity-40 hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
                aria-label="Next page"
              >
                <FiChevronRight className="text-sm" />
              </button>
            </Tooltip>
            <Tooltip label="Stop playback">
              <button
                onClick={onStop}
                className={`${secondaryButtonSize} rounded-full border transition flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
                aria-label="Stop playback"
              >
                <FiStopCircle className="text-sm" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
