import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FiList,
  FiSliders,
  FiChevronLeft,
  FiChevronRight,
  FiPlay,
  FiPause,
  FiStopCircle,
  FiCrosshair
} from 'react-icons/fi'
import { useAudioPlayer } from '../../../hooks/useAudioPlayer'
import { useBookImporter } from '../../../hooks/useBookImporter'
import { useLibrary, SavedBook } from '../../../hooks/useLibrary'
import { useReaderSettings } from '../../../hooks/useReaderSettings'
import AppearanceMenu from '../../AppearanceMenu'
import { BookViewer } from '../../bookViewer'
import { TableOfContents } from '../../TableOfContents'
import Tooltip from '../../ui/Tooltip'

const PLAYER_WAVEFORM_HEIGHTS = [10, 15, 21, 13, 18, 24, 16, 20, 12, 19, 14, 17]

export default function Reader(): React.JSX.Element {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { library, loadingLibrary, updateProgress } = useLibrary()
  const { settings, updateSetting } = useReaderSettings()

  const [activeBook, setActiveBook] = useState<SavedBook | null>(null)
  const [visualPageIndex, setVisualPageIndex] = useState(0)
  const [isTocOpen, setIsTocOpen] = useState(false)
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)
  const [isCompactHeight, setIsCompactHeight] = useState(false)

  const { totalPages, isLoading, error, loadBookByPath, bookStructure } = useBookImporter()

  const { isPlaying, isPaused, globalSentenceIndex, status, play, pause, stop } = useAudioPlayer({
    bookStructure,
    visualPageIndex
  })

  const lastLoadedIdRef = useRef<string | null>(null)
  const initializedPageRef = useRef(false)
  const lastProgressPageRef = useRef<number | null>(null)
  const lastProgressAnchorRef = useRef<number | null>(null)
  const progressTimeoutRef = useRef<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const pendingJumpRef = useRef<number | null>(null)
  const anchorSentenceRef = useRef<number | null>(null)
  const prevPagesStructureRef = useRef<typeof bookStructure.pagesStructure | null>(null)
  const prevVisualPageRef = useRef<number | null>(null)
  const activeBookIdRef = useRef<string | null>(null)
  const restoredAnchorBookIdRef = useRef<string | null>(null)

  useEffect(() => {
    const updateCompact = () => setIsCompactHeight(window.innerHeight < 620)
    updateCompact()
    window.addEventListener('resize', updateCompact)
    return () => window.removeEventListener('resize', updateCompact)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName

      if (target?.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA') return

      if (event.key === 'Escape') {
        if (isAppearanceOpen) {
          setIsAppearanceOpen(false)
          return
        }
        if (isTocOpen) {
          setIsTocOpen(false)
        }
        return
      }

      if (isAppearanceOpen || isTocOpen) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handlePrevPage()
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNextPage()
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        if (isPlaying) {
          void (isPaused ? play() : pause())
          return
        }
        void play()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAppearanceOpen, isPaused, isPlaying, isTocOpen, pause, play, totalPages, visualPageIndex])

  useEffect(() => {
    if (!bookId || loadingLibrary) return

    const book = library.find((item) => item.id === bookId) || null
    setActiveBook(book)

    if (!book) return
    if (!initializedPageRef.current || lastLoadedIdRef.current !== book.id) {
      const savedIndex = book.lastPageIndex ?? 0
      lastProgressPageRef.current = savedIndex
      lastProgressAnchorRef.current = book.lastAnchorSentenceIndex ?? null
      anchorSentenceRef.current = book.lastAnchorSentenceIndex ?? null
      restoredAnchorBookIdRef.current = null
      setVisualPageIndex(savedIndex)
      initializedPageRef.current = true
    }

    if (lastLoadedIdRef.current !== book.id) {
      lastLoadedIdRef.current = book.id
      loadBookByPath(book.path)
    }
  }, [bookId, library, loadingLibrary, loadBookByPath])

  useEffect(() => {
    if (activeBookIdRef.current !== activeBook?.id) {
      activeBookIdRef.current = activeBook?.id ?? null
      anchorSentenceRef.current = null
      prevPagesStructureRef.current = null
      restoredAnchorBookIdRef.current = null
    }
  }, [activeBook?.id])

  useEffect(() => {
    if (!activeBook) return
    if (isLoading) return
    if (
      typeof activeBook.lastAnchorSentenceIndex === 'number' &&
      restoredAnchorBookIdRef.current !== activeBook.id
    ) {
      return
    }

    const anchorIndex = anchorSentenceRef.current ?? getAnchorIndexForPage(visualPageIndex)
    if (
      lastProgressPageRef.current === visualPageIndex &&
      lastProgressAnchorRef.current === anchorIndex
    ) {
      return
    }

    if (progressTimeoutRef.current) {
      window.clearTimeout(progressTimeoutRef.current)
    }

    progressTimeoutRef.current = window.setTimeout(() => {
      lastProgressPageRef.current = visualPageIndex
      lastProgressAnchorRef.current = anchorIndex
      updateProgress(activeBook.id, visualPageIndex, totalPages || undefined, anchorIndex ?? undefined)
    }, 300)

    return () => {
      if (progressTimeoutRef.current) {
        window.clearTimeout(progressTimeoutRef.current)
      }
    }
  }, [activeBook, isLoading, updateProgress, visualPageIndex, totalPages, bookStructure.pagesStructure])

  const getAnchorIndexForPage = (pageIndex: number) => {
    const pageBlocks = bookStructure.pagesStructure?.[pageIndex]
    if (!pageBlocks || pageBlocks.length === 0) return null
    for (const block of pageBlocks) {
      if (typeof block.startIndex === 'number') {
        return block.startIndex
      }
    }
    return null
  }

  useEffect(() => {
    if (!activeBook || isLoading) return
    if (anchorSentenceRef.current !== null) return
    const anchor = getAnchorIndexForPage(visualPageIndex)
    if (anchor !== null) {
      anchorSentenceRef.current = anchor
    }
  }, [activeBook, isLoading, visualPageIndex, bookStructure.pagesStructure.length])

  useEffect(() => {
    if (!activeBook || isLoading) return
    if (restoredAnchorBookIdRef.current === activeBook.id) return

    restoredAnchorBookIdRef.current = activeBook.id
    const savedAnchor = activeBook.lastAnchorSentenceIndex
    if (typeof savedAnchor !== 'number') return

    anchorSentenceRef.current = savedAnchor
    const mappedPage = bookStructure.sentenceToPageMap[savedAnchor]
    if (typeof mappedPage === 'number' && mappedPage !== visualPageIndex) {
      setVisualPageIndex(mappedPage)
    }
  }, [activeBook, isLoading, visualPageIndex, bookStructure.sentenceToPageMap])

  useEffect(() => {
    if (!activeBook || isLoading) return
    if (prevPagesStructureRef.current === null) {
      prevPagesStructureRef.current = bookStructure.pagesStructure
      return
    }
    if (prevPagesStructureRef.current === bookStructure.pagesStructure) return

    prevPagesStructureRef.current = bookStructure.pagesStructure
    const anchor = anchorSentenceRef.current
    if (anchor === null) return
    const mappedPage = bookStructure.sentenceToPageMap[anchor]
    if (typeof mappedPage === 'number' && mappedPage !== visualPageIndex) {
      setVisualPageIndex(mappedPage)
    }
  }, [
    activeBook,
    isLoading,
    bookStructure.pagesStructure,
    bookStructure.sentenceToPageMap,
    visualPageIndex
  ])

  useEffect(() => {
    if (!activeBook || isLoading) return
    const anchor = getAnchorIndexForPage(visualPageIndex)
    if (anchor !== null) {
      anchorSentenceRef.current = anchor
    }
  }, [activeBook, isLoading, visualPageIndex, globalSentenceIndex, bookStructure.pagesStructure])

  useEffect(() => {
    if (!isPlaying || isPaused) return
    if (globalSentenceIndex < 0) return

    const targetPage = bookStructure.sentenceToPageMap[globalSentenceIndex]
    if (typeof targetPage !== 'number') return
    if (targetPage <= visualPageIndex) return

    setVisualPageIndex(targetPage)
  }, [isPlaying, isPaused, globalSentenceIndex, visualPageIndex, bookStructure.sentenceToPageMap])

  useEffect(() => {
    const previousPage = prevVisualPageRef.current
    prevVisualPageRef.current = visualPageIndex

    if (previousPage === null || previousPage === visualPageIndex) return
    if (pendingJumpRef.current !== null) return

    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [visualPageIndex])

  const handleNextPage = () => {
    setVisualPageIndex((p) => Math.min(totalPages - 1, p + 1))
  }

  const handlePrevPage = () => {
    setVisualPageIndex((p) => Math.max(0, p - 1))
  }

  const handleChapterClick = (pageIndex: number) => {
    setVisualPageIndex(pageIndex)
  }

  const handleJumpToHighlight = () => {
    if (globalSentenceIndex < 0) return
    const targetPage = bookStructure.sentenceToPageMap[globalSentenceIndex]
    if (targetPage === undefined) return
    pendingJumpRef.current = globalSentenceIndex
    if (targetPage !== visualPageIndex) {
      setVisualPageIndex(targetPage)
    }
  }

  useEffect(() => {
    const targetSentence = pendingJumpRef.current
    if (targetSentence === null) return
    const container = scrollContainerRef.current
    const scope = container ?? document
    const current = scope.querySelector('[data-current-sentence="true"]') as HTMLElement | null
    if (current) {
      current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      pendingJumpRef.current = null
    }
  }, [visualPageIndex, globalSentenceIndex])

  if (!bookId) {
    return (
      <div className="p-8 text-zinc-300">
        <p>No book selected.</p>
      </div>
    )
  }

  if (!loadingLibrary && !activeBook) {
    return (
      <div className="p-8 text-zinc-300">
        <p>Book not found.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-white/90 text-black rounded-lg shadow"
        >
          Back to Library
        </button>
      </div>
    )
  }

  const playerTheme =
    settings.theme === 'light'
      ? {
          shell: 'bg-white/95 text-zinc-900 border-black/10',
          button: 'bg-zinc-900 text-white hover:bg-zinc-800',
          iconButton: 'border-black/10 bg-black/5 text-zinc-700 hover:bg-black/10',
          statusLabel: 'text-zinc-500',
          statusValue: 'text-emerald-600',
          separator: 'border-black/10',
          wave: 'bg-zinc-700'
        }
      : settings.theme === 'sepia'
        ? {
            shell: 'bg-[#f1e8d5]/95 text-[#3b2f1f] border-black/10',
            button: 'bg-[#3b2f1f] text-[#f4ecd8] hover:bg-[#2f2619]',
            iconButton: 'border-black/10 bg-black/5 text-[#3b2f1f] hover:bg-black/10',
            statusLabel: 'text-[#6a5a4a]',
            statusValue: 'text-emerald-700',
            separator: 'border-black/10',
            wave: 'bg-[#3b2f1f]'
          }
        : {
            shell: 'bg-white/10 text-zinc-100 border-white/20',
            button: 'bg-white text-black hover:bg-zinc-200',
            iconButton: 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10',
            statusLabel: 'text-zinc-400',
            statusValue: 'text-emerald-400',
            separator: 'border-white/10',
            wave: 'bg-white'
          }

  const readerTheme =
    settings.theme === 'light'
      ? {
          viewport: 'bg-[#ece8e0]',
          ambient:
            'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(236,232,224,0.92)_45%,rgba(223,217,205,0.9)_100%)]',
          hud: 'bg-white/75 border-black/10 text-zinc-900',
          surface: 'bg-[#fcfbf7]/95 border-black/10 shadow-[0_32px_80px_rgba(60,48,29,0.14)]',
          progressTrack: 'bg-black/[0.08]',
          progressFill: 'bg-zinc-900',
          eyebrow: 'text-zinc-500',
          meta: 'text-zinc-600',
          title: 'text-zinc-900'
        }
      : settings.theme === 'sepia'
        ? {
            viewport: 'bg-[#e6dcc7]',
          ambient:
            'bg-[radial-gradient(circle_at_top,rgba(255,245,220,0.62),rgba(230,220,199,0.92)_52%,rgba(214,201,174,0.9)_100%)]',
            hud: 'bg-[#f5ecda]/80 border-black/10 text-[#3b2f1f]',
            surface: 'bg-[#f4ecd8]/95 border-black/10 shadow-[0_32px_80px_rgba(66,43,12,0.16)]',
            progressTrack: 'bg-black/10',
            progressFill: 'bg-[#3b2f1f]',
            eyebrow: 'text-[#7a6652]',
            meta: 'text-[#6b5844]',
            title: 'text-[#2f2418]'
          }
        : {
            viewport: 'bg-[#101113]',
            ambient:
              'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),rgba(16,17,19,0.72)_45%,rgba(10,11,13,0.95)_100%)]',
            hud: 'bg-black/35 border-white/10 text-zinc-100',
            surface: 'bg-[#15171b]/95 border-white/10 shadow-[0_32px_90px_rgba(0,0,0,0.42)]',
            progressTrack: 'bg-white/10',
            progressFill: 'bg-emerald-300',
            eyebrow: 'text-zinc-500',
            meta: 'text-zinc-400',
            title: 'text-zinc-100'
          }

  const pagePercent = totalPages > 0 ? ((visualPageIndex + 1) / totalPages) * 100 : 0

  const player = (
    <div
      className={`${
        isCompactHeight ? 'sticky bottom-4' : 'fixed bottom-6'
      } inset-x-0 z-50 flex justify-center px-4`}
    >
      <div
        className={`w-full max-w-180 backdrop-blur-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-all ${playerTheme.shell} ${
          isCompactHeight
            ? 'rounded-2xl px-4 py-2 flex items-center gap-3'
            : 'rounded-full pl-4 pr-6 py-3 flex items-center gap-4'
        }`}
      >
        <Tooltip label={isPlaying && !isPaused ? 'Pause playback' : 'Start playback'}>
          <button
            onClick={isPlaying ? (isPaused ? play : pause) : play}
            className={`rounded-full flex items-center justify-center shadow-lg transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
              playerTheme.button
            } ${isCompactHeight ? 'w-10 h-10' : 'w-12 h-12'}`}
            aria-label={isPlaying && !isPaused ? 'Pause playback' : 'Start playback'}
            aria-pressed={isPlaying && !isPaused}
          >
            {isPlaying && !isPaused ? (
              <FiPause className={isCompactHeight ? 'text-base' : 'text-xl'} />
            ) : (
              <FiPlay className={isCompactHeight ? 'text-base' : 'text-xl'} />
            )}
          </button>
        </Tooltip>

        <div
          className={`flex flex-col gap-1 flex-1 min-w-30 ${
            isCompactHeight ? 'max-w-40' : 'max-w-55'
          }`}
        >
          <div className="h-6 flex items-center gap-1 opacity-50">
            {PLAYER_WAVEFORM_HEIGHTS.map((height, i) => (
              <div
                key={i}
                className={`w-1 ${playerTheme.wave} rounded-full transition-all duration-300 ${
                  isPlaying && !isPaused ? 'animate-pulse' : ''
                }`}
                style={{ height: `${height}px` }}
              ></div>
            ))}
          </div>
        </div>

        <div
          className={`flex items-center gap-3 ${
            isCompactHeight
              ? `border-l pl-3 ${playerTheme.separator}`
              : `border-l pl-4 ${playerTheme.separator}`
          }`}
        >
          <div className="text-xs">
            <div className={playerTheme.statusLabel}>Status</div>
            <div className={`font-mono ${playerTheme.statusValue}`}>{status}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tooltip label="Jump to current highlighted passage">
            <button
              onClick={handleJumpToHighlight}
              className={`h-9 w-9 rounded-full border transition flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
              aria-label="Jump to current highlighted passage"
            >
              <FiCrosshair className="text-sm" />
            </button>
          </Tooltip>
          <Tooltip label="Appearance settings">
            <button
              onClick={() => setIsAppearanceOpen(!isAppearanceOpen)}
              className={`h-9 w-9 rounded-full border transition flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
              aria-label="Open appearance settings"
            >
              <FiSliders className="text-sm" />
            </button>
          </Tooltip>
          <Tooltip label="Table of contents">
            <button
              onClick={() => setIsTocOpen(!isTocOpen)}
              className={`h-9 w-9 rounded-full border transition flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
              aria-label="Toggle table of contents"
            >
              <FiList className="text-sm" />
            </button>
          </Tooltip>
          <Tooltip label="Previous page">
            <button
              onClick={handlePrevPage}
              disabled={visualPageIndex === 0}
              className={`h-9 w-9 rounded-full border transition flex items-center justify-center disabled:opacity-40 hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
              aria-label="Previous page"
            >
              <FiChevronLeft className="text-sm" />
            </button>
          </Tooltip>
          <Tooltip label="Next page">
            <button
              onClick={handleNextPage}
              disabled={visualPageIndex >= totalPages - 1}
              className={`h-9 w-9 rounded-full border transition flex items-center justify-center disabled:opacity-40 hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
              aria-label="Next page"
            >
              <FiChevronRight className="text-sm" />
            </button>
          </Tooltip>
          <Tooltip label="Stop playback">
            <button
              onClick={stop}
              className={`h-9 w-9 rounded-full border transition flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 ${playerTheme.iconButton}`}
              aria-label="Stop playback"
            >
              <FiStopCircle className="text-sm" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <AppearanceMenu
        isOpen={isAppearanceOpen}
        onClose={() => setIsAppearanceOpen(false)}
        settings={settings}
        updateSetting={updateSetting}
      />

      <TableOfContents
        items={bookStructure.processedToc || []}
        isOpen={isTocOpen}
        onClose={() => setIsTocOpen(false)}
        currentVisualPage={visualPageIndex}
        onChapterClick={handleChapterClick}
      />

      <div
        ref={scrollContainerRef}
        className={`relative flex-1 overflow-y-auto scrollbar-thin transition-colors duration-500 ${
          readerTheme.viewport
        }`}
      >
        <div className={`pointer-events-none absolute inset-0 ${readerTheme.ambient}`} />
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-zinc-500 animate-pulse">
            Opening Book...
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-red-400">{error}</div>
        ) : (
          <div className="relative z-10 px-4 pb-48 pt-4 md:px-8">
            <div
              className={`sticky top-4 z-20 mx-auto mb-6 max-w-[1180px] rounded-[28px] border backdrop-blur-2xl ${readerTheme.hud}`}
            >
              <div className="flex flex-wrap items-center gap-4 px-5 py-4 md:px-6">
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium transition hover:bg-white/10"
                >
                  <FiChevronLeft className="text-sm" />
                  <span>Library</span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] uppercase tracking-[0.28em] ${readerTheme.eyebrow}`}>
                    Now Reading
                  </div>
                  <div className={`truncate text-lg font-semibold ${readerTheme.title}`}>
                    {activeBook?.title || 'Reader'}
                  </div>
                </div>
                <div className="min-w-32 text-right">
                  <div className={`text-[11px] uppercase tracking-[0.24em] ${readerTheme.eyebrow}`}>
                    Progress
                  </div>
                  <div className={`text-sm font-medium ${readerTheme.meta}`}>
                    Page {visualPageIndex + 1} of {totalPages || 0}
                  </div>
                </div>
              </div>
              <div className={`h-px w-full ${readerTheme.progressTrack}`} />
              <div className="px-5 pb-4 pt-3 md:px-6">
                <div className={`h-1.5 w-full overflow-hidden rounded-full ${readerTheme.progressTrack}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${readerTheme.progressFill}`}
                    style={{ width: `${Math.min(100, Math.max(0, pagePercent))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className={`mx-auto max-w-[1180px] rounded-[34px] border ${readerTheme.surface}`}>
              <div className="px-4 py-8 md:px-6 md:py-10">
                <BookViewer
                  bookStructure={bookStructure}
                  visualPageIndex={visualPageIndex}
                  globalSentenceIndex={globalSentenceIndex}
                  onChapterClick={handleChapterClick}
                  settings={settings}
                />
              </div>
            </div>

            <div className={`mt-8 pb-10 text-center text-xs ${readerTheme.meta}`}>
              Page {visualPageIndex + 1} of {totalPages}
            </div>
            {activeBook && isCompactHeight ? player : null}
          </div>
        )}
      </div>

      {activeBook && !isCompactHeight ? player : null}
    </div>
  )
}
