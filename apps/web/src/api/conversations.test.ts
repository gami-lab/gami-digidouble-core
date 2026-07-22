import type { MessageStreamEvent } from '@gami/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendMessageStream } from './conversations'

describe('message stream API client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses shared stream events across chunk boundaries and forwards the request', async () => {
    const events: MessageStreamEvent[] = [
      {
        type: 'conversation.message.started',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        userMessage: {
          messageId: 'message_user_1',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'Hello',
          createdAt: '2026-06-01T12:00:00.000Z',
        },
      },
      {
        type: 'conversation.message.delta',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        sequence: 0,
        delta: 'Hi',
      },
      {
        type: 'conversation.message.interrupted',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        reason: 'provider_aborted',
      },
    ]
    const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(streamFromChunks([payload.slice(0, 23), payload.slice(23)]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )
    const received: MessageStreamEvent[] = []

    await sendMessageStream(
      'conversation_1',
      { message: { content: 'Hello' } },
      { onEvent: (event) => received.push(event) },
    )

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? []
    expect(requestUrl).toContain('/v1/conversations/conversation_1/messages/stream')
    expect(requestInit?.method).toBe('POST')
    expect(requestInit?.body).toBe(JSON.stringify({ message: { content: 'Hello' } }))
    const requestHeaders = new Headers(requestInit?.headers)
    expect(requestHeaders.get('Content-Type')).toBe('application/json')
    expect(requestHeaders.get('x-api-key')).toEqual(expect.any(String))
    expect(received).toEqual(events)
  })

  it('rejects a stream that closes without a terminal event', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(streamFromChunks(['data: {"type":"conversation.message.delta"}\n\n']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    await expect(
      sendMessageStream('conversation_1', { message: { content: 'Hello' } }, { onEvent: vi.fn() }),
    ).rejects.toThrow('Message stream ended before completion')
  })

  it('cancels the response reader when the caller aborts', async () => {
    const controller = new AbortController()
    let cancelCount = 0
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.enqueue(
          encoder.encode(
            'data: {"type":"conversation.message.delta","requestId":"request_1","conversationId":"conversation_1","sequence":0,"delta":"Partial"}\n\n',
          ),
        )
      },
      cancel() {
        cancelCount += 1
      },
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )

    await sendMessageStream(
      'conversation_1',
      { message: { content: 'Hello' } },
      {
        onEvent: () => {
          controller.abort()
        },
      },
      controller.signal,
    )

    expect(cancelCount).toBe(1)
  })
})

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}
