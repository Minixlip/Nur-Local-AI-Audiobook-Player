import { VisualBlock } from '../../types/book'

export interface AudioPlayerBookStructure {
  allSentences: string[]
  sentenceToPageMap: number[]
  pagesStructure?: VisualBlock[][]
}

export interface AudioPlayerProps {
  bookStructure: AudioPlayerBookStructure
  visualPageIndex: number
}

export interface AudioBatch {
  text: string
  sentences: string[]
  globalIndices: number[]
  endsParagraph: boolean
}

export interface HighlightTrigger {
  time: number
  globalIndex: number
}

export interface AudioResult {
  status: string
  audio_data: Uint8Array | null
}

export interface CachedAudio {
  status: string
  audio_data: Uint8Array | null
}

export interface PlaybackBufferState {
  active: boolean
  engine: string | null
  progress: number
  readySeconds: number
  targetSeconds: number
  label: string
  detail: string
}

export type XttsQualityMode = 'balanced' | 'studio'

export const EMPTY_BUFFER_STATE: PlaybackBufferState = {
  active: false,
  engine: null,
  progress: 0,
  readySeconds: 0,
  targetSeconds: 0,
  label: '',
  detail: ''
}
