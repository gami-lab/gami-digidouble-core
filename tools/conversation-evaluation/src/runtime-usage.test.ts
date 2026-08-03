import { describe, expect, it, vi } from 'vitest'

import type { AdminSessionEventsResponse } from '@gami/shared'

import type { CoreApiClient } from './core-api-client.js'
import { collectRuntimeUsage } from './runtime-usage.js'

function clientFor(events: AdminSessionEventsResponse['events']): CoreApiClient {
  return {
    listSessionEvents: vi.fn().mockResolvedValue({ events }),
  } as unknown as CoreApiClient
}

// eslint-disable-next-line max-lines-per-function
describe('runtime usage collection', () => {
  it('aggregates Game Master and memory tokens and qualifies provider models', async () => {
    const usage = await collectRuntimeUsage(
      clientFor([
        {
          type: 'gm_triggered',
          correlationId: 'gm_1',
          createdAt: '2026-07-30T00:00:00.000Z',
          payload: {
            triggerReason: 'post_turn',
            turnIndex: 1,
            interactionCount: 1,
            stateBefore: { progression: 'intro' },
            latencyMs: 10,
            provider: 'openai',
            model: 'gpt-5.4',
            inputTokens: 10,
            outputTokens: 5,
          },
        },
        {
          type: 'memory_refresh_succeeded',
          correlationId: 'memory_1',
          createdAt: '2026-07-30T00:00:00.000Z',
          payload: {
            sessionId: 'session_1',
            conversationId: 'conversation_1',
            avatarId: 'avatar_1',
            trigger: 'post_turn',
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            inputTokens: 4,
            outputTokens: 6,
          },
        },
      ] as unknown as AdminSessionEventsResponse['events']),
      'session_1',
    )

    expect(usage).toEqual({
      status: 'complete',
      gameMaster: {
        calls: 1,
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        observedModels: ['openai/gpt-5.4'],
      },
      memory: {
        calls: 1,
        inputTokens: 4,
        outputTokens: 6,
        totalTokens: 10,
        observedModels: ['anthropic/claude-sonnet-4-6'],
      },
    })
  })

  it('marks usage unavailable when a runtime call has no model identity', async () => {
    const usage = await collectRuntimeUsage(
      clientFor([
        {
          type: 'memory_refresh_succeeded',
          correlationId: 'memory_1',
          createdAt: '2026-07-30T00:00:00.000Z',
          payload: {
            sessionId: 'session_1',
            conversationId: 'conversation_1',
            avatarId: 'avatar_1',
            trigger: 'post_turn',
            inputTokens: 4,
            outputTokens: 6,
          },
        },
      ] as unknown as AdminSessionEventsResponse['events']),
      'session_1',
    )

    expect(usage.status).toBe('unavailable')
    expect(usage.memory.totalTokens).toBe(10)
  })

  it('does not invalidate cost when failed runtime work reports no token usage', async () => {
    const usage = await collectRuntimeUsage(
      clientFor([
        {
          type: 'gm_error',
          correlationId: 'gm_1',
          createdAt: '2026-07-30T00:00:00.000Z',
          payload: {
            triggerReason: 'post_turn_observation',
            turnIndex: 1,
            interactionCount: 1,
            stateBefore: { progression: 'intro' },
            latencyMs: 10,
            errorCode: 'llm_error',
          },
        },
        {
          type: 'memory_refresh_failed',
          correlationId: 'memory_1',
          createdAt: '2026-07-30T00:00:00.000Z',
          payload: {
            sessionId: 'session_1',
            conversationId: 'conversation_1',
            avatarId: 'avatar_1',
            trigger: 'post_turn',
            error: 'compaction failed',
          },
        },
      ] as unknown as AdminSessionEventsResponse['events']),
      'session_1',
    )

    expect(usage.status).toBe('complete')
    expect(usage.gameMaster.calls).toBe(0)
    expect(usage.memory.calls).toBe(0)
  })

  it('retains token usage reported by a failed Game Master call', async () => {
    const usage = await collectRuntimeUsage(
      clientFor([
        {
          type: 'gm_error',
          correlationId: 'gm_1',
          createdAt: '2026-07-30T00:00:00.000Z',
          payload: {
            triggerReason: 'post_turn_observation',
            turnIndex: 1,
            interactionCount: 1,
            stateBefore: { progression: 'intro' },
            latencyMs: 10,
            provider: 'openai',
            model: 'gpt-5.4',
            inputTokens: 10,
            outputTokens: 5,
            errorCode: 'invalid_output',
          },
        },
      ] as unknown as AdminSessionEventsResponse['events']),
      'session_1',
    )

    expect(usage.status).toBe('complete')
    expect(usage.gameMaster).toMatchObject({
      calls: 1,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      observedModels: ['openai/gpt-5.4'],
    })
  })
})
