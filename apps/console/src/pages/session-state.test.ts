import { describe, expect, it } from 'vitest'
import type { ConversationSummary, Message, SessionSummary } from '../api'
import {
  addOrUpdateConversation,
  appendConversationExchange,
  countAvatarConversations,
  createInitialSessionConsoleState,
  replaceSessionConversations,
  selectConversation,
  setConversationHistory,
  withSession,
} from './session-state'

function makeSession(sessionId: string): SessionSummary {
  return {
    sessionId,
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: null,
    status: 'active',
    startedAt: '2026-04-22T00:00:00.000Z',
    lastActivityAt: '2026-04-22T00:00:00.000Z',
    endedAt: null,
  }
}

function makeConversation(
  conversationId: string,
  avatarId: string,
  lastActivityAt: string,
): ConversationSummary {
  return {
    conversationId,
    sessionId: 'session_1',
    avatarId,
    status: 'active',
    startedAt: lastActivityAt,
    lastActivityAt,
    endedAt: null,
  }
}

function makeMessage(
  messageId: string,
  conversationId: string,
  role: Message['role'],
  content: string,
): Message {
  return {
    messageId,
    conversationId,
    role,
    content,
    createdAt: '2026-04-22T00:00:00.000Z',
  }
}

describe('session-state', () => {
  it('keeps two conversations with the same avatar as distinct entries', () => {
    const conversationA1 = makeConversation(
      'conversation_a_1',
      'avatar_a',
      '2026-04-22T00:01:00.000Z',
    )
    const conversationB1 = makeConversation(
      'conversation_b_1',
      'avatar_b',
      '2026-04-22T00:02:00.000Z',
    )
    const conversationA2 = makeConversation(
      'conversation_a_2',
      'avatar_a',
      '2026-04-22T00:03:00.000Z',
    )

    let state = withSession(createInitialSessionConsoleState(), makeSession('session_1'))
    state = addOrUpdateConversation(state, conversationA1, true)
    state = addOrUpdateConversation(state, conversationB1, true)
    state = addOrUpdateConversation(state, conversationA2, true)

    const avatarAConversations = state.conversations.filter(
      (conversation) => conversation.avatarId === 'avatar_a',
    )
    expect(avatarAConversations).toHaveLength(2)
    expect(avatarAConversations.map((conversation) => conversation.conversationId).sort()).toEqual([
      'conversation_a_1',
      'conversation_a_2',
    ])
    expect(countAvatarConversations(state.conversations, 'avatar_a')).toBe(2)
  })

  it('keeps message history scoped to the selected conversation', () => {
    const conversationA1 = makeConversation(
      'conversation_a_1',
      'avatar_a',
      '2026-04-22T00:01:00.000Z',
    )
    const conversationA2 = makeConversation(
      'conversation_a_2',
      'avatar_a',
      '2026-04-22T00:02:00.000Z',
    )

    let state = withSession(createInitialSessionConsoleState(), makeSession('session_1'))
    state = replaceSessionConversations(state, [conversationA1, conversationA2])
    state = setConversationHistory(state, conversationA1.conversationId, [
      makeMessage('msg_1', conversationA1.conversationId, 'user', 'hello A1'),
    ])
    state = setConversationHistory(state, conversationA2.conversationId, [
      makeMessage('msg_2', conversationA2.conversationId, 'user', 'hello A2'),
    ])

    state = selectConversation(state, conversationA1.conversationId)
    const selectedA1 = state.messagesByConversationId[state.selectedConversationId ?? ''] ?? []
    expect(selectedA1.map((message) => message.content)).toEqual(['hello A1'])

    state = selectConversation(state, conversationA2.conversationId)
    const selectedA2 = state.messagesByConversationId[state.selectedConversationId ?? ''] ?? []
    expect(selectedA2.map((message) => message.content)).toEqual(['hello A2'])
  })

  it('supports session-to-conversation progression and message append flow', () => {
    const conversationA1 = makeConversation(
      'conversation_a_1',
      'avatar_a',
      '2026-04-22T00:01:00.000Z',
    )
    const updatedConversationA1 = {
      ...conversationA1,
      lastActivityAt: '2026-04-22T00:05:00.000Z',
    }

    let state = withSession(createInitialSessionConsoleState(), makeSession('session_1'))
    state = addOrUpdateConversation(state, conversationA1, true)

    const userMessage = makeMessage(
      'msg_user_1',
      conversationA1.conversationId,
      'user',
      'Hi avatar A',
    )
    const avatarMessage = makeMessage(
      'msg_avatar_1',
      conversationA1.conversationId,
      'avatar',
      'Hi tester',
    )
    const updatedSession = {
      ...makeSession('session_1'),
      activeAvatarId: 'avatar_a',
      lastActivityAt: '2026-04-22T00:05:00.000Z',
    }

    state = appendConversationExchange(
      state,
      updatedConversationA1,
      userMessage,
      avatarMessage,
      updatedSession,
    )

    expect(state.selectedConversationId).toBe(conversationA1.conversationId)
    expect(state.session?.activeAvatarId).toBe('avatar_a')
    expect(
      (state.messagesByConversationId[conversationA1.conversationId] ?? []).map(
        (message) => message.messageId,
      ),
    ).toEqual(['msg_user_1', 'msg_avatar_1'])
  })
})
