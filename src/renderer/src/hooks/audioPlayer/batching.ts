import { AudioBatch, AudioPlayerBookStructure, XttsQualityMode } from './types'
import { shouldLockParagraphBoundariesForEngine } from './config'

const IMAGE_PAUSE_SEC = 2.0
const XTTS_WORDS_PER_SECOND = 2.7
const XTTS_ESTIMATED_MAJOR_PAUSE_SEC = 0.24
const XTTS_ESTIMATED_MINOR_PAUSE_SEC = 0.08
const XTTS_ESTIMATED_PARAGRAPH_PAUSE_SEC = 0.18
const XTTS_MAX_BUFFERED_BATCHES = 10
const XTTS_BATCH_JOIN_GAP_SEC = 0.006
const XTTS_MAJOR_PUNCTUATION_PAUSE_SEC = 0.012
const XTTS_MINOR_PUNCTUATION_PAUSE_SEC = 0.004
const XTTS_PARAGRAPH_PAUSE_SEC = 0.022
const XTTS_DIALOGUE_ENTRY_PAUSE_SEC = 0.008
const XTTS_MAX_BATCH_JOIN_GAP_SEC = 0.055

const countWords = (text: string) => Math.max(1, text.trim().split(/\s+/).filter(Boolean).length)

const isMajorPauseEnding = (text: string) => /[.!?]["')\]}]*$/.test(text.trim())

const isMinorPauseEnding = (text: string) => /[,;:]["')\]}]*$/.test(text.trim())

const startsDialogueLike = (text: string) => /^[\s"'“‘—-]/.test(text.trim())

const getXttsJoinGapForBatch = (batch: AudioBatch, nextBatch?: AudioBatch | null) => {
  if (!batch.sentences.length) return 0

  const lastSentence = batch.sentences[batch.sentences.length - 1] || ''
  const firstNextSentence = nextBatch?.sentences?.[0] || ''
  let gap = XTTS_BATCH_JOIN_GAP_SEC

  if (isMajorPauseEnding(lastSentence)) {
    gap += XTTS_MAJOR_PUNCTUATION_PAUSE_SEC
  } else if (isMinorPauseEnding(lastSentence)) {
    gap += XTTS_MINOR_PUNCTUATION_PAUSE_SEC
  }

  if (batch.endsParagraph) {
    gap += XTTS_PARAGRAPH_PAUSE_SEC
  }

  if (startsDialogueLike(firstNextSentence)) {
    gap += XTTS_DIALOGUE_ENTRY_PAUSE_SEC
  }

  return Math.min(XTTS_MAX_BATCH_JOIN_GAP_SEC, gap)
}

const estimateXttsBatchPlaybackSeconds = (batch: AudioBatch, playbackRate: number) => {
  if (!batch.sentences.length) return 0

  const wordCount = batch.sentences.reduce((sum, sentence) => sum + countWords(sentence), 0)
  const majorPauseCount = batch.sentences.filter((sentence) => isMajorPauseEnding(sentence)).length
  const minorPauseCount = batch.sentences.filter((sentence) => isMinorPauseEnding(sentence)).length

  const estimatedDuration =
    wordCount / XTTS_WORDS_PER_SECOND +
    majorPauseCount * XTTS_ESTIMATED_MAJOR_PAUSE_SEC +
    minorPauseCount * XTTS_ESTIMATED_MINOR_PAUSE_SEC +
    (batch.endsParagraph ? XTTS_ESTIMATED_PARAGRAPH_PAUSE_SEC : 0)

  return Math.max(2.2, estimatedDuration / Math.max(0.5, playbackRate))
}

const estimateSentenceDurations = (sentences: string[], totalDuration: number) => {
  const basePerSentence = 0.12
  const weights = sentences.map((s) => {
    const wordCount = Math.max(1, s.trim().split(/\s+/).length)
    const punctuationBoost = (s.match(/[.!?]/g) || []).length * 0.6
    const commaBoost = (s.match(/[,;:]/g) || []).length * 0.25
    return wordCount + punctuationBoost + commaBoost
  })

  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const baseTotal = basePerSentence * sentences.length
  const remaining = Math.max(0.1, totalDuration - baseTotal)

  return weights.map((weight) => basePerSentence + (weight / totalWeight) * remaining)
}

const buildBatches = (
  bookStructure: AudioPlayerBookStructure,
  startPageIndex: number,
  engine: string,
  lowEndMode: boolean,
  xttsQuality: XttsQualityMode,
  batchRamp: number[],
  batchSizeStandard: number,
  maxTtsChars: number
) => {
  const batches: AudioBatch[] = []
  const pages = bookStructure.pagesStructure

  const paragraphUnits: Array<{
    type: 'paragraph' | 'image'
    sentences: string[]
    globalIndices: number[]
  }> = []

  if (pages && pages[startPageIndex]) {
    for (let pageIdx = startPageIndex; pageIdx < pages.length; pageIdx++) {
      const blocks = pages[pageIdx] || []
      for (const block of blocks) {
        if (block.type === 'image') {
          paragraphUnits.push({
            type: 'image',
            sentences: [block.content[0]],
            globalIndices: [block.startIndex]
          })
          continue
        }

        paragraphUnits.push({
          type: 'paragraph',
          sentences: [...block.content],
          globalIndices: block.content.map((_, idx) => block.startIndex + idx)
        })
      }
    }
  } else {
    const safeStartIndex = bookStructure.sentenceToPageMap.findIndex((p) => p === startPageIndex)
    const startIndex = Math.max(0, safeStartIndex)
    paragraphUnits.push({
      type: 'paragraph',
      sentences: bookStructure.allSentences.slice(startIndex),
      globalIndices: bookStructure.allSentences.map((_, idx) => idx).slice(startIndex)
    })
  }

  let currentBatchText: string[] = []
  let currentBatchIndices: number[] = []
  let currentWordCount = 0
  let currentCharCount = 0
  let batchIndex = 0
  const lockParagraphBoundaries = shouldLockParagraphBoundariesForEngine(
    engine,
    lowEndMode,
    xttsQuality
  )

  const pushBatch = (endsParagraph: boolean) => {
    if (currentBatchText.length === 0) return
    batches.push({
      text: currentBatchText.join(' '),
      sentences: [...currentBatchText],
      globalIndices: [...currentBatchIndices],
      endsParagraph
    })
    currentBatchText = []
    currentBatchIndices = []
    currentWordCount = 0
    currentCharCount = 0
    batchIndex++
  }

  const addSentencesToBatch = (sentences: string[], indices: number[]) => {
    sentences.forEach((sentence, idx) => {
      currentBatchText.push(sentence)
      currentBatchIndices.push(indices[idx])
      currentWordCount += countWords(sentence)
      currentCharCount += (currentCharCount > 0 ? 1 : 0) + sentence.length
    })
  }

  const splitParagraphIntoChunks = (
    sentences: string[],
    indices: number[],
    targetSize: number,
    maxChars: number
  ) => {
    const chunks: Array<{ sentences: string[]; indices: number[]; endsParagraph: boolean }> = []
    let chunkSentences: string[] = []
    let chunkIndices: number[] = []
    let chunkWordCount = 0
    let chunkCharCount = 0

    const flushChunk = (endsParagraph: boolean) => {
      if (!chunkSentences.length) return
      chunks.push({
        sentences: [...chunkSentences],
        indices: [...chunkIndices],
        endsParagraph
      })
      chunkSentences = []
      chunkIndices = []
      chunkWordCount = 0
      chunkCharCount = 0
    }

    sentences.forEach((sentence, idx) => {
      const sentenceWordCount = countWords(sentence)
      const nextCharCount = chunkCharCount + (chunkCharCount > 0 ? 1 : 0) + sentence.length

      if (
        chunkSentences.length > 0 &&
        (nextCharCount > maxChars || chunkWordCount + sentenceWordCount > Math.round(targetSize * 1.35))
      ) {
        flushChunk(false)
      }

      chunkSentences.push(sentence)
      chunkIndices.push(indices[idx])
      chunkWordCount += sentenceWordCount
      chunkCharCount += (chunkCharCount > 0 ? 1 : 0) + sentence.length

      const reachedTarget = chunkWordCount >= targetSize || chunkCharCount >= Math.round(maxChars * 0.92)
      if (reachedTarget && isMajorPauseEnding(sentence) && idx < sentences.length - 1) {
        flushChunk(false)
      }
    })

    flushChunk(true)
    return chunks
  }

  for (const unit of paragraphUnits) {
    if (unit.type === 'image') {
      pushBatch(true)
      batches.push({
        text: '[[[IMAGE]]]',
        sentences: [...unit.sentences],
        globalIndices: [...unit.globalIndices],
        endsParagraph: true
      })
      continue
    }

    const targetSize = batchIndex < batchRamp.length ? batchRamp[batchIndex] : batchSizeStandard
    const paragraphText = unit.sentences.join(' ')
    const paragraphWordCount = unit.sentences.reduce((sum, sentence) => sum + countWords(sentence), 0)
    const paragraphCharCount = paragraphText.length
    const softWordLimit = Math.round(targetSize * 1.25)
    const softCharLimit = Math.round(maxTtsChars * 1.12)

    if (lockParagraphBoundaries && currentBatchText.length > 0) {
      pushBatch(true)
    }

    if (
      currentBatchText.length === 0 &&
      (paragraphWordCount > softWordLimit || paragraphCharCount > maxTtsChars)
    ) {
      const chunks = splitParagraphIntoChunks(
        unit.sentences,
        unit.globalIndices,
        targetSize,
        maxTtsChars
      )
      chunks.forEach((chunk) => {
        currentBatchText = [...chunk.sentences]
        currentBatchIndices = [...chunk.indices]
        currentWordCount = chunk.sentences.reduce((sum, sentence) => sum + countWords(sentence), 0)
        currentCharCount = chunk.sentences.join(' ').length
        pushBatch(chunk.endsParagraph)
      })
      continue
    }

    if (lockParagraphBoundaries) {
      addSentencesToBatch(unit.sentences, unit.globalIndices)
      pushBatch(true)
      continue
    }

    const projectedWordCount = currentWordCount + paragraphWordCount
    const projectedCharCount =
      currentCharCount + (currentCharCount > 0 ? 1 : 0) + paragraphCharCount
    const shouldFlushBeforeAdding =
      currentBatchText.length > 0 &&
      (projectedCharCount > softCharLimit || projectedWordCount > softWordLimit)

    if (shouldFlushBeforeAdding) {
      pushBatch(true)
    }

    addSentencesToBatch(unit.sentences, unit.globalIndices)
  }

  pushBatch(true)

  return batches
}

export {
  IMAGE_PAUSE_SEC,
  XTTS_MAX_BUFFERED_BATCHES,
  getXttsJoinGapForBatch,
  estimateXttsBatchPlaybackSeconds,
  estimateSentenceDurations,
  buildBatches
}
