// @vitest-environment jsdom

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
  format: 'audio/wav',
  byteLength: 3,
  durationMs: 1500,
}

function delivery(messageId = metadata.messageId): MessageAudioDelivery {
  return {
    blob: new Blob([Uint8Array.from([1, 2, 3])], { type: metadata.format }),
    metadata: { ...metadata, messageId },
  }
}

// eslint-disable-next-line max-lines-per-function
describe('useMessageAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably')
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:audio-1'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads and starts completed-message audio with response metadata', async () => {
    vi.mocked(requestMessageAudio).mockResolvedValue(delivery())
    const { result, unmount } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })

    await waitFor(() => {
      expect(result.current.audio).toMatchObject({
        messageId: 'message_1',
        status: 'playing',
        durationMs: 1500,
      })
    })
    expect(requestMessageAudio).toHaveBeenCalledWith(
      'conversation_1',
      'message_1',
      undefined,
      expect.any(AbortSignal),
    )
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)

    unmount()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')
  })

  it('keeps text fallback available when autoplay is rejected', async () => {
    vi.mocked(requestMessageAudio).mockResolvedValue(delivery())
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(
      new DOMException('Not allowed', 'NotAllowedError'),
    )
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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')
  })

  it('stops active playback and revokes owned resources', async () => {
    vi.mocked(requestMessageAudio).mockResolvedValue(delivery())
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })

    await waitFor(() => {
      expect(result.current.audio.status).toBe('playing')
    })

    act(() => {
      result.current.stopMessageAudio()
    })

    expect(result.current.audio.status).toBe('stopped')
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-1')
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

  it('aborts and cleans up when stopped or the conversation changes', () => {
    let signal: AbortSignal | undefined
    let resolveRequest: ((value: MessageAudioDelivery) => void) | undefined
    vi.mocked(requestMessageAudio).mockImplementation(
      (_conversationId, _messageId, _request, requestSignal) => {
        signal = requestSignal
        return new Promise<MessageAudioDelivery>((resolve) => {
          resolveRequest = resolve
        })
      },
    )
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
    resolveRequest?.(delivery())

    act(() => {
      rerender({ conversationId: 'conversation_2' })
    })
    expect(result.current.audio).toMatchObject({ messageId: null, status: 'idle' })
  })

  it('ignores stale delivery from an earlier message', async () => {
    const resolvers: Array<(value: MessageAudioDelivery) => void> = []
    vi.mocked(requestMessageAudio).mockImplementation(async (_conversationId, messageId) => {
      return new Promise<MessageAudioDelivery>((resolve) => {
        resolvers.push((value) => {
          resolve({ ...value, metadata: { ...value.metadata, messageId } })
        })
      })
    })
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
      result.current.playMessageAudio('message_2')
    })

    await act(async () => {
      resolvers[0]?.(delivery('message_1'))
      await Promise.resolve()
    })
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(URL.createObjectURL).not.toHaveBeenCalled()

    await act(async () => {
      resolvers[1]?.(delivery('message_2'))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.audio).toMatchObject({ messageId: 'message_2', status: 'playing' })
    })
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('reports unsupported browser playback without requesting a second text path', async () => {
    vi.mocked(requestMessageAudio).mockResolvedValue(delivery())
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(HTMLMediaElement.prototype.canPlayType).mockReturnValue('')
    const { result } = renderHook(() => useMessageAudioPlayback('conversation_1'))

    act(() => {
      result.current.playMessageAudio('message_1')
    })

    await waitFor(() => {
      expect(result.current.audio).toMatchObject({ status: 'unsupported', messageId: 'message_1' })
    })
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(requestMessageAudio).toHaveBeenCalledTimes(1)
  })
})
