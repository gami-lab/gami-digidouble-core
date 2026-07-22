import { describe, expect, it } from 'vitest'
import {
  isMessageStreamEvent,
  parseMessageStreamEvent,
  type MessageStreamEvent,
} from './conversation-stream-contract-types.js'

// eslint-disable-next-line max-lines-per-function
describe('MessageStreamEvent contract decoder', () => {
  it('accepts valid started, delta, interruption, and error events', () => {
    const events: MessageStreamEvent[] = [
      {
        type: 'conversation.message.started',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        userMessage: {
          messageId: 'message_1',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'Hello',
          createdAt: '2026-06-01T12:00:00.000Z',
        },
      },
      {
        type: 'conversation.message.delta',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        sequence: 0,
        delta: 'Hi',
      },
      {
        type: 'conversation.message.interrupted',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        reason: 'client_aborted',
      },
      {
        type: 'conversation.message.error',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        message: 'Stream failed',
      },
    ]

    for (const event of events) {
      expect(parseMessageStreamEvent(event)).toEqual(event)
      expect(isMessageStreamEvent(event)).toBe(true)
    }
  })

  it('accepts the canonical completed response shape', () => {
    const event: MessageStreamEvent = {
      type: 'conversation.message.completed',
      requestId: 'request_1',
      conversationId: 'conversation_1',
      response: {
        conversation: {
          conversationId: 'conversation_1',
          sessionId: 'session_1',
          avatarId: 'avatar_1',
          status: 'active',
          startedAt: '2026-06-01T12:00:00.000Z',
          lastActivityAt: '2026-06-01T12:00:01.000Z',
        },
        session: {
          sessionId: 'session_1',
          userId: 'user_1',
          scenarioId: 'scenario_1',
          status: 'active',
          startedAt: '2026-06-01T12:00:00.000Z',
          lastActivityAt: '2026-06-01T12:00:01.000Z',
        },
        userMessage: {
          messageId: 'message_1',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'Hello',
          createdAt: '2026-06-01T12:00:00.000Z',
        },
        avatarMessage: {
          messageId: 'message_2',
          conversationId: 'conversation_1',
          role: 'avatar',
          content: 'Hi there',
          createdAt: '2026-06-01T12:00:01.000Z',
          metadata: {
            model: 'test-model',
            latencyMs: 10,
            inputTokens: 4,
            outputTokens: 3,
          },
        },
        debug: {
          requestId: 'request_1',
          model: 'test-model',
          latencyMs: 10,
          inputTokens: 4,
          outputTokens: 3,
        },
      },
    }

    expect(parseMessageStreamEvent(event)).toEqual(event)
  })

  it('rejects malformed events before they reach consumers', () => {
    expect(
      parseMessageStreamEvent({
        type: 'conversation.message.delta',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        sequence: -1,
        delta: 'invalid',
      }),
    ).toBeNull()
    expect(
      parseMessageStreamEvent({
        type: 'conversation.message.unknown',
        requestId: 'request_1',
        conversationId: 'conversation_1',
      }),
    ).toBeNull()
    expect(
      parseMessageStreamEvent({
        type: 'conversation.message.completed',
        requestId: 'request_1',
        conversationId: 'conversation_1',
        response: {},
      }),
    ).toBeNull()
  })
})
