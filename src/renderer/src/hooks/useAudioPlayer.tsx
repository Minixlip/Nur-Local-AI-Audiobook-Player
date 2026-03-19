import { useState, useRef, useEffect } from 'react'
import { VisualBlock } from '../types/book'
import { getStoredTtsEngine } from '../utils/tts'

// --- TYPES ---
interface AudioResult {
  status: string
  audio_data: Uint8Array | null
}

interface AudioPlayerProps {
  bookStructure: {
    allSentences: string[]
    sentenceToPageMap: number[]
    pagesStructure?: VisualBlock[][]
  }
  visualPageIndex: number
}

interface AudioBatch {
  text: string
  sentences: string[]
  globalIndices: number[]
  endsParagraph: boolean
}

interface HighlightTrigger {
  time: number
  globalIndex: number
}

interface CachedAudio {
  status: string
  audio_data: Uint8Array | null
}

interface PlaybackBufferState {
  active: boolean
  engine: string | null
  progress: number
  readySeconds: number
  targetSeconds: number
  label: string
  detail: string
}

type XttsQualityMode = 'balanced' | 'studio'

// --- CONSTANTS ---
const DEFAULT_BATCH_RAMP = [10, 14, 20]
const DEFAULT_BATCH_SIZE_STANDARD = 40
const DEFAULT_MAX_TTS_CHARS = 200
const DEFAULT_INITIAL_BUFFER = 3
const DEFAULT_STEADY_BUFFER = 8
const DEFAULT_CROSSFADE_SEC = 0.03
const MAX_CROSSFADE_SEC = 0.12
const LOW_END_BATCH_RAMP = [6, 10, 14]
const LOW_END_BATCH_SIZE_STANDARD = 24
const LOW_END_MAX_TTS_CHARS = 140
const LOW_END_INITIAL_BUFFER = 2
const LOW_END_STEADY_BUFFER = 5
const AUDIO_CACHE_LIMIT = 80
const DECODED_AUDIO_CACHE_LIMIT = 24
const AUDIO_CACHE_DB = 'nur-audio-cache'
const AUDIO_CACHE_STORE = 'audio'
const AUDIO_CACHE_DISK_LIMIT = 120
const ENABLE_PREWARM = false
const BACKEND_BASE_URL = 'http://127.0.0.1:8000'
const TTS_SPEED_STORAGE_KEY = 'tts_playback_speed'
const XTTS_QUALITY_STORAGE_KEY = 'tts_quality_mode'
const LEGACY_XTTS_QUALITY_STORAGE_KEY = 'xtts_quality_mode'
const XTTS_AUDIO_CACHE_VERSION = 'chatterbox_audio_v1'
const DEFAULT_TTS_SPEED = 1.0
const MIN_TTS_SPEED = 0.85
const MAX_TTS_SPEED = 1.15
const STREAMED_PIPER_FIRST_BATCH_WORDS = 1
const XTTS_FIRST_BATCH_WORDS = 18
const XTTS_LOW_END_FIRST_BATCH_WORDS = 12
const XTTS_STUDIO_FIRST_BATCH_WORDS = 36
const XTTS_STUDIO_BATCH_RAMP = [XTTS_STUDIO_FIRST_BATCH_WORDS, 58, 78]
const XTTS_STUDIO_BATCH_SIZE_STANDARD = 112
const XTTS_STUDIO_MAX_TTS_CHARS = 940
const XTTS_BUFFERED_FADE_SEC = 0
const XTTS_BATCH_JOIN_GAP_SEC = 0.006
const XTTS_MAJOR_PUNCTUATION_PAUSE_SEC = 0.012
const XTTS_MINOR_PUNCTUATION_PAUSE_SEC = 0.004
const XTTS_PARAGRAPH_PAUSE_SEC = 0.022
const XTTS_DIALOGUE_ENTRY_PAUSE_SEC = 0.008
const XTTS_MAX_BATCH_JOIN_GAP_SEC = 0.055
const XTTS_BALANCED_INITIAL_BUFFER_SEC = 18
const XTTS_BALANCED_STEADY_BUFFER_SEC = 28
const XTTS_STUDIO_INITIAL_BUFFER_SEC = 28
const XTTS_STUDIO_STEADY_BUFFER_SEC = 42
const XTTS_LOW_END_INITIAL_BUFFER_SEC = 14
const XTTS_LOW_END_STEADY_BUFFER_SEC = 22
const XTTS_WORDS_PER_SECOND = 2.7
const XTTS_ESTIMATED_MAJOR_PAUSE_SEC = 0.24
const XTTS_ESTIMATED_MINOR_PAUSE_SEC = 0.08
const XTTS_ESTIMATED_PARAGRAPH_PAUSE_SEC = 0.18
const XTTS_MAX_BUFFERED_BATCHES = 8
const IMAGE_PAUSE_SEC = 2.0
const STREAM_INITIAL_PCM_BYTES = 4096
const STREAM_STEADY_PCM_BYTES = 16384
const STREAM_CHUNK_FADE_SEC = 0.008
const EMPTY_BUFFER_STATE: PlaybackBufferState = {
  active: false,
  engine: null,
  progress: 0,
  readySeconds: 0,
  targetSeconds: 0,
  label: '',
  detail: ''
}

// --- HELPER: Time Estimator ---
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

