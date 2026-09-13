import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { toAvailableAvatarSummary } from './avatar-summary.js'
import { toConversationSummary, toMessage, toSessionSummary } from './entity-summaries.js'

const timestamps = {
  startedAt: '2026-09-13T00:00:00.000Z',
  lastActivityAt: '2026-09-13T00:01:00.000Z',
}

describe('canonical entity projection mappers', () => {
  it('maps the session projection with explicit current optionals', () => {
    const session: Session = {
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      activeAvatarId: 'avatar_1',
      unlockedAvatarIds: ['avatar_1'],
      avatarOptions: { retrieval: { maxChunks: 3 } },
      status: 'active',
      ...timestamps,
    }

    const summary = toSessionSummary(session)

    expect(summary).toEqual({ ...session })
    expect(summary.unlockedAvatarIds).not.toBe(session.unlockedAvatarIds)
  })

  it('maps conversation and message entities without leaking internal fields', () => {
    const conversation: Conversation = {
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'closed',
      ...timestamps,
      endedAt: '2026-09-13T00:02:00.000Z',
      startedBy: 'user',
      reason: 'manual_switch',
      handoffFromConversationId: 'conversation_0',
    }
    const message: Message = {
      messageId: 'message_1',
      conversationId: conversation.conversationId,
      role: 'avatar',
      content: 'Welcome.',
      createdAt: timestamps.lastActivityAt,
      metadata: { model: 'test-model', totalTokens: 2 },
    }

    expect(toConversationSummary(conversation)).toEqual({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'closed',
      ...timestamps,
      endedAt: '2026-09-13T00:02:00.000Z',
    })
    expect(toMessage(message)).toEqual(message)
    expect(toMessage(message).metadata).not.toBe(message.metadata)
  })

  it('keeps the player Avatar projection narrower than the admin Avatar projection', () => {
    const avatar: AvatarConfig = {
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      name: 'Guide',
      status: 'active',
      personaPrompt: 'You are a guide.',
      llmOverride: { provider: 'openai', model: 'test-model' },
      config: { availabilityKey: 'guide', privateHint: 'operator-only' },
      createdAt: timestamps.startedAt,
      updatedAt: timestamps.lastActivityAt,
    }

    const summary = toAvailableAvatarSummary(avatar)

    expect(summary).toEqual({
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      name: 'Guide',
      status: 'active',
      personaPrompt: 'You are a guide.',
      createdAt: timestamps.startedAt,
      updatedAt: timestamps.lastActivityAt,
    })
    expect(summary).not.toHaveProperty('config')
    expect(summary).not.toHaveProperty('llmOverride')
  })
})
