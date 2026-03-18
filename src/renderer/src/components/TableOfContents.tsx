import { TocItem } from '../types/book'

interface TocProps {
  items: TocItem[]
  onChapterClick: (pageIndex: number) => void
  currentVisualPage: number
  isOpen: boolean
  onClose: () => void
}

export const TableOfContents: React.FC<TocProps> = ({
  items,
  onChapterClick,
  currentVisualPage,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null

  return (
    <div className="overlay-fade-in absolute inset-0 z-50 flex bg-black/35 backdrop-blur-xl" onClick={onClose}>
      <aside
        className="panel-slide-in-left flex h-full w-full max-w-[420px] flex-col border-r border-white/10 bg-zinc-950/88 shadow-[24px_0_80px_rgba(0,0,0,0.38)]"
        onClick={(event) => event.stopPropagation()}
        aria-label="Table of contents"
      >
        <div className="border-b border-white/10 px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Navigator</div>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Contents</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Jump by section. The current chapter stays highlighted as playback or reading moves.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close table of contents"
            >
              Close
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              Page {currentVisualPage + 1}
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              {items.length} chapters
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 && (
            <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-6 text-center text-sm text-zinc-400">
              This book does not include a navigable table of contents.
            </div>
          )}

          <div className="space-y-2">
            {items.map((item, idx) => {
              const nextItem = items[idx + 1]
              const isActive =
                currentVisualPage >= item.pageIndex &&
                (!nextItem || currentVisualPage < nextItem.pageIndex)

              return (
                <button
                  key={`${item.label}-${idx}`}
                  onClick={() => {
                    onChapterClick(item.pageIndex)
                    onClose()
                  }}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                    isActive
                      ? 'border-white/20 bg-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.28)]'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div
                        className={`text-[11px] uppercase tracking-[0.22em] ${
                          isActive ? 'text-emerald-300' : 'text-zinc-500'
                        }`}
                      >
                        {isActive ? 'Current Chapter' : `Chapter ${idx + 1}`}
                      </div>
                      <div
                        className={`mt-2 line-clamp-2 text-sm font-medium leading-6 ${
                          isActive ? 'text-zinc-50' : 'text-zinc-300'
                        }`}
                      >
                        {item.label}
                      </div>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                        isActive
                          ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                          : 'border-white/10 bg-white/[0.03] text-zinc-400'
                      }`}
                    >
                      {item.pageIndex + 1}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </aside>
    </div>
  )
}
