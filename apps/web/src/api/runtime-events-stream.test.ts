import { describe, expect, it, vi } from 'vitest'
import { subscribeToRuntimeEvents } from './runtime-events-stream'

describe('subscribeToRuntimeEvents', () => {
  it('parses runtime event SSE frames from the session stream', async () => {
    const onEvent = vi.fn()
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: runtime_event\nid: e1\ndata: {"eventId":"e1","sessionId":"s1","type":"runtime.avatar_unlocked","occurredAt":"2026-06-01T10:00:00.000Z","payload":{}}\n\n',
          ),
        )
        controller.close()
      },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: stream as unknown as Response['body'],
      } satisfies Partial<Response>),
    )

    const subscription = subscribeToRuntimeEvents('s1', { onEvent })
    await new Promise((resolve) => setTimeout(resolve, 0))
    subscription.close()

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e1',
        sessionId: 's1',
        type: 'runtime.avatar_unlocked',
      }),
    )
  })
})
