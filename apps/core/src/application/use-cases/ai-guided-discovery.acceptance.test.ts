import { describe, expect, it } from 'vitest'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/null.adapter.js'
import { StartConversationUseCase } from './start-conversation/start-conversation.use-case.js'
import { StartSessionUseCase } from './start-session/start-session.use-case.js'
import { GetAvailableAvatarsUseCase } from './get-available-avatars/get-available-avatars.use-case.js'
import { SendMessageUseCase } from './send-message/send-message.use-case.js'
import { SwitchAvatarUseCase } from './switch-avatar/switch-avatar.use-case.js'
import { ListSessionConversationsUseCase } from './list-session-conversations/list-session-conversations.use-case.js'
import { RunGameMasterUseCase } from './run-game-master/run-game-master.use-case.js'
import { buildAiGuidedDiscoveryFixture } from '../../seed/ai-guided-discovery.js'

type UnlockTarget = 'theo' | 'eva' | null

function createHarness(unlockTarget: UnlockTarget = null) {
  const { scenario, avatars } = buildAiGuidedDiscoveryFixture()
  const sessionRepository = new InMemorySessionRepository()
  const scenarioRepository = new InMemoryScenarioRepository([scenario])
  const avatarRepository = new InMemoryAvatarRepository(avatars)
  const conversationRepository = new InMemoryConversationRepository()
  const messageRepository = new InMemoryMessageRepository()
  const avatarLlm = {
    complete: () =>
      Promise.resolve({
        content: 'Base LLM reply',
        model: 'null-model',
        inputTokens: 10,
        outputTokens: 20,
        latencyMs: 5,
      }),
  }
  const gmLlm = {
    complete: () =>
      Promise.resolve({
        content: JSON.stringify(buildGmOutput(unlockTarget)),
        model: 'null-model',
        inputTokens: 10,
        outputTokens: 20,
        latencyMs: 5,
      }),
  }
  const observability = new NullObservabilityAdapter()
  const eventLogRepository = new InMemoryEventLogRepository()
  const runGameMaster = new RunGameMasterUseCase(
    new InMemoryGmStateRepository(),
    sessionRepository,
    avatarRepository,
    gmLlm,
    observability,
    scenarioRepository,
    undefined,
    conversationRepository,
    messageRepository,
  )

  return {
    scenario,
    avatars,
    sessionRepository,
    scenarioRepository,
    avatarRepository,
    conversationRepository,
    messageRepository,
    startSession: new StartSessionUseCase(sessionRepository, scenarioRepository, avatarRepository),
    availableAvatars: new GetAvailableAvatarsUseCase(sessionRepository, avatarRepository),
    startConversation: new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    ),
    sendMessage: new SendMessageUseCase(
      sessionRepository,
      conversationRepository,
      avatarRepository,
      scenarioRepository,
      messageRepository,
      avatarLlm,
      eventLogRepository,
      runGameMaster,
    ),
    switchAvatar: new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    ),
    listConversations: new ListSessionConversationsUseCase(
      sessionRepository,
      conversationRepository,
    ),
  }
}

function buildGmOutput(unlockTarget: UnlockTarget): Record<string, unknown> {
  return {
    dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
    retrievalPlan: { required: false },
    directorNotes: 'Keep the next answer focused on the current subject.',
    ...(unlockTarget === 'theo'
      ? {
          routing: {
            action: 'unlock',
            avatarId: 'avatar_theo',
            reason: 'Technical specialist is relevant now.',
          },
        }
      : {}),
    ...(unlockTarget === 'eva'
      ? {
          routing: {
            action: 'unlock',
            avatarId: 'avatar_eva',
            reason: 'Responsible AI specialist is relevant now.',
          },
        }
      : {}),
    progressionUpdate: {
      progression: unlockTarget === null ? 'none' : 'increase',
    },
  }
}

