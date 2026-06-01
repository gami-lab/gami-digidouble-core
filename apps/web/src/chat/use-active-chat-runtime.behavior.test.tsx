// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import type { SessionSummary } from '@gami/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  endConversation,
  getConversationHistory,
  sendMessage,
  startConversation,
} from '../api/conversations'
import { useActiveChatRuntime } from './use-active-chat-runtime'

vi.mock('../api/conversations', () => ({
  startConversation: vi.fn(),
  sendMessage: vi.fn(),
  getConversationHistory: vi.fn(),
  endConversation: vi.fn(),
}))

const session: SessionSummary = {
  sessionId: 'session_1',
  userId: 'user_1',
  scenarioId: 'scenario_1',
  status: 'active',
  startedAt: '2026-06-01T00:00:00.000Z',
  lastActivityAt: '2026-06-01T00:00:00.000Z',
}

// eslint-disable-next-line max-lines-per-function
describe('useActiveChatRuntime behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getConversationHistory).mockResolvedValue({
      conversation: {
        conversationId: 'conversation_restore',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        status: 'active',
        startedAt: '2026-06-01T00:00:00.000Z',
        lastActivityAt: '2026-06-01T00:00:00.000Z',
      },
      messages: [],
    })
  })

  it('shows optimistic pending state and reconciles with API messages on success', async () => {
    vi.mocked(startConversation).mockResolvedValue({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'active',
      startedAt: '2026-06-01T00:00:00.000Z',
      lastActivityAt: '2026-06-01T00:00:00.000Z',
    })
    let resolveSend: ((value: Awaited<ReturnType<typeof sendMessage>>) => void) | undefined
    vi.mocked(sendMessage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve
        }),
    )

    const { result } = renderHook(() => useActiveChatRuntime(session))

    act(() => {
      result.current.startChatWithAvatar('avatar_1')
    })

    await waitFor(() => {
      expect(result.current.conversationStatus).toBe('ready')
      expect(result.current.conversation?.conversationId).toBe('conversation_1')
    })

    act(() => {
      result.current.setComposerValue('Hello')
    })

    act(() => {
      result.current.sendCurrentMessage()
    })

    expect(result.current.sendStatus).toBe('sending')
    expect(result.current.messages.length).toBe(1)
    expect(result.current.messages[0]?.pending).toBe(true)

    act(() => {
      resolveSend?.({
        conversation: {
          conversationId: 'conversation_1',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          status: 'active',
          startedAt: '2026-06-01T00:00:00.000Z',
          lastActivityAt: '2026-06-01T00:00:00.000Z',
        },
        session,
        userMessage: {
          messageId: 'msg_user_1',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'Hello',
          createdAt: '2026-06-01T00:00:02.000Z',
        },
        avatarMessage: {
          messageId: 'msg_avatar_1',
          conversationId: 'conversation_1',
          role: 'avatar',
          content: 'Hi there',
          createdAt: '2026-06-01T00:00:03.000Z',
          metadata: {
            model: 'test-model',
            latencyMs: 100,
            inputTokens: 10,
            outputTokens: 12,
          },
        },
        debug: {
          requestId: 'request_1',
          model: 'test-model',
          latencyMs: 100,
          inputTokens: 10,
          outputTokens: 12,
        },
      })
    })

    await waitFor(() => {
      expect(result.current.sendStatus).toBe('idle')
      expect(result.current.messages.map((message) => message.localId)).toEqual([
        'msg_user_1',
        'msg_avatar_1',
      ])
    })
  })

  it('marks the pending message as failed when send fails', async () => {
    vi.mocked(startConversation).mockResolvedValue({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'active',
      startedAt: '2026-06-01T00:00:00.000Z',
      lastActivityAt: '2026-06-01T00:00:00.000Z',
    })
    vi.mocked(sendMessage).mockRejectedValue(new Error('send failed'))

    const { result } = renderHook(() => useActiveChatRuntime(session))

    act(() => {
      result.current.startChatWithAvatar('avatar_1')
    })

    await waitFor(() => {
      expect(result.current.conversationStatus).toBe('ready')
    })

    act(() => {
      result.current.setComposerValue('Hello')
    })

    act(() => {
      result.current.sendCurrentMessage()
    })

    await waitFor(() => {
      expect(result.current.sendStatus).toBe('idle')
      expect(result.current.sendError).not.toBeNull()
      expect(result.current.sendError ?? '').toContain('send failed')
      expect(result.current.messages.length).toBe(1)
      expect(result.current.messages[0]?.failed).toBe(true)
    })
  })

  it('ends the active conversation and resets to idle thread state', async () => {
    vi.mocked(startConversation).mockResolvedValue({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'active',
      startedAt: '2026-06-01T00:00:00.000Z',
      lastActivityAt: '2026-06-01T00:00:00.000Z',
    })
    vi.mocked(endConversation).mockResolvedValue({
      conversation: {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        status: 'closed',
        startedAt: '2026-06-01T00:00:00.000Z',
        lastActivityAt: '2026-06-01T00:00:02.000Z',
        endedAt: '2026-06-01T00:00:03.000Z',
      },
      compaction: {
        scheduled: true,
      },
    })

    const { result } = renderHook(() => useActiveChatRuntime(session))

    act(() => {
      result.current.startChatWithAvatar('avatar_1')
    })

    await waitFor(() => {
      expect(result.current.conversationStatus).toBe('ready')
      expect(result.current.conversation).not.toBeNull()
    })

    act(() => {
      result.current.endCurrentConversation()
    })

    await waitFor(() => {
      expect(result.current.conversation).toBeNull()
      expect(result.current.activeAvatarId).toBeNull()
      expect(result.current.conversationStatus).toBe('idle')
    })
  })
})