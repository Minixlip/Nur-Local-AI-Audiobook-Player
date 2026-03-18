import { ReaderSettings } from '../hooks/useReaderSettings'

interface Props {
  settings: ReaderSettings
  updateSetting: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void
  isOpen: boolean
  onClose: () => void
}

const getPreviewSurfaceClass = (theme: ReaderSettings['theme']) => {
  switch (theme) {
    case 'light':
      return 'bg-[#fbfaf6] border-black/10 text-zinc-900'
    case 'sepia':
      return 'bg-[#f4ecd8] border-black/10 text-[#3b2f1f]'
    default:
      return 'bg-[#17191d] border-white/10 text-zinc-100'
  }
}

const getPreviewMetaClass = (theme: ReaderSettings['theme']) => {
  switch (theme) {
    case 'light':
      return 'text-zinc-500'
    case 'sepia':
      return 'text-[#72614f]'
    default:
      return 'text-zinc-400'
  }
}

const getFontFamilyClass = (fontFamily: ReaderSettings['fontFamily']) => {
  switch (fontFamily) {
    case 'serif':
      return 'font-serif'
    case 'mono':
      return 'font-mono'
    default:
      return 'font-sans'
  }
}

export default function AppearanceMenu({
  settings,
  updateSetting,
  isOpen,
  onClose
}: Props): React.JSX.Element | null {
  if (!isOpen) return null

  const previewSurfaceClass = getPreviewSurfaceClass(settings.theme)
  const previewMetaClass = getPreviewMetaClass(settings.theme)
  const fontFamilyClass = getFontFamilyClass(settings.fontFamily)

  return (
    <div
      className="overlay-fade-in absolute inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="panel-slide-in-right flex h-full w-full max-w-[430px] flex-col border-l border-white/10 bg-zinc-950/88 shadow-[-24px_0_80px_rgba(0,0,0,0.38)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">
                Reader Controls
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Appearance</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">
                Tune the page look live while you read. The changes are saved automatically.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close appearance menu"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className={`rounded-[26px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] ${previewSurfaceClass}`}>
            <div className={`text-[11px] uppercase tracking-[0.24em] ${previewMetaClass}`}>
              Live Preview
            </div>
            <div
              className={`mt-4 text-balance leading-relaxed ${fontFamilyClass}`}
              style={{ fontSize: `${Math.max(92, settings.fontSize * 0.72)}%`, lineHeight: settings.lineHeight }}
            >
              Joost adjusted the set of his coat and paused, listening for the next line to arrive
              with a little more room and calm.
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-semibold text-zinc-100">Theme</div>
              <div className="mt-1 text-xs leading-5 text-zinc-400">
                Choose the reading atmosphere that best matches the book and time of day.
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { id: 'light', label: 'Light', shell: 'bg-white text-black' },
                  { id: 'sepia', label: 'Sepia', shell: 'bg-[#f4ecd8] text-[#5b4636]' },
                  { id: 'dark', label: 'Dark', shell: 'bg-[#141416] text-white' }
                ].map((theme) => {
                  const active = settings.theme === theme.id
                  return (
                    <button
                      key={theme.id}
                      onClick={() => updateSetting('theme', theme.id as ReaderSettings['theme'])}
                      className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                        active
                          ? 'border-white/30 ring-2 ring-white/15'
                          : 'border-white/10 opacity-85 hover:opacity-100'
                      } ${theme.shell}`}
                    >
                      {theme.label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-100">Font Size</div>
                <div className="text-sm font-semibold text-zinc-300">{settings.fontSize}%</div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-2">
                <button
                  onClick={() => updateSetting('fontSize', Math.max(80, settings.fontSize - 10))}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-sm text-zinc-200 transition hover:bg-white/10"
                  aria-label="Decrease font size"
                >
                  A-
                </button>
                <div className="flex-1 text-center text-sm font-medium text-zinc-200">
                  Reading scale
                </div>
                <button
                  onClick={() => updateSetting('fontSize', Math.min(200, settings.fontSize + 10))}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-sm text-zinc-200 transition hover:bg-white/10"
                  aria-label="Increase font size"
                >
                  A+
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-semibold text-zinc-100">Typeface</div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { id: 'sans', label: 'Sans' },
                  { id: 'serif', label: 'Serif' },
                  { id: 'mono', label: 'Mono' }
                ].map((font) => {
                  const active = settings.fontFamily === font.id
                  return (
                    <button
                      key={font.id}
                      onClick={() =>
                        updateSetting('fontFamily', font.id as ReaderSettings['fontFamily'])
                      }
                      className={`rounded-2xl border px-3 py-3 text-sm transition ${
                        active
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      {font.label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-semibold text-zinc-100">Spacing</div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[1.4, 1.6, 2.0].map((value) => {
                  const active = settings.lineHeight === value
                  return (
                    <button
                      key={value}
                      onClick={() => updateSetting('lineHeight', value)}
                      className={`rounded-2xl border px-3 py-3 text-sm transition ${
                        active
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
