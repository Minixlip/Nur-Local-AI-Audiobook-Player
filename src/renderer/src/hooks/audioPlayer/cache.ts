import { CachedAudio } from './types'

const AUDIO_CACHE_LIMIT = 80
const DECODED_AUDIO_CACHE_LIMIT = 24
const AUDIO_CACHE_DB = 'nur-audio-cache'
const AUDIO_CACHE_STORE = 'audio'
const AUDIO_CACHE_DISK_LIMIT = 120
const XTTS_AUDIO_CACHE_VERSION = 'chatterbox_audio_v1'

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

const buildCacheKey = (
  text: string,
  engine: string,
  voicePath: string | null,
  speed: number,
  xttsQuality: string
) =>
  `${engine}:${voicePath || 'default'}:${engine === 'chatterbox' ? `${XTTS_AUDIO_CACHE_VERSION}:${xttsQuality}` : `${speed}:standard`}:${text}`

export {
  AUDIO_CACHE_LIMIT,
  DECODED_AUDIO_CACHE_LIMIT,
  AUDIO_CACHE_DB,
  AUDIO_CACHE_STORE,
  AUDIO_CACHE_DISK_LIMIT,
  XTTS_AUDIO_CACHE_VERSION,
  openAudioCache,
  getCachedAudioFromDisk,
  setCachedAudioOnDisk,
  pruneDiskCache,
  concatUint8Arrays,
  createPcmAudioBuffer,
  buildCacheKey
}
