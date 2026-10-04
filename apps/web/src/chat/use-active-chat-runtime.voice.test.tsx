// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import type { MessageStreamEvent, SessionSummary } from '@gami/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  requestMessageAudio,
  sendVoiceMessageStream,
  startConversation,
} from '../api/conversations'
import i18n from '../i18n/index'
import { useActiveChatRuntime } from './use-active-chat-runtime'

vi.mock('../api/conversations', () => ({
  startConversation: vi.fn(),
  sendMessageStream: vi.fn(),
  sendVoiceMessageStream: vi.fn(),
  requestMessageAudio: vi.fn(),
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

const userMessage = {
  messageId: 'msg_user_1',
  conversationId: 'conversation_1',
  role: 'user' as const,
  content: 'Bonjour Max',
  createdAt: '2026-06-01T12:00:02.000Z',
}

describe('useActiveChatRuntime voice turns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(startConversation).mockResolvedValue({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'active',
      startedAt: '2026-06-01T00:00:00.000Z',
      lastActivityAt: '2026-06-01T00:00:00.000Z',
    })
    vi.mocked(requestMessageAudio).mockReturnValue(new Promise(() => {}))
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:audio'),
    })
  })

  it('shows a transcribing bubble, replaces it with the transcript, then autoplays the reply', async () => {
    let onEvent: ((event: MessageStreamEvent) => void) | undefined
    vi.mocked(sendVoiceMessageStream).mockImplementation(async (_id, _upload, handlers) => {
      onEvent = handlers.onEvent
      await Promise.resolve()
    })
    const { result } = renderHook(() => useActiveChatRuntime(session))
    act(() => {
      result.current.startChatWithAvatar('avatar_1')
    })
    await waitFor(() => {
      expect(result.current.conversationStatus).toBe('ready')
    })
    const audio = new Blob([Uint8Array.from([1, 2])], { type: 'audio/webm' })

    act(() => {
      result.current.sendVoiceMessage(audio, 1500)
    })

    expect(result.current.sendStatus).toBe('streaming')
    expect(result.current.messages[0]).toMatchObject({
      pending: true,
      content: i18n.t('chat.voice.transcribing'),
    })
    expect(sendVoiceMessageStream).toHaveBeenCalledWith(
      'conversation_1',
      { audio, utteranceId: expect.any(String) as string, durationMs: 1500 },
      expect.anything(),
      expect.any(AbortSignal),
    )

    act(() => {
      onEvent?.({
        type: 'conversation.message.started',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        userMessage,
      })
    })
    expect(result.current.messages.map((message) => message.content)).toEqual(['Bonjour Max'])

    act(() => {
      onEvent?.({
        type: 'conversation.message.completed',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        response: {
          conversation: {
            conversationId: 'conversation_1',
            sessionId: 'session_1',
            avatarId: 'avatar_1',
            status: 'active',
            startedAt: '2026-06-01T00:00:00.000Z',
            lastActivityAt: '2026-06-01T12:00:03.000Z',
          },
          userMessage,
          avatarMessage: {
            messageId: 'msg_avatar_1',
            conversationId: 'conversation_1',
            role: 'avatar',
            content: 'Bonjour.',
            createdAt: '2026-06-01T12:00:03.000Z',
          },
        },
      } as MessageStreamEvent)
    })

    expect(result.current.sendStatus).toBe('idle')
    await waitFor(() => {
      expect(requestMessageAudio).toHaveBeenCalledWith(
        'conversation_1',
        'msg_avatar_1',
        undefined,
        expect.any(AbortSignal),
      )
    })
  })
})
