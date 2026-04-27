import { describe, expect, it } from 'vitest'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
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
import { buildAiGuidedDiscoveryFixture } from '../../seed/ai-guided-discovery.js'

function createHarness() {
  const { scenario, avatars } = buildAiGuidedDiscoveryFixture()
  const sessionRepository = new InMemorySessionRepository()
  const scenarioRepository = new InMemoryScenarioRepository([scenario])
  const avatarRepository = new InMemoryAvatarRepository(avatars)
  const conversationRepository = new InMemoryConversationRepository()
  const messageRepository = new InMemoryMessageRepository()
  const llm = {
    complete: () =>
      Promise.resolve({
        content: 'Base LLM reply',
        model: 'null-model',
        inputTokens: 10,
        outputTokens: 20,
        latencyMs: 5,
      }),
  }
  const observability = new NullObservabilityAdapter()

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
      llm,
      observability,
      null,
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
    const harness = createHarness()
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
      userMessage: 'How do transformers handle inference latency?',
    })

    const available = await harness.availableAvatars.execute({
      sessionId: started.session.sessionId,
    })

    expect(available.avatars.map((avatar) => avatar.name)).toEqual(['Mira', 'Theo'])
  })

  it('unlocks Eva after an ethics question to the guide', async () => {
    const harness = createHarness()
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
      userMessage: 'Could AI bias be dangerous for society?',
    })

    const available = await harness.availableAvatars.execute({
      sessionId: started.session.sessionId,
    })

    expect(available.avatars.map((avatar) => avatar.name)).toEqual(['Mira', 'Eva'])
  })
})

describe('AI Guided Discovery — bounded competence redirects', () => {
  it('Theo redirects ethics questions back to Eva or the guide', async () => {
    const harness = createHarness()
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
      userMessage: 'Explain transformers and training.',
    })
    const theoConversation = await harness.switchAvatar.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_theo',
    })

    const reply = await harness.sendMessage.execute({
      conversationId: theoConversation.conversation.conversationId,
      userMessage: 'What about fairness and bias?',
    })

    expect(reply.avatarMessage.content).toContain('Eva')
  })

  it('Eva redirects deep infrastructure questions back to Theo or the guide', async () => {
    const harness = createHarness()
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
      userMessage: 'What are the privacy and regulation issues?',
    })
    const evaConversation = await harness.switchAvatar.execute({
      sessionId: started.session.sessionId,
      avatarId: 'avatar_eva',
    })

    const reply = await harness.sendMessage.execute({
      conversationId: evaConversation.conversation.conversationId,
      userMessage: 'How would you scale RAG and embeddings infrastructure?',
    })

    expect(reply.avatarMessage.content).toContain('Theo')
  })
})

describe('AI Guided Discovery — multi-avatar session navigation', () => {
  it('creates multiple conversations when switching A to B to A within one session', async () => {
    const harness = createHarness()
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
      userMessage: 'Explain LLM providers and latency trade-offs.',
    })
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
