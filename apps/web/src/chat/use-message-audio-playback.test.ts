// @vitest-environment jsdom

import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { AudioDeliveryMetadata } from '@gami/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { requestMessageAudio, type MessageAudioDelivery } from '../api/conversations'
import { useMessageAudioPlayback } from './use-message-audio-playback'

vi.mock('../api/conversations', () => ({
  requestMessageAudio: vi.fn(),
}))

const metadata: AudioDeliveryMetadata = {
  requestId: 'request_1',
  messageId: 'message_1',
  format: 'audio/pcm',
}

type FakeSource = {
  buffer: { length: number } | null
  startedAt: number | null
  connect: () => void
  start: (when: number) => void
  addEventListener: (type: 'ended', listener: () => void) => void
  end: () => void
}

/** Minimal Web Audio stand-in: records scheduled chunks and lets tests end them. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  static startSuspended = false
  state: 'running' | 'suspended' | 'closed' = 'suspended'
  currentTime = 0
  readonly destination = {}
  readonly sources: FakeSource[] = []

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  resume(): Promise<void> {
    if (FakeAudioContext.startSuspended) return new Promise(() => undefined)
    this.state = 'running'
    return Promise.resolve()
  }

  close(): Promise<void> {
    this.state = 'closed'
    return Promise.resolve()
  }

  createBuffer(_channels: number, length: number): { length: number; copyToChannel: () => void } {
    return { length, copyToChannel: () => undefined }
  }

  createBufferSource(): FakeSource {
    const listeners: (() => void)[] = []
    const source: FakeSource = {
      buffer: null,
      startedAt: null,
      connect: () => undefined,
      start: (when) => {
        source.startedAt = when
      },
      addEventListener: (_type, listener) => {
        listeners.push(listener)
      },
      end: () => {
        for (const listener of listeners) listener()
      },
    }
    this.sources.push(source)
    return source
  }
}

/** A delivery whose body stays open until the test pushes `null`. */
function streamedDelivery(messageId = metadata.messageId): {
  delivery: MessageAudioDelivery
  push: (chunk: Uint8Array | null) => void
} {
  let push: (chunk: Uint8Array | null) => void = () => undefined
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (chunk) => {
        if (chunk === null) controller.close()
        else controller.enqueue(chunk)
      }
    },
  })
  return {
    delivery: { body, metadata: { ...metadata, messageId } },
    push: (chunk) => {
      push(chunk)
    },
  }
}

function finishedDelivery(messageId = metadata.messageId): MessageAudioDelivery {
  const { delivery, push } = streamedDelivery(messageId)
  push(Uint8Array.from([0, 0, 0, 0]))
  push(null)
  return delivery
}

function lastContext(): FakeAudioContext {
  const context = FakeAudioContext.instances.at(-1)
  if (context === undefined) throw new Error('No AudioContext was created.')
  return context
}