const openAudioCache = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(AUDIO_CACHE_DB, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(AUDIO_CACHE_STORE)) {
        const store = db.createObjectStore(AUDIO_CACHE_STORE, { keyPath: 'key' })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const getCachedAudioFromDisk = async (db: IDBDatabase, key: string) =>
  new Promise<CachedAudio | null>((resolve) => {
    const tx = db.transaction(AUDIO_CACHE_STORE, 'readonly')
    const store = tx.objectStore(AUDIO_CACHE_STORE)
    const req = store.get(key)
    req.onsuccess = () => {
      const result = req.result
      if (result?.data) {
        resolve({ status: 'success', audio_data: new Uint8Array(result.data) })
      } else {
        resolve(null)
      }
    }
    req.onerror = () => resolve(null)
  })

const setCachedAudioOnDisk = async (db: IDBDatabase, key: string, data: Uint8Array) =>
  new Promise<void>((resolve) => {
    const tx = db.transaction(AUDIO_CACHE_STORE, 'readwrite')
    const store = tx.objectStore(AUDIO_CACHE_STORE)
    store.put({ key, data: data.buffer, updatedAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })

const pruneDiskCache = async (db: IDBDatabase) =>
  new Promise<void>((resolve) => {
    const tx = db.transaction(AUDIO_CACHE_STORE, 'readwrite')
    const store = tx.objectStore(AUDIO_CACHE_STORE)
    const index = store.index('updatedAt')
    const keysToDelete: IDBValidKey[] = []
    let count = 0

    index.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
      if (!cursor) {
        const excess = Math.max(0, count - AUDIO_CACHE_DISK_LIMIT)
        const toRemove = keysToDelete.slice(0, excess)
        toRemove.forEach((key) => store.delete(key))
        resolve()
        return
      }
      count += 1
      keysToDelete.push(cursor.primaryKey)
      cursor.continue()
    }
  })

const concatUint8Arrays = (left: Uint8Array, right: Uint8Array) => {
  const combined = new Uint8Array(left.length + right.length)
  combined.set(left)
  combined.set(right, left.length)
  return combined
}

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

const createPcmAudioBuffer = (ctx: AudioContext, pcmBytes: Uint8Array, sampleRate: number) => {
  const int16 = new Int16Array(
    pcmBytes.buffer.slice(pcmBytes.byteOffset, pcmBytes.byteOffset + pcmBytes.byteLength)
  )
  const audioBuffer = ctx.createBuffer(1, int16.length, sampleRate)
  const channelData = audioBuffer.getChannelData(0)

  for (let i = 0; i < int16.length; i++) {
    channelData[i] = int16[i] / 32768
  }

  return audioBuffer
}

const clampTtsSpeed = (value: number) => Math.min(MAX_TTS_SPEED, Math.max(MIN_TTS_SPEED, value))

const getStoredTtsSpeed = () => {
  const stored = Number(localStorage.getItem(TTS_SPEED_STORAGE_KEY))
  return Number.isFinite(stored) ? clampTtsSpeed(stored) : DEFAULT_TTS_SPEED
}

const getStoredXttsQualityMode = (): XttsQualityMode => {
  const stored = localStorage.getItem(XTTS_QUALITY_STORAGE_KEY)
  if (stored === 'balanced' || stored === 'studio') {
    return stored
  }

  const legacy = localStorage.getItem(LEGACY_XTTS_QUALITY_STORAGE_KEY)
  if (legacy === 'balanced' || legacy === 'studio') {
    localStorage.setItem(XTTS_QUALITY_STORAGE_KEY, legacy)
    localStorage.removeItem(LEGACY_XTTS_QUALITY_STORAGE_KEY)
    return legacy
  }

  return 'studio'
}

const getBatchRampForEngine = (engine: string, lowEndMode: boolean, xttsQuality: XttsQualityMode) => {
  const baseRamp = lowEndMode ? LOW_END_BATCH_RAMP : DEFAULT_BATCH_RAMP
  if (engine === 'piper') {
    return [STREAMED_PIPER_FIRST_BATCH_WORDS, ...baseRamp]
  }
  if (engine === 'chatterbox') {
    if (!lowEndMode && xttsQuality === 'studio') {
      return XTTS_STUDIO_BATCH_RAMP
    }
    return [(lowEndMode ? XTTS_LOW_END_FIRST_BATCH_WORDS : XTTS_FIRST_BATCH_WORDS), ...baseRamp]
  }
  return baseRamp
}

const getBatchSizeStandardForEngine = (
  engine: string,
  lowEndMode: boolean,
  xttsQuality: XttsQualityMode
) => {
  if (engine === 'chatterbox' && !lowEndMode && xttsQuality === 'studio') {
    return XTTS_STUDIO_BATCH_SIZE_STANDARD
  }
  return lowEndMode ? LOW_END_BATCH_SIZE_STANDARD : DEFAULT_BATCH_SIZE_STANDARD
}

const shouldLockParagraphBoundariesForEngine = (
  _engine: string,
  _lowEndMode: boolean,
  _xttsQuality: XttsQualityMode
) => false

const getMaxTtsCharsForEngine = (
  engine: string,
  lowEndMode: boolean,
  xttsQuality: XttsQualityMode
) => {
  if (engine === 'chatterbox' && !lowEndMode && xttsQuality === 'studio') {
    return XTTS_STUDIO_MAX_TTS_CHARS
  }
  return lowEndMode ? LOW_END_MAX_TTS_CHARS : DEFAULT_MAX_TTS_CHARS
}

const shouldStreamXttsFirstBatch = (_lowEndMode: boolean, _xttsQuality: XttsQualityMode) => false

const getPlaybackRateForEngine = (engine: string, speed: number) => {
  if (engine === 'chatterbox') {
    return clampTtsSpeed(speed)
  }
  return 1
}

const getBufferWindowForEngine = (
  engine: string,
  initialBuffer: number,
  steadyBuffer: number
) => {
  if (engine === 'chatterbox') {
    return {
      initialBuffer: Math.max(4, Math.min(initialBuffer, 6)),
      steadyBuffer: Math.max(5, Math.min(steadyBuffer, 8))
    }
  }

  return { initialBuffer, steadyBuffer }
}

const getXttsBufferTargets = (lowEndMode: boolean, xttsQuality: XttsQualityMode) => {
  if (lowEndMode) {
    return {
      initialSeconds: XTTS_LOW_END_INITIAL_BUFFER_SEC,
      steadySeconds: XTTS_LOW_END_STEADY_BUFFER_SEC
    }
  }

  if (xttsQuality === 'studio') {
    return {
      initialSeconds: XTTS_STUDIO_INITIAL_BUFFER_SEC,
      steadySeconds: XTTS_STUDIO_STEADY_BUFFER_SEC
    }
  }

  return {
    initialSeconds: XTTS_BALANCED_INITIAL_BUFFER_SEC,
    steadySeconds: XTTS_BALANCED_STEADY_BUFFER_SEC
  }
}

export function useAudioPlayer({
  bookStructure,
  visualPageIndex
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [globalSentenceIndex, setGlobalSentenceIndex] = useState(-1)
  const [status, setStatus] = useState('Idle')
  const [buffering, setBuffering] = useState<PlaybackBufferState>(EMPTY_BUFFER_STATE)

  const isPlayingRef = useRef(false)
  const isPausedRef = useRef(false)
  const stopSignalRef = useRef(false)
  const highlightedSentenceIndexRef = useRef(-1)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextStartTimeRef = useRef(0)
  const playbackEndTimeRef = useRef(0)
  const highlightScheduleRef = useRef<HighlightTrigger[]>([])
  const highlightCursorRef = useRef(0)
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())

  // Session Tracking
  const currentSessionId = useRef<string>('')
  const audioCacheRef = useRef<Map<string, CachedAudio>>(new Map())
  const audioCacheKeysRef = useRef<string[]>([])
  const decodedAudioCacheRef = useRef<Map<string, AudioBuffer>>(new Map())
  const decodedAudioCacheKeysRef = useRef<string[]>([])
  const audioCacheDbRef = useRef<IDBDatabase | null>(null)
  const prewarmTimeoutRef = useRef<number | null>(null)
  const streamAbortControllerRef = useRef<AbortController | null>(null)

  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      audioCtxRef.current = new AudioContext()
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
  }

  const stopActiveSources = () => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop()
      } catch {}
      try {
        source.disconnect()
      } catch {}
    }
    activeSourcesRef.current.clear()
  }

  const scheduleAudioBuffer = (
    ctx: AudioContext,
    audioBuffer: AudioBuffer,
    fadeSec: number,
    options?: { joinGapSec?: number; playbackRate?: number }
  ) => {
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer

    const start = Math.max(ctx.currentTime, nextStartTimeRef.current)
    const gainNode = ctx.createGain()
    const playbackRate = Math.max(0.5, options?.playbackRate ?? 1)
    source.playbackRate.value = playbackRate
    const effectiveDuration = audioBuffer.duration / playbackRate
    const safeFadeSec = Math.min(fadeSec, effectiveDuration * 0.25)
    const joinGapSec = Math.max(0, options?.joinGapSec ?? 0)

    if (safeFadeSec > 0) {
      gainNode.gain.setValueAtTime(0, start)
      gainNode.gain.linearRampToValueAtTime(1, start + safeFadeSec)
      gainNode.gain.setValueAtTime(1, Math.max(start, start + effectiveDuration - safeFadeSec))
      gainNode.gain.linearRampToValueAtTime(0, start + effectiveDuration)
    } else {
      gainNode.gain.setValueAtTime(1, start)
    }

    source.connect(gainNode)
    gainNode.connect(ctx.destination)
    activeSourcesRef.current.add(source)
    source.onended = () => {
      activeSourcesRef.current.delete(source)
      try {
        source.disconnect()
      } catch {}
      try {
        gainNode.disconnect()
      } catch {}
    }

    source.start(start)
    const overlap = Math.min(safeFadeSec, effectiveDuration * 0.25)
    const endTime = start + effectiveDuration
    nextStartTimeRef.current = Math.max(start + 0.02, endTime - overlap + joinGapSec)
    playbackEndTimeRef.current = endTime

    return { start, endTime }
  }

  const setDecodedCache = (key: string, value: AudioBuffer) => {
    const cache = decodedAudioCacheRef.current
    if (!cache.has(key)) {
      decodedAudioCacheKeysRef.current.push(key)
    }
    cache.set(key, value)

    if (decodedAudioCacheKeysRef.current.length > DECODED_AUDIO_CACHE_LIMIT) {
      const oldest = decodedAudioCacheKeysRef.current.shift()
      if (oldest) cache.delete(oldest)
    }
  }

  const decodeToBuffer = async (
    key: string,
    result: CachedAudio
  ): Promise<AudioBuffer | null> => {
    const cachedBuffer = decodedAudioCacheRef.current.get(key)
    if (cachedBuffer) return cachedBuffer

    const ctx = audioCtxRef.current
    if (!ctx || !result.audio_data) return null
    try {
      const rawData = result.audio_data
      const cleanBuffer = rawData.buffer.slice(
        rawData.byteOffset,
        rawData.byteOffset + rawData.byteLength
      ) as ArrayBuffer
      const decoded = await ctx.decodeAudioData(cleanBuffer)
      setDecodedCache(key, decoded)
      return decoded
    } catch (err) {
      console.error('Decode Error', err)
      return null
    }
  }

  const buildCacheKey = (
    text: string,
    engine: string,
    voicePath: string | null,
    speed: number,
    xttsQuality: XttsQualityMode
  ) =>
    `${engine}:${voicePath || 'default'}:${engine === 'chatterbox' ? `${XTTS_AUDIO_CACHE_VERSION}:${xttsQuality}` : `${speed}:standard`}:${text}`

  const setCache = (key: string, value: CachedAudio) => {
    const cache = audioCacheRef.current
    if (!cache.has(key)) {
      audioCacheKeysRef.current.push(key)
    }
    cache.set(key, value)

    if (audioCacheKeysRef.current.length > AUDIO_CACHE_LIMIT) {
      const oldest = audioCacheKeysRef.current.shift()
      if (oldest) cache.delete(oldest)
    }
  }

  const buildBatches = (
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

      const targetSize =
        batchIndex < batchRamp.length ? batchRamp[batchIndex] : batchSizeStandard
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

  useEffect(() => {
    let isMounted = true
    openAudioCache()
      .then((db) => {
        if (isMounted) audioCacheDbRef.current = db
      })
      .catch(() => {})
    return () => {
      isMounted = false
      if (audioCacheDbRef.current) {
        audioCacheDbRef.current.close()
        audioCacheDbRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!ENABLE_PREWARM) return
    if (isPlayingRef.current) return
    if (!bookStructure.allSentences.length || !bookStructure.sentenceToPageMap.length) return

    if (prewarmTimeoutRef.current) window.clearTimeout(prewarmTimeoutRef.current)
    prewarmTimeoutRef.current = window.setTimeout(async () => {
      const lowEndMode = localStorage.getItem('low_end_mode') === 'true'
      const engine = getStoredTtsEngine()
      const xttsQuality = getStoredXttsQualityMode()
      const batchRamp = getBatchRampForEngine(engine, lowEndMode, xttsQuality)
      const batchSizeStandard = getBatchSizeStandardForEngine(engine, lowEndMode, xttsQuality)
      const maxTtsChars = getMaxTtsCharsForEngine(engine, lowEndMode, xttsQuality)

      const batches = buildBatches(
        visualPageIndex,
        engine,
        lowEndMode,
        xttsQuality,
        batchRamp,
        batchSizeStandard,
        maxTtsChars
      )
      const firstBatch = batches[0]
      if (!firstBatch || firstBatch.text === '[[[IMAGE]]]' || !firstBatch.text.trim()) return

      const voicePath =
        engine === 'piper'
          ? localStorage.getItem('piper_model_path')
          : localStorage.getItem('custom_voice_path')
      const speed = getStoredTtsSpeed()
      const cacheKey = buildCacheKey(firstBatch.text, engine, voicePath, speed, xttsQuality)
      const cached = audioCacheRef.current.get(cacheKey)
      if (cached) return

      const db = audioCacheDbRef.current
      if (db) {
        const diskHit = await getCachedAudioFromDisk(db, cacheKey)
        if (diskHit) {
          setCache(cacheKey, diskHit)
          return
        }
      }

      const result = await window.api.generate(firstBatch.text, speed, 'prewarm', {
        engine: engine,
        voicePath: voicePath,
        quality_mode: xttsQuality
      })
      if (result?.status === 'success' && result.audio_data) {
        setCache(cacheKey, result as CachedAudio)
        if (db) {
          await setCachedAudioOnDisk(db, cacheKey, result.audio_data)
          await pruneDiskCache(db)
        }
      }
    }, 350)

    return () => {
      if (prewarmTimeoutRef.current) window.clearTimeout(prewarmTimeoutRef.current)
    }
  }, [visualPageIndex, bookStructure.allSentences, bookStructure.sentenceToPageMap])

  const pause = async () => {
    if (!isPlayingRef.current || isPausedRef.current) return
    console.log('Pausing...')

    isPausedRef.current = true
    setIsPaused(true)

    if (audioCtxRef.current) {
      await audioCtxRef.current.suspend()
    }
    setStatus('Paused')
  }

  const stop = async () => {
    console.log('Stopping...')
    stopSignalRef.current = true
    isPlayingRef.current = false
    isPausedRef.current = false

    currentSessionId.current = ''
    await window.api.setSession('')

    setIsPlaying(false)
    setIsPaused(false)
    setStatus('Stopped')
    setBuffering(EMPTY_BUFFER_STATE)
    setGlobalSentenceIndex(-1)
    highlightedSentenceIndexRef.current = -1

    highlightScheduleRef.current = []
    highlightCursorRef.current = 0
    playbackEndTimeRef.current = 0
    nextStartTimeRef.current = 0
    streamAbortControllerRef.current?.abort()
    streamAbortControllerRef.current = null
    stopActiveSources()

    if (audioCtxRef.current) {
      try {
        if (audioCtxRef.current.state === 'running') {
          await audioCtxRef.current.suspend()
        }
      } catch (e) {
        console.error(e)
      }
    }

    await window.api.stop()
  }

  const play = async () => {
    if (isPausedRef.current) {
      console.log('Resuming...')
      isPausedRef.current = false
      setIsPaused(false)
      if (audioCtxRef.current) {
        await audioCtxRef.current.resume()
      }
      setStatus('Resuming...')
      return
    }

    if (isPlayingRef.current) return

    stopSignalRef.current = false
    isPlayingRef.current = true
    isPausedRef.current = false
    setIsPlaying(true)
    setIsPaused(false)
    highlightScheduleRef.current = []
    highlightCursorRef.current = 0
    setGlobalSentenceIndex(-1)
    highlightedSentenceIndexRef.current = -1
    playbackEndTimeRef.current = 0
    streamAbortControllerRef.current?.abort()
    streamAbortControllerRef.current = null
    stopActiveSources()

    initAudioContext()

    const ctx = audioCtxRef.current
    if (!ctx) return

    nextStartTimeRef.current = ctx.currentTime + 0.1

    const newSessionId = Date.now().toString()
    currentSessionId.current = newSessionId
    await window.api.setSession(newSessionId)

    const engine = getStoredTtsEngine()
    const lowEndMode = localStorage.getItem('low_end_mode') === 'true'
    const xttsQuality = getStoredXttsQualityMode()
    const batchRamp = getBatchRampForEngine(engine, lowEndMode, xttsQuality)
    const batchSizeStandard = getBatchSizeStandardForEngine(engine, lowEndMode, xttsQuality)
    const maxTtsChars = getMaxTtsCharsForEngine(engine, lowEndMode, xttsQuality)
    const initialDefault = lowEndMode ? LOW_END_INITIAL_BUFFER : DEFAULT_INITIAL_BUFFER
    const steadyDefault = lowEndMode ? LOW_END_STEADY_BUFFER : DEFAULT_STEADY_BUFFER
    const storedInitial = Number(localStorage.getItem('audio_buffer_initial'))
    const storedSteady = Number(localStorage.getItem('audio_buffer_steady'))
    const storedCrossfadeMs = Number(localStorage.getItem('audio_crossfade_ms'))
    const initialBuffer =
      Number.isFinite(storedInitial) && storedInitial > 0 ? storedInitial : initialDefault
    const steadyBuffer =
      Number.isFinite(storedSteady) && storedSteady > 0 ? storedSteady : steadyDefault
    const { initialBuffer: effectiveInitialBuffer, steadyBuffer: effectiveSteadyBuffer } =
      getBufferWindowForEngine(engine, initialBuffer, steadyBuffer)
    const fadeSec = Number.isFinite(storedCrossfadeMs)
      ? Math.min(MAX_CROSSFADE_SEC, Math.max(0, storedCrossfadeMs / 1000))
      : DEFAULT_CROSSFADE_SEC
    const bufferedFadeSec =
      engine === 'chatterbox' ? Math.min(fadeSec, XTTS_BUFFERED_FADE_SEC) : fadeSec
    const xttsBufferTargets =
      engine === 'chatterbox' ? getXttsBufferTargets(lowEndMode, xttsQuality) : null

    const batches = buildBatches(
      visualPageIndex,
      engine,
      lowEndMode,
      xttsQuality,
      batchRamp,
      batchSizeStandard,
      maxTtsChars
    )

    const audioPromises: Array<Promise<AudioResult> | null> = new Array(batches.length).fill(null)
    const decodedBuffers: Array<AudioBuffer | null> = new Array(batches.length).fill(null)
    const voicePath =
      engine === 'piper'
        ? localStorage.getItem('piper_model_path')
        : localStorage.getItem('custom_voice_path')
    const speed = getStoredTtsSpeed()
    const playbackRate = getPlaybackRateForEngine(engine, speed)
    const getDesiredBufferSize = (startIndex: number, fallback: number) => {
      if (engine !== 'chatterbox' || !xttsBufferTargets) {
        return fallback
      }

      const targetSeconds =
        startIndex <= 0 ? xttsBufferTargets.initialSeconds : xttsBufferTargets.steadySeconds
      let estimatedSeconds = 0
      let count = 0

      for (
        let batchIndex = startIndex;
        batchIndex < batches.length && count < XTTS_MAX_BUFFERED_BATCHES;
        batchIndex++
      ) {
        estimatedSeconds += estimateXttsBatchPlaybackSeconds(batches[batchIndex], playbackRate)
        count++
        if (estimatedSeconds >= targetSeconds) {
          break
        }
      }

      return Math.max(fallback, count)
    }

    let bufferSize = getDesiredBufferSize(0, effectiveInitialBuffer)
    let hasStartedPlayback = false
    const isSessionStale = () =>
      stopSignalRef.current || currentSessionId.current !== newSessionId

    const markPlaybackStarted = () => {
      if (!hasStartedPlayback) {
        setBuffering(EMPTY_BUFFER_STATE)
        setStatus('Reading...')
        hasStartedPlayback = true
      }
    }

    const updateBufferingUi = (readySeconds: number, targetSeconds: number) => {
      if (hasStartedPlayback) return

      const safeTarget = Math.max(targetSeconds, 0.1)
      const clampedReady = Math.min(readySeconds, targetSeconds)
      const progress = Math.min(1, clampedReady / safeTarget)

      if (engine === 'chatterbox') {
        setBuffering({
          active: true,
          engine,
          progress,
          readySeconds: clampedReady,
          targetSeconds,
          label: 'Preparing narration',
          detail: `Building a smooth opening buffer so playback can stay continuous.`
        })
        setStatus(`Preparing narration ${Math.round(progress * 100)}%`)
        return
      }

      setBuffering({
        active: true,
        engine,
        progress,
        readySeconds: clampedReady,
        targetSeconds,
        label: engine === 'piper' ? 'Loading voice' : 'Preparing audio',
        detail:
          engine === 'piper'
            ? 'Getting the voice ready for playback.'
            : 'Loading the first playback segment.'
      })
      setStatus(engine === 'piper' ? 'Loading voice...' : 'Buffering...')
    }

    const triggerGeneration = (index: number) => {
      if (index >= batches.length || audioPromises[index] || isSessionStale()) return
      const batch = batches[index]

      if (batch.text === '[[[IMAGE]]]') {
        audioPromises[index] = Promise.resolve({ status: 'skipped', audio_data: null })
      } else {
        const cacheKey = buildCacheKey(batch.text, engine, voicePath, speed, xttsQuality)
        const cached = audioCacheRef.current.get(cacheKey)

        const resolveAndMaybeDecode = async () => {
          const db = audioCacheDbRef.current
          if (db) {
            const diskHit = await getCachedAudioFromDisk(db, cacheKey)
            if (diskHit) {
              setCache(cacheKey, diskHit)
              const decoded = await decodeToBuffer(cacheKey, diskHit)
              decodedBuffers[index] = decoded
              return diskHit
            }
          }

          if (isSessionStale()) {
            return { status: 'cancelled', audio_data: null }
          }

          const result = await window.api.generate(batch.text, speed, newSessionId, {
            engine: engine,
            voicePath: voicePath,
            quality_mode: xttsQuality
          })

          if (result?.status === 'success' && result.audio_data) {
            setCache(cacheKey, result as CachedAudio)
            if (db) {
              await setCachedAudioOnDisk(db, cacheKey, result.audio_data)
              await pruneDiskCache(db)
            }
            const decoded = await decodeToBuffer(cacheKey, result as CachedAudio)
            decodedBuffers[index] = decoded
          }
          return result
        }

        if (cached) {
          audioPromises[index] = Promise.resolve(cached).then(async (result) => {
            const decoded = await decodeToBuffer(cacheKey, result as CachedAudio)
            decodedBuffers[index] = decoded
            return result
          })
        } else {
          audioPromises[index] = resolveAndMaybeDecode()
        }
      }
    }

    const supportsFirstBatchStreaming =
      engine === 'piper' ||
      (engine === 'chatterbox' && shouldStreamXttsFirstBatch(lowEndMode, xttsQuality))
    const firstBatch = batches[0]
    const firstBatchCacheKey =
      firstBatch && firstBatch.text !== '[[[IMAGE]]]'
        ? buildCacheKey(firstBatch.text, engine, voicePath, speed, xttsQuality)
        : null

    let shouldStreamFirstBatch =
      supportsFirstBatchStreaming &&
      firstBatch?.text !== '[[[IMAGE]]]' &&
      firstBatch?.globalIndices.length === 1

    if (shouldStreamFirstBatch && firstBatchCacheKey) {
      if (audioCacheRef.current.has(firstBatchCacheKey)) {
        shouldStreamFirstBatch = false
      } else if (audioCacheDbRef.current) {
        const diskHit = await getCachedAudioFromDisk(audioCacheDbRef.current, firstBatchCacheKey)
        if (diskHit) {
          setCache(firstBatchCacheKey, diskHit)
          shouldStreamFirstBatch = false
        }
      }
    }

    const streamFirstBatch = async (batch: AudioBatch) => {
      const streamVoicePath = engine === 'chatterbox' ? voicePath || '' : voicePath
      if (engine === 'piper' && !streamVoicePath) {
        return { mode: 'fallback' as const, started: false }
      }

      const controller = new AbortController()
      streamAbortControllerRef.current = controller
      let pendingPcm = new Uint8Array(0)
      let scheduledAudio = false
      let sampleRate = engine === 'chatterbox' ? 24000 : 22050

      const flushPlayablePcm = (force = false) => {
        const playableLength = pendingPcm.byteLength - (pendingPcm.byteLength % 2)
        const minimumLength = scheduledAudio ? STREAM_STEADY_PCM_BYTES : STREAM_INITIAL_PCM_BYTES
        if (playableLength === 0) return
        if (!force && playableLength < minimumLength) return

        const pcmChunk = pendingPcm.slice(0, playableLength)
        pendingPcm = pendingPcm.slice(playableLength)

        const audioBuffer = createPcmAudioBuffer(ctx, pcmChunk, sampleRate)
        const { start } = scheduleAudioBuffer(
          ctx,
          audioBuffer,
          Math.min(fadeSec, STREAM_CHUNK_FADE_SEC),
          { playbackRate: 1 }
        )

        if (!scheduledAudio) {
          highlightScheduleRef.current.push({
            time: start + 0.04,
            globalIndex: batch.globalIndices[0]
          })
        }

        scheduledAudio = true
        markPlaybackStarted()
      }

      try {
        const response = await fetch(`${BACKEND_BASE_URL}/tts/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: batch.text,
            session_id: newSessionId,
            engine,
            speaker_wav: streamVoicePath || '',
            piper_model_path: engine === 'piper' ? streamVoicePath || '' : '',
            language: 'en',
            speed,
            quality_mode: xttsQuality
          }),
          signal: controller.signal
        })

        if (response.status === 499) {
          return { mode: 'cancelled' as const, started: scheduledAudio }
        }

        if (!response.ok) {
          if (!scheduledAudio) {
            return { mode: 'fallback' as const, started: false }
          }
          return { mode: 'partial' as const, started: true }
        }

        const sampleRateHeader = Number(response.headers.get('x-sample-rate'))
        if (Number.isFinite(sampleRateHeader) && sampleRateHeader > 0) {
          sampleRate = sampleRateHeader
        }

        const reader = response.body?.getReader()
        if (!reader) {
          return scheduledAudio
            ? { mode: 'partial' as const, started: true }
            : { mode: 'fallback' as const, started: false }
        }

        while (!stopSignalRef.current) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value || value.byteLength === 0) continue

          pendingPcm = concatUint8Arrays(pendingPcm, value)
          flushPlayablePcm(false)
        }

        if (stopSignalRef.current) {
          return { mode: 'cancelled' as const, started: scheduledAudio }
        }

        flushPlayablePcm(true)

        return scheduledAudio
          ? { mode: 'success' as const, started: true }
          : { mode: 'fallback' as const, started: false }
      } catch (error: any) {
        if (controller.signal.aborted || error?.name === 'AbortError') {
          return { mode: 'cancelled' as const, started: scheduledAudio }
        }

        console.warn(`${engine.toUpperCase()} stream failed`, error)
        return scheduledAudio
          ? { mode: 'partial' as const, started: true }
          : { mode: 'fallback' as const, started: false }
      } finally {
        if (streamAbortControllerRef.current === controller) {
          streamAbortControllerRef.current = null
        }
      }
    }

    let nextGenerationIndex = shouldStreamFirstBatch ? 1 : 0
    if (shouldStreamFirstBatch) {
      bufferSize = getDesiredBufferSize(1, effectiveInitialBuffer)
    }
    const getContiguousReadySeconds = (startIndex: number) => {
      let total = 0

      for (let index = startIndex; index < batches.length; index++) {
        const batch = batches[index]

        if (batch.text === '[[[IMAGE]]]') {
          total += IMAGE_PAUSE_SEC
          continue
        }

        const readyBuffer = decodedBuffers[index]
        if (!readyBuffer) break

        total += readyBuffer.duration / playbackRate

        if (engine === 'chatterbox') {
          const nextBatch = index + 1 < batches.length ? batches[index + 1] : null
          total += getXttsJoinGapForBatch(batch, nextBatch)
        }
      }

      return total
    }

    const triggerUpTo = (targetExclusive: number) => {
      while (nextGenerationIndex < batches.length && nextGenerationIndex < targetExclusive) {
        triggerGeneration(nextGenerationIndex)
        nextGenerationIndex += 1
      }
    }

    let prefetchPromise: Promise<void> | null = null
    let desiredReadyStartIndex = shouldStreamFirstBatch ? 1 : 0
    let desiredReadySeconds = 0

    const ensureReadyAudio = (startIndex: number, targetSeconds: number) => {
      if (engine !== 'chatterbox' || !xttsBufferTargets) {
        return Promise.resolve()
      }

      desiredReadyStartIndex = Math.max(0, startIndex)
      desiredReadySeconds = Math.max(0, targetSeconds)

      if (prefetchPromise) {
        return prefetchPromise
      }

      prefetchPromise = (async () => {
        while (!isSessionStale()) {
          const readySeconds = getContiguousReadySeconds(desiredReadyStartIndex)
          updateBufferingUi(readySeconds, desiredReadySeconds)

          if (readySeconds >= desiredReadySeconds) {
            break
          }

          if (nextGenerationIndex < desiredReadyStartIndex) {
            nextGenerationIndex = desiredReadyStartIndex
          }

          if (nextGenerationIndex >= batches.length) {
            break
          }

          const generationIndex = nextGenerationIndex
          nextGenerationIndex += 1
          triggerGeneration(generationIndex)

          const promise = audioPromises[generationIndex]
          if (!promise) {
            continue
          }

          try {
            await promise
          } catch (error) {
            console.warn('Premium prefetch failed', error)
            break
          }
        }
      })().finally(() => {
        prefetchPromise = null
        if (
          !isSessionStale() &&
          engine === 'chatterbox' &&
          xttsBufferTargets &&
          getContiguousReadySeconds(desiredReadyStartIndex) < desiredReadySeconds &&
          nextGenerationIndex < batches.length
        ) {
          void ensureReadyAudio(desiredReadyStartIndex, desiredReadySeconds)
        }
      })

      return prefetchPromise
    }

    try {
      updateBufferingUi(0, engine === 'chatterbox' && xttsBufferTargets ? xttsBufferTargets.initialSeconds : 1)
      const firstBatchStreamPromise = shouldStreamFirstBatch ? streamFirstBatch(batches[0]) : null
      if (engine === 'chatterbox' && xttsBufferTargets) {
        await ensureReadyAudio(shouldStreamFirstBatch ? 1 : 0, xttsBufferTargets.initialSeconds)
      } else {
        triggerUpTo((shouldStreamFirstBatch ? 1 : 0) + bufferSize)

        if (!shouldStreamFirstBatch && batches.length > 0 && audioPromises[0]) {
          await audioPromises[0]
        }
      }

      for (let i = 0; i < batches.length; i++) {
        while (isPausedRef.current) {
          if (stopSignalRef.current) break
          await new Promise((r) => setTimeout(r, 200))
        }

        if (stopSignalRef.current) break

        const batch = batches[i]
        let result: AudioResult | null = null

        if (i === 0 && firstBatchStreamPromise) {
          const streamResult = await firstBatchStreamPromise
          if (streamResult.mode === 'cancelled' || stopSignalRef.current) break

          if (streamResult.mode !== 'fallback') {
            if (i === 0) {
              bufferSize = getDesiredBufferSize(i + 1, effectiveSteadyBuffer)
            }
            triggerUpTo(i + 1 + bufferSize)
            continue
          }
        }

        if (!audioPromises[i]) {
          triggerGeneration(i)
        }

        if (engine === 'chatterbox' && xttsBufferTargets) {
          void ensureReadyAudio(i, xttsBufferTargets.steadySeconds)
        }

        try {
          result = await audioPromises[i]
        } catch (err) {
          console.warn('Generation failed', err)
          continue
        }

        if (stopSignalRef.current) break
        if (result?.status === 'cancelled') break
        if (engine === 'chatterbox' && xttsBufferTargets) {
          void ensureReadyAudio(i + 1, xttsBufferTargets.steadySeconds)
        } else {
          if (i === 0) {
            bufferSize = getDesiredBufferSize(i + 1, effectiveSteadyBuffer)
          }
          triggerUpTo(i + 1 + bufferSize)
        }

        if (result && result.status === 'skipped') {
          const idx = batch.globalIndices[0]

          const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current)
          highlightScheduleRef.current.push({ time: startTime, globalIndex: idx })
          playbackEndTimeRef.current = startTime + IMAGE_PAUSE_SEC

          const imagePause = IMAGE_PAUSE_SEC
          nextStartTimeRef.current = startTime + imagePause

          const waitMs = (nextStartTimeRef.current - ctx.currentTime) * 1000
          if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs))
          continue
        }

        if (result && result.status === 'success' && result.audio_data) {
          try {
            let audioBuffer = decodedBuffers[i]
            if (!audioBuffer) {
              const cacheKey = buildCacheKey(batch.text, engine, voicePath, speed, xttsQuality)
              audioBuffer = await decodeToBuffer(cacheKey, result as CachedAudio)
              if (audioBuffer) decodedBuffers[i] = audioBuffer
            }
            if (!audioBuffer) continue

            const nextBatch = i + 1 < batches.length ? batches[i + 1] : null
            const joinGapSec =
              engine === 'chatterbox' ? getXttsJoinGapForBatch(batch, nextBatch) : 0

            const { start } = scheduleAudioBuffer(ctx, audioBuffer, bufferedFadeSec, {
              joinGapSec,
              playbackRate
            })
            markPlaybackStarted()

            const durations = estimateSentenceDurations(
              batch.sentences,
              audioBuffer.duration / playbackRate
            )
            let accumulatedTime = 0
            durations.forEach((dur, idx) => {
              const triggerTime = start + accumulatedTime + 0.08
              highlightScheduleRef.current.push({
                time: triggerTime,
                globalIndex: batch.globalIndices[idx]
              })
              accumulatedTime += dur
            })

            const timeUntilNext = nextStartTimeRef.current - ctx.currentTime
            if (timeUntilNext > 4) {
              let waitTime = (timeUntilNext - 2) * 1000
              while (waitTime > 0 && !stopSignalRef.current) {
                if (isPausedRef.current) {
                  await new Promise((r) => setTimeout(r, 200))
                  continue
                }
                const chunk = Math.min(waitTime, 200)
                await new Promise((r) => setTimeout(r, chunk))
                waitTime -= chunk
              }
            }
          } catch (decodeErr) {
            console.error('Decode Error', decodeErr)
          }
        }
      }

      if (!stopSignalRef.current) {
        let remainingMs = Math.max(0, (playbackEndTimeRef.current - ctx.currentTime) * 1000)
        while (remainingMs > 0 && !stopSignalRef.current) {
          if (isPausedRef.current) {
            await new Promise((r) => setTimeout(r, 200))
            remainingMs = Math.max(0, (playbackEndTimeRef.current - ctx.currentTime) * 1000)
            continue
          }
          const chunk = Math.min(remainingMs, 200)
          await new Promise((r) => setTimeout(r, chunk))
          remainingMs = Math.max(0, (playbackEndTimeRef.current - ctx.currentTime) * 1000)
        }

        setStatus('Completed')
        setBuffering(EMPTY_BUFFER_STATE)
        setIsPlaying(false)
        setIsPaused(false)
        setGlobalSentenceIndex(-1)
        highlightedSentenceIndexRef.current = -1
      }
    } catch (e: any) {
      console.error(e)
      setStatus('Error: ' + e.message)
      setBuffering(EMPTY_BUFFER_STATE)
      setIsPlaying(false)
      highlightedSentenceIndexRef.current = -1
    } finally {
      isPlayingRef.current = false
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPlayingRef.current || isPausedRef.current || !audioCtxRef.current) return

      const t = audioCtxRef.current.currentTime
      const schedule = highlightScheduleRef.current
      let cursor = highlightCursorRef.current

      if (cursor >= schedule.length) return

      while (cursor < schedule.length && schedule[cursor].time <= t + 0.05) {
        cursor += 1
      }

      if (cursor === highlightCursorRef.current) return

      highlightCursorRef.current = cursor
      const trigger = schedule[cursor - 1]
      if (highlightedSentenceIndexRef.current !== trigger.globalIndex) {
        highlightedSentenceIndexRef.current = trigger.globalIndex
        setGlobalSentenceIndex(trigger.globalIndex)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      void stop()
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch((error) => {
          console.error(error)
        })
        audioCtxRef.current = null
      }
    }
  }, [])

  return { isPlaying, isPaused, globalSentenceIndex, status, buffering, play, pause, stop }
}
