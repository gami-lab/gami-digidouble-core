import type { MessageStreamEvent } from '@gami/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendVoiceMessageStream } from './conversations'

const terminalEvent: MessageStreamEvent = {
  type: 'conversation.message.error',
  requestId: 'request_1',
  conversationId: 'conversation_1',
  message: 'stop',
}

function sseResponse(events: MessageStreamEvent[]): Response {
  const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(payload, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('voice message stream API client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uploads the raw recording with voice headers and parses the reply stream', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([terminalEvent]))
    const audio = new Blob([Uint8Array.from([1, 2, 3])], { type: 'audio/webm;codecs=opus' })
    const received: MessageStreamEvent[] = []

    await sendVoiceMessageStream(
      'conversation_1',
      { audio, utteranceId: 'utterance_1', durationMs: 1234.6 },
      { onEvent: (event) => received.push(event) },
    )

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? []
    expect(requestUrl).toContain('/v1/conversations/conversation_1/voice-messages/stream')
    expect(requestInit?.method).toBe('POST')
    expect(requestInit?.body).toBe(audio)
    const headers = new Headers(requestInit?.headers)
    expect(headers.get('Content-Type')).toBe('audio/webm;codecs=opus')
    expect(headers.get('x-utterance-id')).toBe('utterance_1')
    expect(headers.get('x-audio-duration-ms')).toBe('1235')
    expect(headers.get('x-api-key')).toEqual(expect.any(String))
    expect(received).toEqual([terminalEvent])
  })

  it('surfaces a voice route error envelope as an ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ data: null, error: { code: 'PROVIDER_ERROR', message: 'No STT' } }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(
      sendVoiceMessageStream(
        'conversation_1',
        { audio: new Blob([Uint8Array.from([1])], { type: 'audio/webm' }), utteranceId: 'u2' },
        { onEvent: vi.fn() },
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_ERROR', message: 'No STT' })
  })
})
