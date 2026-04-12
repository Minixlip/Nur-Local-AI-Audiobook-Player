export const TRANSLATION_LANGUAGE_LABELS = {
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic'
} as const

export type TranslationTargetLanguage = keyof typeof TRANSLATION_LANGUAGE_LABELS

export interface TranslationResult {
  translatedText: string
  targetLanguage: TranslationTargetLanguage
}
