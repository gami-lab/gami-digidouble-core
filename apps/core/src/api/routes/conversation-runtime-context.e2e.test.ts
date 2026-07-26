import { describe, expect, it } from 'vitest'
import type { ApiResponse, AvatarComputedTraits } from '@gami/shared'
import type { ILlmAdapter, LlmRequest } from '../../application/ports/ILlmAdapter.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Conversation, Session } from '../../domain/conversation/session.types.js'
import type { KnowledgeChunk, KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'
import type { ConversationWorkingMemory, UserFact } from '../../domain/memory/memory.types.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import type { User } from '../../domain/user/user.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { InMemoryUserRepository } from '../../infrastructure/db/in-memory-user.repository.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/index.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const SAMPLE_TRAITS: AvatarComputedTraits = {
  identity: ['Harbor archivist'],
  personality: ['Measured under pressure'],
  speakingStyle: ['Short and literal'],
  background: ['Former navigator'],
  timeline: ['Joined after the storm'],
  currentSituation: ['Guiding late arrivals'],
  behaviouralRules: ['Never fabricate ship logs'],
}

class CapturingLlmAdapter implements ILlmAdapter {
  public readonly calls: LlmRequest[] = []

  complete(request: LlmRequest) {
    this.calls.push(request)
    return Promise.resolve({
      content: 'Avatar reply',
      model: 'null-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
  }
}

function makeScenario(): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Harbor Watch',
    status: 'active',
    objectives: ['Guide arrivals safely'],
    worldContext: 'The harbor closes at moonrise.',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava, a helpful guide.',
    adjustments: ['Use short paragraphs.'],
    config: {},
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
    ...overrides,
  }
}

function makeSession(): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    gmNotes: 'Keep the answer practical.',
    status: 'active',
    startedAt: '2026-07-20T10:00:00.000Z',
    lastActivityAt: '2026-07-20T10:00:00.000Z',
  }
}

function makeConversation(): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-07-20T10:00:00.000Z',
    lastActivityAt: '2026-07-20T10:00:00.000Z',
  }
}

function makeUser(): User {
  return {
    userId: 'user_1',
    persona: {
      name: 'Maya',
      roleInWorld: 'captain',
      dialogGuidance: 'Keep it practical.',
    },
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
  }
}

function makeMessages() {
  return [
    {
      messageId: 'msg_1',
      conversationId: 'conversation_1',
      role: 'user' as const,
      content: 'We already checked the north pier.',
      createdAt: '2026-07-20T10:00:30.000Z',
    },
    {
      messageId: 'msg_2',
      conversationId: 'conversation_1',
      role: 'avatar' as const,
      content: 'The ledger still matters at moonrise.',
      createdAt: '2026-07-20T10:00:31.000Z',
    },
  ]
}

function makeWorkingMemory(): ConversationWorkingMemory {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    summary: 'Track the north pier ledger and unresolved moonrise timing.',
    unresolvedThreads: ['north_pier_ledger'],
    coveredTopics: ['north_pier_search'],
    candidateFacts: [],
    updatedAt: '2026-07-20T10:00:00.000Z',
  }
}

function makeUserFacts(): UserFact[] {
  return [
    {
      id: 'fact_1',
      userId: 'user_1',
      category: 'preference',
      key: 'preferred_route',
      value: 'north pier',
      createdAt: '2026-07-20T09:00:00.000Z',
      updatedAt: '2026-07-20T09:00:00.000Z',
    },
  ]
}

function makeKnowledgeSources(): KnowledgeSource[] {
  return [
    {
      sourceId: 'source_world_1',
      scenarioId: 'scenario_1',
      name: 'Harbor ledgers',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/tmp/harbor-ledgers.md',
      status: 'ready',
      createdAt: '2026-07-20T09:30:00.000Z',
      updatedAt: '2026-07-20T09:30:00.000Z',
    },
  ]
}

function makeKnowledgeChunks(): KnowledgeChunk[] {
  return [
    {
      chunkId: 'chunk_world_1',
      sourceId: 'source_world_1',
      chunkIndex: 0,
      content: 'North pier ledger entries close at moonrise and must be checked before departure.',
      createdAt: '2026-07-20T09:30:00.000Z',
    },
  ]
}

