import type { ReaderSettings } from '../hooks/useReaderSettings'
import { getAppTheme } from '../theme/appTheme'
import { TocItem } from '../types/book'

interface TocProps {
  items: TocItem[]
  onChapterClick: (pageIndex: number) => void
  currentVisualPage: number
  themeMode: ReaderSettings['theme']
  isOpen: boolean
  onClose: () => void
}

export const TableOfContents: React.FC<TocProps> = ({
  items,
  onChapterClick,
  currentVisualPage,
  themeMode,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null

  const chrome = getAppTheme(themeMode)

  return (
    <div
      className={`overlay-fade-in absolute inset-0 z-50 flex backdrop-blur-xl ${chrome.dialogBackdrop}`}
      onClick={onClose}
    >
      <aside
        className={`panel-slide-in-left flex h-full w-full max-w-[420px] flex-col border-r shadow-[24px_0_80px_rgba(0,0,0,0.38)] ${chrome.dialogCard}`}
        onClick={(event) => event.stopPropagation()}
        aria-label="Table of contents"
      >
        <div className={`border-b px-6 pb-5 pt-6 ${chrome.headerBorder}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`text-[11px] uppercase tracking-[0.3em] ${chrome.eyebrow}`}>
                Navigator
              </div>
              <h2 className={`mt-2 text-2xl font-semibold ${chrome.title}`}>Contents</h2>
              <p className={`mt-2 text-sm leading-6 ${chrome.muted}`}>
                Jump by section. The current chapter stays highlighted as playback or reading moves.
              </p>
            </div>
            <button
              onClick={onClose}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${chrome.secondaryButton}`}
              aria-label="Close table of contents"
            >
              Close
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.pill}`}>
              Page {currentVisualPage + 1}
            </div>
            <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.pill}`}>
              {items.length} chapters
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 && (
            <div className={`mt-16 rounded-3xl border px-5 py-6 text-center text-sm ${chrome.insetCard} ${chrome.muted}`}>
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
                      ? `${chrome.card} ${chrome.selectionRing} shadow-[0_18px_40px_rgba(0,0,0,0.28)]`
                      : `${chrome.insetCard} hover:brightness-[1.04]`
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div
                        className={`text-[11px] uppercase tracking-[0.22em] ${
                          isActive ? chrome.accentText : chrome.eyebrow
                        }`}
                      >
                        {isActive ? 'Current Chapter' : `Chapter ${idx + 1}`}
                      </div>
                      <div
                        className={`mt-2 line-clamp-2 text-sm font-medium leading-6 ${
                          isActive ? chrome.title : chrome.body
                        }`}
                      >
                        {item.label}
                      </div>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                        isActive ? chrome.accentPill : chrome.pill
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
