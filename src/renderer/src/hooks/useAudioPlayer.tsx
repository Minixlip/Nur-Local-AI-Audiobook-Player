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
}

interface HighlightTrigger {
  time: number
  globalIndex: number
}

interface CachedAudio {
  status: string
  audio_data: Uint8Array | null
}

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
const STREAMED_PIPER_FIRST_BATCH_WORDS = 1
const STREAM_INITIAL_PCM_BYTES = 4096
const STREAM_STEADY_PCM_BYTES = 16384
const STREAM_CHUNK_FADE_SEC = 0.008

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

const getBatchRampForEngine = (engine: string, lowEndMode: boolean) => {
  const baseRamp = lowEndMode ? LOW_END_BATCH_RAMP : DEFAULT_BATCH_RAMP
  return engine === 'piper' ? [STREAMED_PIPER_FIRST_BATCH_WORDS, ...baseRamp] : baseRamp
}

export function useAudioPlayer({
  bookStructure,
  visualPageIndex
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [globalSentenceIndex, setGlobalSentenceIndex] = useState(-1)
  const [status, setStatus] = useState('Idle')

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

  const scheduleAudioBuffer = (ctx: AudioContext, audioBuffer: AudioBuffer, fadeSec: number) => {
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer

    const start = Math.max(ctx.currentTime, nextStartTimeRef.current)
    const gainNode = ctx.createGain()
    const safeFadeSec = Math.min(fadeSec, audioBuffer.duration * 0.25)

    if (safeFadeSec > 0) {
      gainNode.gain.setValueAtTime(0, start)
      gainNode.gain.linearRampToValueAtTime(1, start + safeFadeSec)
      gainNode.gain.setValueAtTime(1, Math.max(start, start + audioBuffer.duration - safeFadeSec))
      gainNode.gain.linearRampToValueAtTime(0, start + audioBuffer.duration)
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
    const overlap = Math.min(safeFadeSec, audioBuffer.duration * 0.25)
    const endTime = start + audioBuffer.duration
    nextStartTimeRef.current = Math.max(start + 0.02, endTime - overlap)
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

  const buildCacheKey = (text: string, engine: string, voicePath: string | null, speed: number) =>
    `${engine}:${voicePath || 'default'}:${speed}:${text}`

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
    batchRamp: number[],
    batchSizeStandard: number,
    maxTtsChars: number
  ) => {
    const batches: AudioBatch[] = []
    const orderedIndices: number[] = []
    const pages = bookStructure.pagesStructure

    if (pages && pages[startPageIndex]) {
      for (let pageIdx = startPageIndex; pageIdx < pages.length; pageIdx++) {
        const blocks = pages[pageIdx] || []
        for (const block of blocks) {
          if (block.type === 'image') {
            orderedIndices.push(block.startIndex)
          } else {
            for (let i = 0; i < block.content.length; i++) {
              orderedIndices.push(block.startIndex + i)
            }
          }
        }
      }
    }

    const safeStartIndex =
      orderedIndices.length > 0
        ? orderedIndices[0]
        : bookStructure.sentenceToPageMap.findIndex((p) => p === startPageIndex)

    const activeIndices =
      orderedIndices.length > 0
        ? orderedIndices
        : bookStructure.allSentences.map((_, idx) => idx).slice(Math.max(0, safeStartIndex))

    const activeSentences = activeIndices.map((idx) => bookStructure.allSentences[idx])
    const getGlobalIndex = (localIndex: number) => activeIndices[localIndex]

    let currentBatchText: string[] = []
    let currentBatchIndices: number[] = []
    let currentWordCount = 0
    let currentCharCount = 0
    let batchIndex = 0

    for (let i = 0; i < activeSentences.length; i++) {
      const text = activeSentences[i]
      const globalIdx = getGlobalIndex(i)

      if (text.includes('[[[IMG_MARKER')) {
        if (currentBatchText.length > 0) {
          batches.push({
            text: currentBatchText.join(' '),
            sentences: [...currentBatchText],
            globalIndices: [...currentBatchIndices]
          })
          currentBatchText = []
          currentBatchIndices = []
          currentWordCount = 0
          currentCharCount = 0
          batchIndex++
        }
        batches.push({ text: '[[[IMAGE]]]', sentences: [text], globalIndices: [globalIdx] })
        continue
      }

      const wordCount = text.split(/\s+/).length
      const nextCharCount = currentCharCount + (currentCharCount > 0 ? 1 : 0) + text.length
      currentBatchText.push(text)
      currentBatchIndices.push(globalIdx)
      currentWordCount += wordCount

      const targetSize =
        batchIndex < batchRamp.length ? batchRamp[batchIndex] : batchSizeStandard

      if (currentWordCount >= targetSize || nextCharCount > maxTtsChars) {
        batches.push({
          text: currentBatchText.join(' '),
          sentences: [...currentBatchText],
          globalIndices: [...currentBatchIndices]
        })
        currentBatchText = []
        currentBatchIndices = []
        currentWordCount = 0
        currentCharCount = 0
        batchIndex++
      }
      currentCharCount = nextCharCount
    }
    if (currentBatchText.length > 0) {
      batches.push({
        text: currentBatchText.join(' '),
        sentences: [...currentBatchText],
        globalIndices: [...currentBatchIndices]
      })
    }

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
      const batchRamp = getBatchRampForEngine(engine, lowEndMode)
      const batchSizeStandard = lowEndMode ? LOW_END_BATCH_SIZE_STANDARD : DEFAULT_BATCH_SIZE_STANDARD
      const maxTtsChars = lowEndMode ? LOW_END_MAX_TTS_CHARS : DEFAULT_MAX_TTS_CHARS

      const batches = buildBatches(visualPageIndex, batchRamp, batchSizeStandard, maxTtsChars)
      const firstBatch = batches[0]
      if (!firstBatch || firstBatch.text === '[[[IMAGE]]]' || !firstBatch.text.trim()) return

      const voicePath =
        engine === 'piper'
          ? localStorage.getItem('piper_model_path')
          : localStorage.getItem('custom_voice_path')
      const speed = 1.2
      const cacheKey = buildCacheKey(firstBatch.text, engine, voicePath, speed)
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
        voicePath: voicePath
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
    const batchRamp = getBatchRampForEngine(engine, lowEndMode)
    const batchSizeStandard = lowEndMode ? LOW_END_BATCH_SIZE_STANDARD : DEFAULT_BATCH_SIZE_STANDARD
    const maxTtsChars = lowEndMode ? LOW_END_MAX_TTS_CHARS : DEFAULT_MAX_TTS_CHARS
    const initialDefault = lowEndMode ? LOW_END_INITIAL_BUFFER : DEFAULT_INITIAL_BUFFER
    const steadyDefault = lowEndMode ? LOW_END_STEADY_BUFFER : DEFAULT_STEADY_BUFFER
    const storedInitial = Number(localStorage.getItem('audio_buffer_initial'))
    const storedSteady = Number(localStorage.getItem('audio_buffer_steady'))
    const storedCrossfadeMs = Number(localStorage.getItem('audio_crossfade_ms'))
    const initialBuffer =
      Number.isFinite(storedInitial) && storedInitial > 0 ? storedInitial : initialDefault
    const steadyBuffer =
      Number.isFinite(storedSteady) && storedSteady > 0 ? storedSteady : steadyDefault
    const fadeSec = Number.isFinite(storedCrossfadeMs)
      ? Math.min(MAX_CROSSFADE_SEC, Math.max(0, storedCrossfadeMs / 1000))
      : DEFAULT_CROSSFADE_SEC

    const batches = buildBatches(visualPageIndex, batchRamp, batchSizeStandard, maxTtsChars)

    const audioPromises: Array<Promise<AudioResult> | null> = new Array(batches.length).fill(null)
    const decodedBuffers: Array<AudioBuffer | null> = new Array(batches.length).fill(null)
    let bufferSize = initialBuffer
    let hasStartedPlayback = false
    const voicePath =
      engine === 'piper'
        ? localStorage.getItem('piper_model_path')
        : localStorage.getItem('custom_voice_path')
    const speed = 1.2

    const markPlaybackStarted = () => {
      if (!hasStartedPlayback) {
        setStatus('Reading...')
        hasStartedPlayback = true
      }
    }

    const triggerGeneration = (index: number) => {
      if (index >= batches.length || audioPromises[index]) return
      const batch = batches[index]

      if (batch.text === '[[[IMAGE]]]') {
        audioPromises[index] = Promise.resolve({ status: 'skipped', audio_data: null })
      } else {
        const cacheKey = buildCacheKey(batch.text, engine, voicePath, speed)
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

          const result = await window.api.generate(batch.text, speed, newSessionId, {
            engine: engine,
            voicePath: voicePath
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

    const shouldStreamFirstPiperBatch =
      engine === 'piper' &&
      batches[0]?.text !== '[[[IMAGE]]]' &&
      batches[0]?.globalIndices.length === 1

    const streamPiperBatch = async (batch: AudioBatch) => {
      if (!voicePath) {
        return { mode: 'fallback' as const, started: false }
      }

      const controller = new AbortController()
      streamAbortControllerRef.current = controller
      let pendingPcm = new Uint8Array(0)
      let scheduledAudio = false
      let sampleRate = 22050

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
          Math.min(fadeSec, STREAM_CHUNK_FADE_SEC)
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
            engine: 'piper',
            speaker_wav: voicePath,
            piper_model_path: voicePath,
            language: 'en',
            speed
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

        console.warn('Piper stream failed', error)
        return scheduledAudio
          ? { mode: 'partial' as const, started: true }
          : { mode: 'fallback' as const, started: false }
      } finally {
        if (streamAbortControllerRef.current === controller) {
          streamAbortControllerRef.current = null
        }
      }
    }

    let nextGenerationIndex = shouldStreamFirstPiperBatch ? 1 : 0
    const triggerUpTo = (targetExclusive: number) => {
      while (nextGenerationIndex < batches.length && nextGenerationIndex < targetExclusive) {
        triggerGeneration(nextGenerationIndex)
        nextGenerationIndex += 1
      }
    }

    try {
      setStatus('Buffering...')
      const firstBatchStreamPromise = shouldStreamFirstPiperBatch ? streamPiperBatch(batches[0]) : null
      triggerUpTo((shouldStreamFirstPiperBatch ? 1 : 0) + bufferSize)

      if (!shouldStreamFirstPiperBatch && batches.length > 0 && audioPromises[0]) {
        await audioPromises[0]
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
            if (i === 0) bufferSize = steadyBuffer
            triggerUpTo(i + 1 + bufferSize)
            continue
          }
        }

        if (!audioPromises[i]) {
          triggerGeneration(i)
        }

        try {
          result = await audioPromises[i]
        } catch (err) {
          console.warn('Generation failed', err)
          continue
        }

        if (stopSignalRef.current) break
        if (i === 0) bufferSize = steadyBuffer
        triggerUpTo(i + 1 + bufferSize)

        if (result && result.status === 'skipped') {
          const idx = batch.globalIndices[0]

          const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current)
          highlightScheduleRef.current.push({ time: startTime, globalIndex: idx })
          playbackEndTimeRef.current = startTime + 2.0

          const imagePause = 2.0
          nextStartTimeRef.current = startTime + imagePause

          const waitMs = (nextStartTimeRef.current - ctx.currentTime) * 1000
          if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs))
          continue
        }

        if (result && result.status === 'success' && result.audio_data) {
          try {
            let audioBuffer = decodedBuffers[i]
            if (!audioBuffer) {
              const cacheKey = buildCacheKey(batch.text, engine, voicePath, speed)
              audioBuffer = await decodeToBuffer(cacheKey, result as CachedAudio)
              if (audioBuffer) decodedBuffers[i] = audioBuffer
            }
            if (!audioBuffer) continue

            const { start } = scheduleAudioBuffer(ctx, audioBuffer, fadeSec)
            markPlaybackStarted()

            const durations = estimateSentenceDurations(batch.sentences, audioBuffer.duration)
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
        setIsPlaying(false)
        setIsPaused(false)
        setGlobalSentenceIndex(-1)
        highlightedSentenceIndexRef.current = -1
      }
    } catch (e: any) {
      console.error(e)
      setStatus('Error: ' + e.message)
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

  return { isPlaying, isPaused, globalSentenceIndex, status, play, pause, stop }
}
