import type { VisualBlock } from '../types/book'

export const extractPageTextForTranslation = (pageBlocks: VisualBlock[] | undefined): string => {
  if (!pageBlocks || pageBlocks.length === 0) return ''

  return pageBlocks
    .filter((block) => block.type === 'paragraph')
    .map((block) => block.content.join(' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

export const splitTranslatedParagraphs = (translatedText: string): string[] =>
  translatedText
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
