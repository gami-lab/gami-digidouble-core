import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  normalizeSpeechToTextInput,
  SPEECH_TO_TEXT_LIMITS,
} from '../../application/ports/ISpeechToTextAdapter.js'
import { NullObservabilityAdapter } from '../observability/index.js'
import {
  DEFAULT_DEEPGRAM_MODEL,
  DEFAULT_DEEPGRAM_TIMEOUT_MS,
  DeepgramSpeechToTextAdapter,
  FetchDeepgramTransport,
} from './deepgram-speech-to-text.adapter.js'

const apiKey = process.env['DEEPGRAM_API_KEY']
const audioPath = process.env['DEEPGRAM_LIVE_AUDIO_PATH']
const enabled =
  process.env['DEEPGRAM_LIVE_SMOKE'] === '1' && apiKey !== undefined && audioPath !== undefined

describe.skipIf(!enabled)('Deepgram live smoke', () => {
  it('returns a finalized transcript for the supplied opt-in fixture', async () => {
    if (apiKey === undefined || audioPath === undefined) throw new Error('Live smoke is disabled.')

    const audio = await readFile(audioPath)
    const input = normalizeSpeechToTextInput({
      conversationId: 'live-smoke-conversation',
      utteranceId: 'live-smoke-utterance',
      audio,
      mediaType: process.env['DEEPGRAM_LIVE_MEDIA_TYPE'] ?? 'audio/wav',
      language: process.env['DEEPGRAM_LIVE_LANGUAGE'] ?? undefined,
    })
    const adapter = new DeepgramSpeechToTextAdapter(
      {
        apiKey,
        model: process.env['DEEPGRAM_MODEL'] ?? DEFAULT_DEEPGRAM_MODEL,
        timeoutMs: Number(process.env['DEEPGRAM_TIMEOUT_MS'] ?? DEFAULT_DEEPGRAM_TIMEOUT_MS),
        defaultLanguage: process.env['DEEPGRAM_DEFAULT_LANGUAGE'] ?? 'en',
        limits: SPEECH_TO_TEXT_LIMITS,
      },
      new NullObservabilityAdapter(),
      new FetchDeepgramTransport(),
    )

    const result = await adapter.transcribe(input)
    expect(result.kind).toBe('final')
    expect(result.transcript.trim().length).toBeGreaterThan(0)
  })
})