function makeApp(
  llmAdapter: ILlmAdapter,
  avatar: AvatarConfig,
  options: {
    messageRepository?: InMemoryMessageRepository
    conversationWorkingMemoryRepository?: InMemoryConversationWorkingMemoryRepository
    userMemoryFactRepository?: InMemoryUserMemoryFactRepository
    knowledgeSourceRepository?: InMemoryKnowledgeSourceRepository
    knowledgeChunkRepository?: InMemoryKnowledgeChunkRepository
  } = {},
) {
  return createServer(TEST_CONFIG, {
    llmAdapter,
    observabilityAdapter: new NullObservabilityAdapter(),
    scenarioRepository: new InMemoryScenarioRepository([makeScenario()]),
    avatarRepository: new InMemoryAvatarRepository([avatar]),
    sessionRepository: new InMemorySessionRepository([makeSession()]),
    conversationRepository: new InMemoryConversationRepository([makeConversation()]),
    messageRepository: options.messageRepository ?? new InMemoryMessageRepository(),
    userRepository: new InMemoryUserRepository([makeUser()]),
    ...(options.conversationWorkingMemoryRepository !== undefined
      ? { conversationWorkingMemoryRepository: options.conversationWorkingMemoryRepository }
      : {}),
    ...(options.userMemoryFactRepository !== undefined
      ? { userMemoryFactRepository: options.userMemoryFactRepository }
      : {}),
    ...(options.knowledgeSourceRepository !== undefined
      ? { knowledgeSourceRepository: options.knowledgeSourceRepository }
      : {}),
    ...(options.knowledgeChunkRepository !== undefined
      ? { knowledgeChunkRepository: options.knowledgeChunkRepository }
      : {}),
  })
}

describe('POST /v1/conversations/:conversationId/messages runtime context wiring', () => {
  it('uses all seven runtime sections on the HTTP path in the expected priority order', async () => {
    const llm = new CapturingLlmAdapter()
    const app = makeApp(
      llm,
      makeAvatar({
        personaPrompt: 'Legacy persona text that should not be preferred.',
        computedTraits: SAMPLE_TRAITS,
      }),
      {
        messageRepository: new InMemoryMessageRepository(makeMessages()),
        conversationWorkingMemoryRepository: new InMemoryConversationWorkingMemoryRepository([
          makeWorkingMemory(),
        ]),
        userMemoryFactRepository: new InMemoryUserMemoryFactRepository(makeUserFacts()),
        knowledgeSourceRepository: new InMemoryKnowledgeSourceRepository(makeKnowledgeSources()),
        knowledgeChunkRepository: new InMemoryKnowledgeChunkRepository(makeKnowledgeChunks()),
      },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: { content: 'What should I do?' } },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<unknown>>().error).toBeNull()

    const systemPrompt = llm.calls[0]?.systemPrompt
    expect(systemPrompt).toBeTypeOf('string')
    expectSectionOrder(systemPrompt ?? '', [
      '## Director Notes',
      '## Response Rules',
      '## Conversation State',
      '## User Persona',
      '## World Context',
      '## Retrieved Context',
      '## Avatar Traits',
    ])
    expect(systemPrompt).toContain('Keep the answer practical.')
    expect(systemPrompt).toContain('Use short paragraphs.')
    expect(systemPrompt).not.toContain('Recent exchanges:')
    expect(systemPrompt).not.toContain('Session working memory:')
    expect(systemPrompt).toContain('Remembered user facts:')
    expect(systemPrompt).toContain('- preferred_route: north pier')
    expect(systemPrompt).toContain('Name: Maya')
    expect(systemPrompt).toContain('Role in this world: captain')
    expect(systemPrompt).toContain('The harbor closes at moonrise.')
    expect(systemPrompt).toContain('North pier ledger entries close at moonrise')
    expect(systemPrompt).toContain('Identity:')
    expect(systemPrompt).toContain('- Harbor archivist')
    expect(systemPrompt).not.toContain('Legacy persona text that should not be preferred.')

    expect(llm.calls[0]?.messages).toContainEqual({
      role: 'assistant',
      content:
        'Summary of previous conversation (context only, not a new reply):\nTrack the north pier ledger and unresolved moonrise timing.',
    })
  })

  it('falls back to the authored personaPrompt on the HTTP path when traits are not prepared', async () => {
    const llm = new CapturingLlmAdapter()
    const app = makeApp(
      llm,
      makeAvatar({
        personaPrompt: 'You are Ava, a careful harbor guide.',
      }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/messages',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: { content: 'What should I do?' } },
    })

    expect(response.statusCode).toBe(200)
    const systemPrompt = llm.calls[0]?.systemPrompt ?? ''
    expect(systemPrompt).toContain('## Avatar Traits')
    expect(systemPrompt).toContain('You are Ava, a careful harbor guide.')
    expect(systemPrompt).not.toContain('- Harbor archivist')
  })
})

function expectSectionOrder(prompt: string, sections: string[]): void {
  let previousIndex = -1
  for (const section of sections) {
    const currentIndex = prompt.indexOf(section)
    expect(currentIndex).toBeGreaterThan(previousIndex)
    previousIndex = currentIndex
  }
}