// eslint-disable-next-line max-lines-per-function
describe('useMessageAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    FakeAudioContext.instances = []
    FakeAudioContext.startSuspended = false
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts playing on the first PCM chunk while the reply is still streaming', async () => {
    const { delivery, push } = streamedDelivery()
    vi.mocked(requestMessageAudio).mockResolvedValue(delivery)
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })
    expect(result.current.audio).toMatchObject({ messageId: 'message_1', status: 'loading' })
    expect(requestMessageAudio).toHaveBeenCalledWith(
      'conversation_1',
      'message_1',
      { format: 'audio/pcm' },
      expect.any(AbortSignal),
    )

    push(Uint8Array.from([0, 0, 0]))
    await waitFor(() => {
      expect(result.current.audio.status).toBe('playing')
    })
    // 24 kHz PCM: one complete sample now, the odd byte waits for the next chunk.
    const context = lastContext()
    expect(context.sources.map((source) => source.buffer?.length)).toEqual([1])

    push(Uint8Array.from([0, 0, 0]))
    push(null)
    await waitFor(() => {
      expect(context.sources).toHaveLength(2)
    })
    const [first, second] = context.sources
    expect(second?.buffer?.length).toBe(2)
    expect(second?.startedAt).toBeCloseTo((first?.startedAt ?? 0) + 1 / 24_000)

    act(() => {
      second?.end()
    })
    await waitFor(() => {
      expect(result.current.audio).toMatchObject({ status: 'stopped', errorCode: null })
    })
    expect(context.state).toBe('closed')
  })

  it('still starts playback under React StrictMode remounting', async () => {
    vi.mocked(requestMessageAudio).mockResolvedValue(finishedDelivery())
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'), {
      wrapper: StrictMode,
    })

    act(() => {
      result.current.playMessageAudio('message_1')
    })

    await waitFor(() => {
      expect(result.current.audio.status).toBe('playing')
    })
  })

  it('keeps text fallback available when the browser blocks autoplay', async () => {
    FakeAudioContext.startSuspended = true
    vi.mocked(requestMessageAudio).mockResolvedValue(finishedDelivery())
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })

    await waitFor(() => {
      expect(result.current.audio).toMatchObject({
        status: 'stopped',
        errorCode: 'AUTOPLAY_BLOCKED',
      })
    })
    expect(lastContext().state).toBe('closed')
  })

  it('stops active playback and releases the audio context and request', async () => {
    let signal: AbortSignal | undefined
    const { delivery, push } = streamedDelivery()
    vi.mocked(requestMessageAudio).mockImplementation((_c, _m, _r, requestSignal) => {
      signal = requestSignal
      return Promise.resolve(delivery)
    })
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })
    push(Uint8Array.from([0, 0]))
    await waitFor(() => {
      expect(result.current.audio.status).toBe('playing')
    })

    act(() => {
      result.current.stopMessageAudio()
    })

    expect(result.current.audio.status).toBe('stopped')
    expect(signal?.aborted).toBe(true)
    expect(lastContext().state).toBe('closed')
  })

  it('maps request failures without exposing raw error text', async () => {
    vi.mocked(requestMessageAudio).mockRejectedValue(
      new ApiError('PROVIDER_ERROR', 'provider payload should stay hidden'),
    )
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })

    await waitFor(() => {
      expect(result.current.audio).toMatchObject({ status: 'failed', errorCode: 'PROVIDER_ERROR' })
    })
    expect(result.current.audio).not.toHaveProperty(
      'message',
      'provider payload should stay hidden',
    )
  })

  it('fails when the stream breaks before any audio arrived', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new TypeError('network'))
      },
    })
    vi.mocked(requestMessageAudio).mockResolvedValue({ body, metadata })
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })

    await waitFor(() => {
      expect(result.current.audio).toMatchObject({ status: 'failed', errorCode: 'NETWORK_ERROR' })
    })
  })

  it('aborts and cleans up when stopped or the conversation changes', () => {
    let signal: AbortSignal | undefined
    vi.mocked(requestMessageAudio).mockImplementation((_c, _m, _r, requestSignal) => {
      signal = requestSignal
      return new Promise<MessageAudioDelivery>(() => undefined)
    })
    const { result, rerender } = renderHook(
      ({ conversationId }) => useMessageAudioPlayback(conversationId),
      { initialProps: { conversationId: 'conversation_1' } },
    )

    act(() => {
      result.current.playMessageAudio('message_1')
    })
    expect(signal?.aborted).toBe(false)

    act(() => {
      result.current.stopMessageAudio()
    })
    expect(signal?.aborted).toBe(true)

    act(() => {
      rerender({ conversationId: 'conversation_2' })
    })
    expect(result.current.audio).toMatchObject({ messageId: null, status: 'idle' })
  })

  it('ignores stale delivery from an earlier message', async () => {
    const resolvers: ((value: MessageAudioDelivery) => void)[] = []
    vi.mocked(requestMessageAudio).mockImplementation(
      () =>
        new Promise<MessageAudioDelivery>((resolve) => {
          resolvers.push(resolve)
        }),
    )
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
      result.current.playMessageAudio('message_2')
    })
    const [firstContext, secondContext] = FakeAudioContext.instances

    await act(async () => {
      resolvers[0]?.(finishedDelivery('message_1'))
      await Promise.resolve()
    })
    expect(firstContext?.sources).toEqual([])

    await act(async () => {
      resolvers[1]?.(finishedDelivery('message_2'))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.audio).toMatchObject({ messageId: 'message_2', status: 'playing' })
    })
    expect(secondContext?.sources).toHaveLength(1)
  })

  it('reports unsupported browser playback without requesting audio', () => {
    vi.stubGlobal('AudioContext', undefined)
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })

    expect(result.current.audio).toMatchObject({ status: 'unsupported', messageId: 'message_1' })
    expect(requestMessageAudio).not.toHaveBeenCalled()
  })
})
