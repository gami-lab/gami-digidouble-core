import { describe, expect, it } from 'vitest'
import type { ChatThreadMessage } from './use-active-chat-runtime'
import {
  createOptimisticSendState,
  createPendingUserMessage,
  createThreadStateForAvatarSelection,
  createThreadStateForConversationEnd,
  markSendFailure,
  reconcileSendSuccess,
} from './use-active-chat-runtime'

describe('active chat runtime state helpers', () => {
  it('resets thread state when a new avatar is selected (current-chat-only behavior)', () => {
    expect(createThreadStateForAvatarSelection('avatar_9')).toEqual({
      activeAvatarId: 'avatar_9',
      conversation: null,
      conversationStatus: 'starting',
      conversationError: null,
      messages: [],
      composerValue: '',
      sendStatus: 'idle',
      sendError: null,
    })
  })

  it('clears active avatar and thread state after ending a conversation', () => {
    expect(createThreadStateForConversationEnd()).toEqual({
      activeAvatarId: null,
      conversation: null,
      conversationStatus: 'idle',
      conversationError: null,
      messages: [],
      composerValue: '',
      sendStatus: 'idle',
      sendError: null,
    })
  })

  it('builds optimistic send state with processing status and immediate user message', () => {
    const pendingMessage = createPendingUserMessage(
      'Hello there',
      'pending-1',
      '2026-06-01T12:00:00.000Z',
    )

    const state = createOptimisticSendState([], pendingMessage)

    expect(state).toEqual({
      composerValue: '',
      sendStatus: 'sending',
      sendError: null,
      messages: [
        {
          localId: 'pending-1',
          role: 'user',
          content: 'Hello there',
          createdAt: '2026-06-01T12:00:00.000Z',
          pending: true,
        },
      ],
    })
  })

  it('reconciles optimistic message with confirmed user + avatar response in the same thread', () => {
    const currentMessages: ChatThreadMessage[] = [
      createPendingUserMessage('Question', 'pending-2', '2026-06-01T12:05:00.000Z'),
    ]

    const next = reconcileSendSuccess(
      currentMessages,
      'pending-2',
      {
        localId: 'msg_user_1',
        role: 'user',
        content: 'Question',
        createdAt: '2026-06-01T12:05:01.000Z',
      },
      {
        localId: 'msg_avatar_1',
        role: 'avatar',
        content: 'Answer',
        createdAt: '2026-06-01T12:05:03.000Z',
      },
    )

    expect(next).toEqual([
      {
        localId: 'msg_user_1',
        role: 'user',
        content: 'Question',
        createdAt: '2026-06-01T12:05:01.000Z',
      },
      {
        localId: 'msg_avatar_1',
        role: 'avatar',
        content: 'Answer',
        createdAt: '2026-06-01T12:05:03.000Z',
      },
    ])
  })

  it('marks the optimistic message as failed when send errors', () => {
    const currentMessages: ChatThreadMessage[] = [
      createPendingUserMessage('Question', 'pending-3', '2026-06-01T12:08:00.000Z'),
    ]

    expect(markSendFailure(currentMessages, 'pending-3')).toEqual([
      {
        localId: 'pending-3',
        role: 'user',
        content: 'Question',
        createdAt: '2026-06-01T12:08:00.000Z',
        failed: true,
      },
    ])
  })
})
