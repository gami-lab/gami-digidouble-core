// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import { useVoiceConversation } from './use-voice-conversation'

let micLevel = 0
const recorders: FakeMediaRecorder[] = []

class FakeMediaRecorder {
  static isTypeSupported(type: string): boolean {
    return type === 'audio/webm;codecs=opus'
  }
  state: 'inactive' | 'recording' = 'inactive'
  readonly mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? 'audio/webm'
    recorders.push(this)
  }
  start(): void {
    this.state = 'recording'
  }
  stop(): void {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob([Uint8Array.from([1, 2, 3])]) })
    this.onstop?.()
  }
}

class FakeAudioContext {
  createAnalyser() {
    return {
      fftSize: 0,
      getFloatTimeDomainData: (samples: Float32Array) => samples.fill(micLevel),
    }
  }
  createMediaStreamSource() {
    return { connect: vi.fn() }
  }
  close() {
    return Promise.resolve()
  }
}

const stopTrack = vi.fn()
const getUserMedia = vi.fn()

function fakeChat(overrides: Partial<ActiveChatRuntimeState> = {}): ActiveChatRuntimeState {
  return {
    sendStatus: 'idle',
    audio: { messageId: null, status: 'idle', errorCode: null },
    sendVoiceMessage: vi.fn(),
    ...overrides,
  } as unknown as ActiveChatRuntimeState
}

/** Advances time in 50 ms steps at a given microphone level. */
function speakFor(level: number, ms: number): void {
  micLevel = level
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

async function startListening(chat: ActiveChatRuntimeState) {
  const hook = renderHook(({ current }) => useVoiceConversation(current), {
    initialProps: { current: chat },
  })
  await act(async () => {
    hook.result.current.start()
    await Promise.resolve()
  })
  return hook
}

describe('useVoiceConversation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    micLevel = 0
    recorders.length = 0
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] })
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.stubGlobal('AudioContext', FakeAudioContext)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('auto-sends an utterance after the speaker pauses', async () => {
    const chat = fakeChat()
    const { result } = await startListening(chat)
    expect(result.current.phase).toBe('listening')
    expect(recorders[0]?.state).toBe('recording')

    speakFor(0.2, 600)
    expect(result.current.hearing).toBe(true)
    speakFor(0, 1300)

    expect(chat.sendVoiceMessage).toHaveBeenCalledTimes(1)
    const [audio, durationMs] = vi.mocked(chat.sendVoiceMessage).mock.calls[0] ?? []
    expect(audio?.type).toBe('audio/webm;codecs=opus')
    expect(durationMs).toBeGreaterThanOrEqual(1800)
  })

  it('stops recording while the reply streams and plays, then listens again', async () => {
    const chat = fakeChat()
    const hook = await startListening(chat)

    hook.rerender({ current: fakeChat({ sendStatus: 'streaming' }) })
    expect(hook.result.current.phase).toBe('waiting')
    expect(recorders[0]?.state).toBe('inactive')

    hook.rerender({
      current: fakeChat({
        audio: { messageId: 'm', status: 'playing', errorCode: null },
      }),
    })
    expect(hook.result.current.phase).toBe('speaking')
    speakFor(0.2, 600)
    expect(recorders).toHaveLength(1)

    hook.rerender({
      current: fakeChat({
        audio: { messageId: 'm', status: 'stopped', errorCode: null },
      }),
    })
    expect(hook.result.current.phase).toBe('listening')
    expect(recorders[1]?.state).toBe('recording')
  })

  it('sends immediately with submitNow, and refuses when nothing was said', async () => {
    const chat = fakeChat()
    const { result } = await startListening(chat)
    let accepted = true
    act(() => {
      accepted = result.current.submitNow()
    })
    expect(accepted).toBe(false)

    speakFor(0.2, 600)
    act(() => {
      accepted = result.current.submitNow()
    })

    expect(accepted).toBe(true)
    expect(chat.sendVoiceMessage).toHaveBeenCalledTimes(1)
  })

  it('reports a denied microphone and stays off', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))

    const { result } = await startListening(fakeChat())

    expect(result.current.error).toBe('permission-denied')
    expect(result.current.enabled).toBe(false)
  })

  it('releases the microphone when stopped', async () => {
    const { result } = await startListening(fakeChat())

    act(() => {
      result.current.stop()
    })

    expect(result.current.phase).toBe('off')
    expect(stopTrack).toHaveBeenCalled()
  })

  it('reports unsupported browsers without asking for the microphone', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const { result } = renderHook(() => useVoiceConversation(fakeChat()))

    act(() => {
      result.current.start()
    })

    expect(result.current.supported).toBe(false)
    expect(result.current.error).toBe('unsupported')
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
