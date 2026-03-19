import type { CSSProperties } from 'react'
import type { PlaybackPreferences, PlaybackQualityMode } from '../../../hooks/usePlaybackPreferences'
import Tooltip from '../../ui/Tooltip'

type ReaderThemeMode = 'light' | 'sepia' | 'dark'

export const MIN_TTS_SPEED = 0.85
export const MAX_TTS_SPEED = 1.15
export const clampTtsSpeed = (value: number) => Math.min(MAX_TTS_SPEED, Math.max(MIN_TTS_SPEED, value))

const getSliderFill = (theme: ReaderThemeMode) => {
  if (theme === 'light') return '#1f2937'
  if (theme === 'sepia') return '#6b4f2a'
  return '#ffffff'
}

const getSliderThumbBorder = (theme: ReaderThemeMode) => {
  if (theme === 'light') return 'rgba(31,41,55,0.7)'
  if (theme === 'sepia') return 'rgba(107,79,42,0.7)'
  return 'rgba(255,255,255,0.7)'
}

const getSliderGlow = (theme: ReaderThemeMode) => {
  if (theme === 'light') return 'rgba(31,41,55,0.15)'
  if (theme === 'sepia') return 'rgba(107,79,42,0.15)'
  return 'rgba(255,255,255,0.18)'
}

const getSliderPercent = (value: number, min: number, max: number) => {
  const clamped = Math.min(max, Math.max(min, value))
  return `${((clamped - min) / (max - min)) * 100}%`
}

const getSliderStyle = (theme: ReaderThemeMode, value: number, min: number, max: number) =>
  ({
    '--slider-fill': getSliderFill(theme),
    '--slider-percent': getSliderPercent(value, min, max),
    '--slider-thumb-border': getSliderThumbBorder(theme),
    '--slider-glow': getSliderGlow(theme)
  }) as CSSProperties

interface VoiceDeliverySectionProps {
  theme: ReaderThemeMode
  premiumEngineName: string
  preferences: PlaybackPreferences
  onTtsSpeedChange: (value: number) => void
  onPremiumQualityModeChange: (mode: PlaybackQualityMode) => void
}

export function VoiceDeliverySection({
  theme,
  premiumEngineName,
  preferences,
  onTtsSpeedChange,
  onPremiumQualityModeChange
}: VoiceDeliverySectionProps) {
  const { lowEndMode, speechRate, qualityMode } = preferences
  const readingPaceLabel =
    speechRate < 0.95 ? 'Measured' : speechRate > 1.05 ? 'Brisk' : 'Natural'

  return (
    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Voice Delivery</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Control pacing and how much {premiumEngineName} prioritizes natural phrasing over speed.
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
              onChange={(event) => onTtsSpeedChange(Number(event.target.value))}
              className="mt-3 w-full glass-slider"
              style={getSliderStyle(theme, speechRate, MIN_TTS_SPEED, MAX_TTS_SPEED)}
            />
          </Tooltip>
          <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
            <span>0.85x</span>
            <span>Natural</span>
            <span>1.15x</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-4">
          <div className="text-sm font-medium text-zinc-200">{premiumEngineName} quality preset</div>
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
                  onClick={() => onPremiumQualityModeChange(option.value)}
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
              Low-end mode is on, so playback will still favor stability over maximum {premiumEngineName} quality.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface PerformanceSectionProps {
  theme: ReaderThemeMode
  preferences: PlaybackPreferences
  onResetPreferences: () => void
  onLowEndToggle: () => void
  onInitialBufferChange: (value: number) => void
  onSteadyBufferChange: (value: number) => void
  onCrossfadeChange: (value: number) => void
}

export function PerformanceSection({
  theme,
  preferences,
  onResetPreferences,
  onLowEndToggle,
  onInitialBufferChange,
  onSteadyBufferChange,
  onCrossfadeChange
}: PerformanceSectionProps) {
  const { lowEndMode, initialBuffer, steadyBuffer, crossfadeMs } = preferences

  return (
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
            onClick={onResetPreferences}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300 transition hover:bg-white/10"
          >
            Reset Audio
          </button>
          <Tooltip label="Toggle low-end device mode">
            <button
              onClick={onLowEndToggle}
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
                onChange={(event) => onInitialBufferChange(Number(event.target.value))}
                className="mt-3 w-full glass-slider"
                style={getSliderStyle(theme, initialBuffer, 1, 6)}
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
                onChange={(event) => onSteadyBufferChange(Number(event.target.value))}
                className="mt-3 w-full glass-slider"
                style={getSliderStyle(theme, steadyBuffer, 3, 14)}
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
                onChange={(event) => onCrossfadeChange(Number(event.target.value))}
                className="mt-3 w-full glass-slider"
                style={getSliderStyle(theme, crossfadeMs, 0, 120)}
              />
            </Tooltip>
          </div>
        </div>
      </details>
    </div>
  )
}
