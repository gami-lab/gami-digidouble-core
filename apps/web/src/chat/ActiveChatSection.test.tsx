// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import type { ConversationSummary } from '@gami/shared'
import { describe, expect, it, vi } from 'vitest'
import '../i18n/index'
import { ActiveChatSection } from './ActiveChatSection'
import type { ActiveChatRuntimeState } from './use-active-chat-runtime'

const conversation: ConversationSummary = {
  conversationId: 'conversation_1',
  sessionId: 'session_1',
  avatarId: 'avatar_1',
  status: 'active',
  startedAt: '2026-06-01T00:00:00.000Z',
  lastActivityAt: '2026-06-01T00:00:00.000Z',
}

function createChat(
  audioOverrides: Partial<ActiveChatRuntimeState['audio']> = {},
): ActiveChatRuntimeState {
  return {
    activeAvatarId: 'avatar_1',
    conversation,
    conversationStatus: 'ready',
    conversationError: null,
    messages: [
      {
        localId: 'message_user_1',
        role: 'user',
        content: 'Hello',
        createdAt: conversation.startedAt,
      },
      {
        localId: 'message_avatar_1',
        role: 'avatar',
        content: 'Welcome.',
        createdAt: conversation.startedAt,
      },
    ],
    avatarDraft: null,
    composerValue: '',
    sendStatus: 'idle',
    sendError: null,
    audio: {
      messageId: null,
      status: 'idle',
      durationMs: null,
      errorCode: null,
      ...audioOverrides,
    },
    canSend: true,
    canEndConversation: true,
    setComposerValue: vi.fn(),
    startChatWithAvatar: vi.fn(),
    sendCurrentMessage: vi.fn(),
    endCurrentConversation: vi.fn(),
    playMessageAudio: vi.fn(),
    stopMessageAudio: vi.fn(),
  }
}

describe('ActiveChatSection audio controls', () => {
  it('offers playback only for completed Avatar messages and uses the message ID', () => {
    const chat = createChat()

    render(<ActiveChatSection avatars={[]} chat={chat} />)

    const playButton = screen.getByRole('button', { name: 'Play Avatar response' })
    expect(screen.queryByRole('button', { name: 'Play user response' })).toBeNull()

    fireEvent.click(playButton)

    expect(chat.playMessageAudio).toHaveBeenCalledWith('message_avatar_1')
  })

  it('exposes a stop control while the active message is playing', () => {
    const chat = createChat({ messageId: 'message_avatar_1', status: 'playing' })

    render(<ActiveChatSection avatars={[]} chat={chat} />)

    fireEvent.click(screen.getByRole('button', { name: 'Stop audio' }))

    expect(chat.stopMessageAudio).toHaveBeenCalledTimes(1)
  })
})
