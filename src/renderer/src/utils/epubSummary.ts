import ePub from 'epubjs'
import { extractContentRecursively } from './epubUtils'

type EpubSpineItem = {
  href?: string
}

type EpubBook = {
  ready: Promise<void>
  load: (target: string) => Promise<Document | string>
  loaded: {
    metadata: Promise<{ title?: string }>
  }
  spine: {
    spineItems: EpubSpineItem[]
  }
}

const normalizeSummaryText = (text: string): string =>
  text
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const SUMMARY_SKIP_PATTERNS = [
  'project gutenberg',
  'praise for',
  'contents',
  'title page',
  'dedication',
  'acknowledgements',
  'acknowledgments',
  'copyright',
  'maps',
  'about the author',
  'other books by'
]

const MAX_SUMMARY_SOURCE_CHARS = 60000
const MAX_SUMMARY_SOURCE_CHAPTERS = 14

const shouldSkipSummarySection = (text: string): boolean => {
  const normalized = normalizeSummaryText(text).toLowerCase()
  if (!normalized || normalized.length < 140) {
    return true
  }

  const preview = normalized.slice(0, 900)
  return SUMMARY_SKIP_PATTERNS.some((pattern) => preview.includes(pattern))
}

export const extractBookTextForSummary = async (
  buffer: ArrayBuffer
): Promise<{ title: string; text: string }> => {
  const book = ePub(buffer) as unknown as EpubBook
  await book.ready

  const metadata = await book.loaded.metadata
  const spineItems = book.spine?.spineItems || []
  const chapterTexts: string[] = []
  const fallbackTexts: string[] = []

  for (const item of spineItems) {
    const target = item.href
    if (!target) continue

    try {
      const doc = (await book.load(target)) as Document | string
      let dom: Document
      if (typeof doc === 'string') {
        const parser = new DOMParser()
        dom = parser.parseFromString(doc, 'application/xhtml+xml')
      } else {
        dom = doc
      }

      const chapterText = normalizeSummaryText(extractContentRecursively(dom.body))
      if (chapterText) {
        fallbackTexts.push(chapterText)

        if (shouldSkipSummarySection(chapterText)) {
          continue
        }

        chapterTexts.push(chapterText)

        const totalChars = chapterTexts.reduce((sum, current) => sum + current.length, 0)
        if (
          chapterTexts.length >= MAX_SUMMARY_SOURCE_CHAPTERS ||
          totalChars >= MAX_SUMMARY_SOURCE_CHARS
        ) {
          break
        }
      }
    } catch (error) {
      console.warn('[Summary] Failed to parse chapter for summary extraction:', error)
    }
  }

  const selectedTexts = chapterTexts.length > 0 ? chapterTexts : fallbackTexts.slice(0, 6)

  return {
    title: metadata.title || 'Unknown Book',
    text: normalizeSummaryText(selectedTexts.join('\n\n'))
  }
}
