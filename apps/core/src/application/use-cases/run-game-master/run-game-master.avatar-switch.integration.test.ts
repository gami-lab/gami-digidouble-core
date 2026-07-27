import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'
import { SwitchAvatarUseCase } from '../switch-avatar/switch-avatar.use-case.js'
import { NullObservabilityAdapter } from '../../../infrastructure/observability/null.adapter.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryGmStateRepository } from '../../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'

const avatars: AvatarConfig[] = [
  {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava.',
    config: {},
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z',
  },
  {
    avatarId: 'avatar_2',
    scenarioId: 'scenario_1',
    name: 'Theo',
    status: 'active',
    personaPrompt: 'You are Theo.',
    config: {},
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z',
  },
]

describe('GM switch and platform handoff', () => {
  it('records the next Avatar and lets the platform switch use case create the new episode', async () => {
    const sessionRepository = new InMemorySessionRepository([
      {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        activeAvatarId: 'avatar_1',
        unlockedAvatarIds: ['avatar_1', 'avatar_2'],
        status: 'active',
        startedAt: '2026-07-20T09:00:00.000Z',
        lastActivityAt: '2026-07-20T09:00:00.000Z',
      },
    ])
    const conversationRepository = new InMemoryConversationRepository([
      {
        conversationId: 'conversation_old',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        status: 'active',
        startedAt: '2026-07-20T09:00:00.000Z',
        lastActivityAt: '2026-07-20T09:00:00.000Z',
      },
    ])
    const gmStateRepository = new InMemoryGmStateRepository()
    const llm = {
      complete: () =>
        Promise.resolve({
          content: JSON.stringify({
            dialogueControl: { mode: 'transition', askFollowUp: false },
            retrievalPlan: { required: false },
            directorNotes: 'Prepare the specialist handoff.',
            routing: { action: 'switch', avatarId: 'avatar_2', reason: 'specialist_handoff' },
            progressionUpdate: { progression: 'none' },
          }),
          model: 'test-model',
          inputTokens: 1,
          outputTokens: 1,
          latencyMs: 1,
        }),
    }
    const runGameMaster = new RunGameMasterUseCase(
      gmStateRepository,
      sessionRepository,
      new InMemoryAvatarRepository(avatars),
      llm,
      new NullObservabilityAdapter(),
    )

    await runGameMaster.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_old',
      userMessageText: 'Bring in the specialist.',
      turnIndex: 2,
      correlationId: 'corr_switch',
    })

    const stateAfterGm = await gmStateRepository.findBySessionId('session_1')
    expect(stateAfterGm?.nextTurnOrchestration?.activeAvatarId).toBe('avatar_2')

    const switchAvatar = new SwitchAvatarUseCase(
      sessionRepository,
      new InMemoryAvatarRepository(avatars),
      conversationRepository,
    )
    const handoff = await switchAvatar.execute({
      sessionId: 'session_1',
      avatarId: 'avatar_2',
      reason: 'gm_switch',
    })

    const previousConversation = await conversationRepository.findById('conversation_old')
    const activeConversation = await conversationRepository.findById(
      handoff.conversation.conversationId,
    )
    expect(handoff.previousConversationId).toBe('conversation_old')
    expect(previousConversation?.status).toBe('closed')
    expect(activeConversation).toMatchObject({
      avatarId: 'avatar_2',
      status: 'active',
      handoffFromConversationId: 'conversation_old',
    })
    await expect(sessionRepository.findById('session_1')).resolves.toMatchObject({
      activeAvatarId: 'avatar_2',
    })
  })
})
