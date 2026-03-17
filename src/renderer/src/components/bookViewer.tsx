import React, { memo, useMemo } from 'react'
import { TocItem, VisualBlock } from '../types/book'
import { ReaderSettings } from '../hooks/useReaderSettings'

interface BookViewerProps {
  bookStructure: {
    allSentences: string[]
    sentenceToPageMap: number[]
    pagesStructure: VisualBlock[][]
    processedToc?: TocItem[]
  }
  visualPageIndex: number
  globalSentenceIndex: number
  onChapterClick: (pageIndex: number) => void
  settings: ReaderSettings
}

interface ParagraphBlockProps {
  block: VisualBlock
  activeSentenceLocalIndex: number | null
  fontFamilyClass: string
  themeTextClass: string
  highlightClass: string
  fontSize: number
  lineHeight: number
}

interface ImageBlockProps {
  src: string
  isHighlight: boolean
}

const normalizeTocLabel = (label: string) => label.trim().toLowerCase()

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

const getThemeTextClass = (theme: ReaderSettings['theme']) => {
  switch (theme) {
    case 'light':
      return 'text-zinc-800'
    case 'sepia':
      return 'text-[#433422]'
    default:
      return 'text-zinc-300'
  }
}

const getHighlightClass = (theme: ReaderSettings['theme']) => {
  switch (theme) {
    case 'light':
      return 'bg-yellow-200/50 text-black decoration-clone'
    case 'sepia':
      return 'bg-[#e3d0a6] text-black decoration-clone'
    default:
      return 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] rounded decoration-clone'
  }
}

const ParagraphBlock = memo(function ParagraphBlock({
  block,
  activeSentenceLocalIndex,
  fontFamilyClass,
  themeTextClass,
  highlightClass,
  fontSize,
  lineHeight
}: ParagraphBlockProps) {
  return (
    <p
      className={`reader-paragraph mb-6 text-lg md:text-xl leading-relaxed transition-all duration-300 ${fontFamilyClass} ${themeTextClass}`}
      style={{
        fontSize: `${fontSize}%`,
        lineHeight
      }}
    >
      {block.content.map((sentence, localIdx) => {
        const isCurrent = localIdx === activeSentenceLocalIndex

        return (
          <span
            key={localIdx}
            data-current-sentence={isCurrent ? 'true' : undefined}
            className={`transition-colors duration-300 px-0.5 rounded-sm ${
              isCurrent ? highlightClass : ''
            }`}
          >
            {sentence}{' '}
          </span>
        )
      })}
    </p>
  )
},
(prev, next) =>
  prev.block === next.block &&
  prev.activeSentenceLocalIndex === next.activeSentenceLocalIndex &&
  prev.fontFamilyClass === next.fontFamilyClass &&
  prev.themeTextClass === next.themeTextClass &&
  prev.highlightClass === next.highlightClass &&
  prev.fontSize === next.fontSize &&
  prev.lineHeight === next.lineHeight)

const ImageBlock = memo(function ImageBlock({ src, isHighlight }: ImageBlockProps) {
  return (
    <div
      className={`my-8 flex justify-center transition-all duration-700 ${
        isHighlight ? 'scale-105 contrast-125' : 'opacity-90'
      }`}
    >
      <img
        src={src}
        alt="Illustration"
        className="max-w-full rounded-lg shadow-2xl object-contain"
      />
    </div>
  )
},
(prev, next) => prev.src === next.src && prev.isHighlight === next.isHighlight)

export const BookViewer: React.FC<BookViewerProps> = ({
  bookStructure,
  visualPageIndex,
  globalSentenceIndex,
  onChapterClick,
  settings
}) => {
  const pageBlocks = bookStructure.pagesStructure[visualPageIndex]
  const fontFamilyClass = getFontFamilyClass(settings.fontFamily)
  const themeTextClass = getThemeTextClass(settings.theme)
  const highlightClass = getHighlightClass(settings.theme)
  const tocLabelToPageIndex = useMemo(() => {
    const lookup = new Map<string, number>()
    for (const item of bookStructure.processedToc || []) {
      lookup.set(normalizeTocLabel(item.label), item.pageIndex)
    }
    return lookup
  }, [bookStructure.processedToc])

  if (!pageBlocks || pageBlocks.length === 0) {
    return <div className="text-zinc-500 italic p-4 text-center mt-10">Empty Page</div>
  }

  return (
    <div
      className="reader-prose w-full mx-auto px-4 md:px-10 min-h-[60vh] flex flex-col justify-start transition-all duration-300 ease-in-out"
      style={{ maxWidth: 'clamp(640px, 72vw, 1200px)' }}
    >
      {pageBlocks.map((block, blockIdx) => {
        if (block.type === 'image') {
          const srcMatch = block.content[0].match(/\[\[\[IMG_MARKER:(.*?)\]\]\]/)
          const src = srcMatch ? srcMatch[1] : ''
          return (
            <ImageBlock
              key={`image-${block.startIndex}-${blockIdx}`}
              src={src}
              isHighlight={globalSentenceIndex === block.startIndex}
            />
          )
        }

        const blockText = block.content.join(' ').trim()
        const chapterPageIndex = tocLabelToPageIndex.get(normalizeTocLabel(blockText))

        if (typeof chapterPageIndex === 'number') {
          return (
            <button
              key={`chapter-${block.startIndex}-${blockIdx}`}
              onClick={() => onChapterClick(chapterPageIndex)}
              className="w-full text-left mt-8 mb-6 group"
            >
              <span
                className={`text-3xl md:text-4xl font-bold tracking-tight transition-colors text-balance ${
                  settings.theme === 'dark'
                    ? 'text-zinc-100 group-hover:text-white'
                    : 'text-zinc-900 group-hover:text-black'
                } ${fontFamilyClass}`}
              >
                {blockText}
              </span>
            </button>
          )
        }

        const activeSentenceLocalIndex =
          globalSentenceIndex >= block.startIndex &&
          globalSentenceIndex < block.startIndex + block.content.length
            ? globalSentenceIndex - block.startIndex
            : null

        return (
          <ParagraphBlock
            key={`paragraph-${block.startIndex}-${blockIdx}`}
            block={block}
            activeSentenceLocalIndex={activeSentenceLocalIndex}
            fontFamilyClass={fontFamilyClass}
            themeTextClass={themeTextClass}
            highlightClass={highlightClass}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
          />
        )
      })}
    </div>
  )
}
