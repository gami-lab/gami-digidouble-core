// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeEvent } from '@gami/shared'
import '../i18n'
import { reportMediaPlayback } from '../api/media-cues'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import { useRuntimeMoments } from './use-runtime-moments'

vi.mock('../api/media-cues', () => ({ reportMediaPlayback: vi.fn() }))

function chat(overrides: Partial<ActiveChatRuntimeState> = {}): ActiveChatRuntimeState {
  return {
    sendStatus: 'idle',
    activeAvatarId: 'avatar_1',
    audio: { messageId: null, status: 'idle', errorCode: null },
    ...overrides,
  } as unknown as ActiveChatRuntimeState
}

function cue(cueId: string, kind: 'image' | 'video'): RuntimeEvent {
  return {
    eventId: `event_${cueId}`,
    sessionId: 'session_1',
    type: 'runtime.media_cue',
    occurredAt: '2026-10-19T00:00:00.000Z',
    payload: {
      cueId,
      origin: 'game_master',
      display: kind === 'video' ? 'fullscreen' : 'overlay',
      asset: { assetId: `media_${cueId}`, kind, url: `/v1/media/media_${cueId}`, description: cueId },
    },
  }
}

function setup(initial: ActiveChatRuntimeState) {
  const hook = renderHook(({ current }) => useRuntimeMoments('session_1', [], current), {
    initialProps: { current: initial },
  })
  const show = () => render(<>{hook.result.current.renderMedia()}</>)
  return { hook, show }
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.mocked(reportMediaPlayback).mockReset()
})

describe('runtime media cues in the player', () => {
  it('holds a cue while the character speaks, then plays cues in arrival order', () => {
    const speaking = chat({ audio: { messageId: 'm', status: 'playing', errorCode: null } })
    const { hook } = setup(speaking)
    act(() => {
      hook.result.current.onRuntimeEvent(cue('cue-video', 'video'))
      hook.result.current.onRuntimeEvent(cue('cue-image', 'image'))
    })
    expect(hook.result.current.watching).toBeNull()

    hook.rerender({ current: chat() })
    expect(hook.result.current.watching).toBe('fullscreen')
  })

  it('reports started once and one terminal outcome per cue, then moves on', () => {
    const { hook } = setup(chat())
    act(() => {
      hook.result.current.onRuntimeEvent(cue('cue-video', 'video'))
      hook.result.current.onRuntimeEvent(cue('cue-image', 'image'))
    })
    const { unmount } = render(<>{hook.result.current.renderMedia()}</>)
    const element = screen.getByRole('dialog', { name: 'cue-video' }).querySelector('video')
    act(() => {
      if (element !== null) {
        fireEvent.playing(element)
        fireEvent.playing(element)
      }
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    })
    unmount()

    expect(vi.mocked(reportMediaPlayback).mock.calls.map((call) => call.slice(1, 3))).toEqual([
      ['cue-video', 'started'],
      ['cue-video', 'skipped'],
    ])
    expect(hook.result.current.watching).toBe('overlay')
  })

  it('dismisses a shown image when the visitor sends a message', () => {
    const { hook } = setup(chat())
    act(() => {
      hook.result.current.onRuntimeEvent(cue('cue-image', 'image'))
    })
    render(<>{hook.result.current.renderMedia()}</>)
    act(() => {
      fireEvent.load(screen.getByRole('img', { name: 'cue-image' }))
    })

    hook.rerender({ current: chat({ sendStatus: 'streaming' }) })

    expect(hook.result.current.watching).toBeNull()
    expect(vi.mocked(reportMediaPlayback).mock.calls.at(-1)?.slice(1, 3)).toEqual([
      'cue-image',
      'skipped',
    ])
  })
})