async function flushBackgroundTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('AI Guided Discovery — initial visibility', () => {
  it('shows only the generalist guide in a new session', async () => {
    const harness = createHarness()

    const started = await harness.startSession.execute({
      userId: 'user_1',
      scenarioId: harness.scenario.scenarioId,
    })
    const available = await harness.availableAvatars.execute({
      sessionId: started.session.sessionId,
    })

    expect(available.avatars.map((avatar) => avatar.name)).toEqual(['Mira'])
  })

  it('rejects opening a locked specialist before unlock', async () => {
    const harness = createHarness()
    const started = await harness.startSession.execute({
      userId: 'user_1',
      scenarioId: harness.scenario.scenarioId,
    })

    await expect(
      harness.startConversation.execute({
        sessionId: started.session.sessionId,
        avatarId: 'avatar_theo',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('AI Guided Discovery — unlock progression', () => {
  it('unlocks Theo after a technical question to the guide', async () => {
    const harness = createHarness('theo')
    const started = await harness.startSession.execute({
      userId: 'user_1',
      scenarioId: harness.scenario.scenarioId,
    })
    const conversation = await harness.startConversation.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_mira',
    })

    await harness.sendMessage.execute({
      conversationId: conversation.conversation.conversationId,
      userMessage: 'Can Theo explain how transformers handle inference latency?',
    })
    await flushBackgroundTasks()

    const available = await harness.availableAvatars.execute({
      sessionId: started.session.sessionId,
    })

    expect(available.avatars.map((avatar) => avatar.name)).toEqual(['Mira', 'Theo'])
  })

  it('unlocks Eva after an ethics question to the guide', async () => {
    const harness = createHarness('eva')
    const started = await harness.startSession.execute({
      userId: 'user_1',
      scenarioId: harness.scenario.scenarioId,
    })
    const conversation = await harness.startConversation.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_mira',
    })

    await harness.sendMessage.execute({
      conversationId: conversation.conversation.conversationId,
      userMessage: 'Could Eva explain whether AI bias is dangerous for society?',
    })
    await flushBackgroundTasks()

    const available = await harness.availableAvatars.execute({
      sessionId: started.session.sessionId,
    })

    expect(available.avatars.map((avatar) => avatar.name)).toEqual(['Mira', 'Eva'])
  })

  it('unlocks Eva after an environmental impact question to the guide', async () => {
    const harness = createHarness('eva')
    const started = await harness.startSession.execute({
      userId: 'user_1',
      scenarioId: harness.scenario.scenarioId,
    })
    const conversation = await harness.startConversation.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_mira',
    })

    await harness.sendMessage.execute({
      conversationId: conversation.conversation.conversationId,
      userMessage:
        'Could Eva explain whether AI needs power, and what that means for the environment?',
    })
    await flushBackgroundTasks()

    const available = await harness.availableAvatars.execute({
      sessionId: started.session.sessionId,
    })

    expect(available.avatars.map((avatar) => avatar.name)).toEqual(['Mira', 'Eva'])
  })
})

describe('AI Guided Discovery — unlocked switching', () => {
  it('allows switching to Theo after the GM unlocks Theo', async () => {
    const harness = createHarness('theo')
    const started = await harness.startSession.execute({
      userId: 'user_1',
      scenarioId: harness.scenario.scenarioId,
    })
    const guideConversation = await harness.startConversation.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_mira',
    })
    await harness.sendMessage.execute({
      conversationId: guideConversation.conversation.conversationId,
      userMessage: 'Theo should explain transformers and training.',
    })
    await flushBackgroundTasks()

    const theoConversation = await harness.switchAvatar.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_theo',
    })

    expect(theoConversation.conversation.avatarId).toBe('avatar_theo')
  })

  it('allows switching to Eva after the GM unlocks Eva', async () => {
    const harness = createHarness('eva')
    const started = await harness.startSession.execute({
      userId: 'user_1',
      scenarioId: harness.scenario.scenarioId,
    })
    const guideConversation = await harness.startConversation.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_mira',
    })
    await harness.sendMessage.execute({
      conversationId: guideConversation.conversation.conversationId,
      userMessage: 'Could Eva explain the privacy and regulation issues?',
    })
    await flushBackgroundTasks()

    const evaConversation = await harness.switchAvatar.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_eva',
    })

    expect(evaConversation.conversation.avatarId).toBe('avatar_eva')
  })
})

describe('AI Guided Discovery — multi-avatar session navigation', () => {
  it('creates multiple conversations when switching A to B to A within one session', async () => {
    const harness = createHarness('theo')
    const started = await harness.startSession.execute({
      userId: 'user_1',
      scenarioId: harness.scenario.scenarioId,
    })
    const guideConversation = await harness.startConversation.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_mira',
    })
    await harness.sendMessage.execute({
      conversationId: guideConversation.conversation.conversationId,
      userMessage: 'I want Theo to explain LLM providers and latency trade-offs.',
    })
    await flushBackgroundTasks()
    await harness.switchAvatar.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_theo',
    })
    await harness.switchAvatar.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_mira',
    })

    const conversations = await harness.listConversations.execute({
      sessionId: started.session.sessionId,
    })

    expect(conversations.conversations).toHaveLength(3)
    expect(conversations.conversations.map((conversation) => conversation.avatarId)).toEqual([
      'avatar_mira',
      'avatar_theo',
      'avatar_mira',
    ])
  })
})
