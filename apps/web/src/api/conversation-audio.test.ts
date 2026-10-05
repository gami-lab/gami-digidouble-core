import type { AudioDeliveryMetadata } from '@gami/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './client'
import { requestMessageAudio } from './conversations'

const metadata: AudioDeliveryMetadata = {
  requestId: 'request_1',
  messageId: 'message_1',
  format: 'audio/pcm',
}

describe('message audio API client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests binary audio with shared options and hands back the unread stream', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: {
          'Content-Type': metadata.format,
          'X-Request-Id': metadata.requestId,
          'X-Message-Id': metadata.messageId,
        },
      }),
    )
    const controller = new AbortController()

    const result = await requestMessageAudio(
      'conversation_1',
      metadata.messageId,
      { format: metadata.format },
      controller.signal,
    )

    expect(result.metadata).toEqual(metadata)
    expect(new Uint8Array(await new Response(result.body).arrayBuffer())).toEqual(
      Uint8Array.from([1, 2, 3]),
    )
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toContain('/v1/conversations/conversation_1/messages/message_1/audio')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ format: metadata.format }))
    expect(new Headers(init?.headers).get('Accept')).toBe('audio/*')
    expect(init?.signal).toBe(controller.signal)
  })

  it('normalizes the standard JSON error envelope for binary failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          error: { code: 'NOT_FOUND', message: 'Message was not found.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(requestMessageAudio('conversation_1', 'missing')).rejects.toEqual(
      new ApiError('NOT_FOUND', 'Message was not found.'),
    )
  })

  it('rejects audio for another message or with invalid metadata before playback', async () => {
    const respond = (headers: Record<string, string>): void => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(Uint8Array.from([1, 2]), { status: 200, headers }),
      )
    }

    respond({ 'Content-Type': 'audio/pcm', 'X-Request-Id': 'r', 'X-Message-Id': 'other' })
    await expect(requestMessageAudio('conversation_1', metadata.messageId)).rejects.toThrow(
      'identity mismatch',
    )
    respond({ 'Content-Type': 'audio/flac', 'X-Request-Id': 'r', 'X-Message-Id': 'message_1' })
    await expect(requestMessageAudio('conversation_1', metadata.messageId)).rejects.toThrow(
      'Invalid audio response metadata',
    )
  })

  it('passes caller cancellation to fetch without replacing the abort error', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
      expect(init?.signal).toBe(controller.signal)
      controller.abort()
      return Promise.reject(abortError)
    })

    await expect(
      requestMessageAudio('conversation_1', metadata.messageId, {}, controller.signal),
    ).rejects.toBe(abortError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
