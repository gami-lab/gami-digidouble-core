import type { VoiceConfiguration } from '@gami/shared'

export function toVoiceConfiguration(
  voiceKey: string,
  language: string,
): VoiceConfiguration | undefined {
  const normalizedVoiceKey = voiceKey.trim()
  if (normalizedVoiceKey.length === 0) return undefined

  const normalizedLanguage = language.trim()
  return {
    voiceKey: normalizedVoiceKey,
    ...(normalizedLanguage.length > 0 ? { language: normalizedLanguage } : {}),
  }
}
