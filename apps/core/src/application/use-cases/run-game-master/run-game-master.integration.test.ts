import { describe, expect, it } from 'vitest'
import type { IObservabilityAdapter, TraceEvent } from '../../ports/IObservabilityAdapter.js'
import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../ports/ILlmAdapter.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'
import { ObservedLlmAdapter } from '../../../infrastructure/llm/observed.adapter.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { InMemorySessionEventPublisher } from '../../../infrastructure/events/in-memory-session-event-publisher.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import { readRenderedGameMasterPrompt } from '../../../test-utils/game-master.js'
import { GAME_MASTER_INPUT_RENDERER_VERSION } from '../../../domain/game-master/gm-input-renderer.js'
import { GAME_MASTER_SYSTEM_PROMPT_VERSION } from '../../../domain/game-master/gm-prompt.service.js'

const GM_RESPONSE: LlmResponse = {
  content: JSON.stringify({
    avatarId: 'avatar_1',
    suggestedAvatarId: 'avatar_2',
    suggestedAvatarReason: 'Marine engineering context may help next.',
    conversationMode: 'continue',
    context: { notes: 'Keep the next reply grounded in tide evidence.' },
    stateUpdate: {
      progression: 'increase',
      topicCovered: 'harbor_timeline',
      interactionIncrement: 1,
    },
  }),
  model: 'observed-null-model',
  inputTokens: 18,
  outputTokens: 12,
  latencyMs: 5,
}

const INITIAL_SESSION = {
  sessionId: 'session_1',
  userId: 'user_1',
  scenarioId: 'scenario_1',
  activeAvatarId: 'avatar_1',
  unlockedAvatarIds: ['avatar_1'],
  status: 'active' as const,
  startedAt: '2026-07-20T09:00:00.000Z',
  lastActivityAt: '2026-07-20T09:00:00.000Z',
}

const INITIAL_AVATARS = [
  {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    description: 'Harbor witness.',
    status: 'active' as const,
    personaPrompt: 'You are Ava.',
    config: { scope: 'Dock activity and local rumors.' },
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z',
  },
  {
    avatarId: 'avatar_2',
    scenarioId: 'scenario_1',
    name: 'Theo',
    description: 'Marine engineer.',
    status: 'active' as const,
    personaPrompt: 'You are Theo.',
    config: { scope: 'Tide mechanics and structural risk.' },
    createdAt: '2026-07-20T09:01:00.000Z',
    updatedAt: '2026-07-20T09:01:00.000Z',
  },
]

const INITIAL_SCENARIO = {
  scenarioId: 'scenario_1',
  name: 'Storm Harbor',
  status: 'active' as const,
  objectives: ['Reconstruct the harbor timeline.'],
  worldContext: 'Storm tide starts at dusk near the north harbor.',
  avatarAvailability: { initialAvatarIds: ['avatar_1'], unlockableAvatarIds: ['avatar_2'] },
  config: { goals: ['Decide whether a specialist is needed.'] },
  createdAt: '2026-07-20T09:00:00.000Z',
  updatedAt: '2026-07-20T09:00:00.000Z',
}

const INITIAL_MESSAGES = [
  {
    messageId: 'message_1',
    conversationId: 'conversation_1',
    role: 'user' as const,
    content: 'What happened at the north harbor?',
    createdAt: '2026-07-20T09:10:00.000Z',
  },
  {
    messageId: 'message_2',
    conversationId: 'conversation_1',
    role: 'avatar' as const,
    content: 'The docks were crowded as the storm tide rose.',
    createdAt: '2026-07-20T09:10:01.000Z',
  },
  {
    messageId: 'message_3',
    conversationId: 'conversation_1',
    role: 'user' as const,
    content: 'Should we bring in an engineer to verify the tide gates?',
    createdAt: '2026-07-20T09:10:02.000Z',
  },
  {
    messageId: 'message_4',
    conversationId: 'conversation_1',
    role: 'avatar' as const,
    content: 'We should confirm the tide log before escalating.',
    createdAt: '2026-07-20T09:10:03.000Z',
  },
]

const INITIAL_KNOWLEDGE_SOURCES = [
  {
    sourceId: 'memory_source_1',
    scenarioId: 'scenario_1',
    name: 'Harbor memory',
    knowledgeType: 'memory' as const,
    format: 'text' as const,
    uriOrPath: 'memory://harbor',
    status: 'ready' as const,
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z',
  },
  {
    sourceId: 'world_source_1',
    scenarioId: 'scenario_1',
    name: 'Storm tide notes',
    knowledgeType: 'world' as const,
    format: 'text' as const,
    uriOrPath: 'world://harbor',
    status: 'ready' as const,
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z',
  },
  {
    sourceId: 'media_source_1',
    scenarioId: 'scenario_1',
    name: 'Harbor map',
    knowledgeType: 'media' as const,
    format: 'text' as const,
    uriOrPath: 'media://harbor-map',
    status: 'ready' as const,
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z',
  },
]

const INITIAL_KNOWLEDGE_CHUNKS = [
  {
    chunkId: 'memory_chunk_1',
    sourceId: 'memory_source_1',
    content: 'The witness already contradicted the tide log during the prior harbor inspection.',
    chunkIndex: 0,
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    chunkId: 'world_chunk_1',
    sourceId: 'world_source_1',
    content: 'Storm tide starts at dusk near the north harbor tide gates.',
    chunkIndex: 0,
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    chunkId: 'media_chunk_1',
    sourceId: 'media_source_1',
    content: 'Harbor map with dock markers and tide gates.',
    chunkIndex: 0,
    createdAt: '2026-07-20T09:00:00.000Z',
  },
]

describe('RunGameMasterUseCase integration', () => {
  it('proves the composed refined GM prompt path with real in-memory adapters', async () => {
    const harness = createIntegrationHarness()

    await harness.useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'Should we bring in an engineer to verify the tide gates?',
      turnIndex: 4,
      correlationId: 'corr_integration',
      userPersona: { name: 'Lina', roleInWorld: 'investigator' },
    })

    assertRenderedPrompt(harness.innerLlm.requests[0])
    await assertPersistenceAndEvents(harness)
    assertTraceMetadata(harness.observability.events[0])
  })
})

function createIntegrationHarness() {
  const innerLlm = new RecordingLlmAdapter(GM_RESPONSE)
  const observability = new RecordingObservabilityAdapter()
  const llm = new ObservedLlmAdapter(innerLlm, observability)

  const gmStateRepository = new InMemoryGmStateRepository([
    {
      sessionId: 'session_1',
      state: {
        currentAvatarId: 'avatar_1',
        progression: 'intro',
        topicsCovered: ['setup'],
        interactionCount: 1,
      },
    },
  ])
  const sessionRepository = new InMemorySessionRepository([INITIAL_SESSION])
  const avatarRepository = new InMemoryAvatarRepository(INITIAL_AVATARS)
  const scenarioRepository = new InMemoryScenarioRepository([INITIAL_SCENARIO])
  const messageRepository = new InMemoryMessageRepository(INITIAL_MESSAGES)
  const workingMemoryRepository = new InMemoryConversationWorkingMemoryRepository([
    {
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'The witness already contradicted the tide log.',
      unresolvedThreads: ['Confirm dock number.'],
      candidateFacts: [],
      updatedAt: '2026-07-20T09:00:00.000Z',
    },
  ])
  const conversationMemoryRepository = new InMemoryConversationMemoryRepository([
    {
      conversationId: 'conversation_past_1',
      sessionId: 'session_prev',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      summary: 'A prior harbor inspection raised the same contradiction.',
      keyDiscoveries: ['The tide log was altered.'],
      unresolvedTopics: ['Who changed the tide log?'],
      factCandidates: [],
      createdAt: '2026-07-19T12:00:00.000Z',
    },
  ])
  const userMemoryFactRepository = new InMemoryUserMemoryFactRepository([
    {
      id: 'fact_1',
      userId: 'user_1',
      category: 'preference',
      key: 'tone',
      value: 'concise',
      createdAt: '2026-07-19T12:00:00.000Z',
      updatedAt: '2026-07-20T08:00:00.000Z',
    },
  ])
  const knowledgeSourceRepository = new InMemoryKnowledgeSourceRepository(INITIAL_KNOWLEDGE_SOURCES)
  const knowledgeChunkRepository = new InMemoryKnowledgeChunkRepository(INITIAL_KNOWLEDGE_CHUNKS)
  const eventLogRepository = new InMemoryEventLogRepository()
  const sessionEventPublisher = new InMemorySessionEventPublisher()
  const publishedRuntimeEvents: string[] = []
  sessionEventPublisher.subscribe('session_1', (event) => {
    publishedRuntimeEvents.push(event.type)
  })

  const memorySelectionService = new MemorySelectionService(
    messageRepository,
    workingMemoryRepository,
    conversationMemoryRepository,
    userMemoryFactRepository,
  )
  const typedRetrievalService = new TypedRetrievalService(
    knowledgeSourceRepository,
    knowledgeChunkRepository,
  )
  const useCase = new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
    scenarioRepository,
    eventLogRepository,
    undefined,
    messageRepository,
    sessionEventPublisher,
    memorySelectionService,
    typedRetrievalService,
  )

  return {
    innerLlm,
    observability,
    useCase,
    gmStateRepository,
    sessionRepository,
    eventLogRepository,
    publishedRuntimeEvents,
  }
}

function assertRenderedPrompt(request: Omit<LlmRequest, 'trace'> | undefined): void {
  expect(request).toBeDefined()
  const systemPrompt = request?.systemPrompt ?? ''
  const renderedPrompt = readRenderedGameMasterPrompt(request)

  expectSectionOrder(systemPrompt, [
    '## Role',
    '## Objectives',
    '## Decision Policies',
    '## Output Contract',
  ])
  expect(systemPrompt).toContain('Output ONLY a valid JSON object.')
  expect(systemPrompt).toContain(
    'Bias toward conversationMode "continue" unless there is clear evidence for a switch.',
  )
  expectSectionOrder(renderedPrompt, [
    '## Current Turn',
    '## Current Discussion Context',
    '## Experience Context',
    '## Output Reminder',
  ])
  expect(renderedPrompt).toContain(
    '- Latest User Message: Should we bring in an engineer to verify the tide gates?',
  )
  expect(renderedPrompt).toContain(
    '- Latest Avatar Reply: We should confirm the tide log before escalating.',
  )
  expect(renderedPrompt).toContain('### Scenario')
  expect(renderedPrompt).toContain('- Goal 1: Reconstruct the harbor timeline.')
  expect(renderedPrompt).toContain('- Goal 2: Decide whether a specialist is needed.')
  expect(renderedPrompt).toContain('### Available Avatars')
  expect(renderedPrompt).toContain(
    '- Ava (avatar_1) [available]; description: Harbor witness.; scope: Dock activity and local rumors.',
  )
  expect(renderedPrompt).toContain(
    '- Theo (avatar_2) [locked]; description: Marine engineer.; scope: Tide mechanics and structural risk.',
  )
  expect(renderedPrompt).toContain('### Working Memory')
  expect(renderedPrompt).toContain('- Covered Topics: none')
  expect(renderedPrompt).toContain('### Episodic Memories')
  expect(renderedPrompt).toContain('### Long-Term Facts')
  expect(renderedPrompt).toContain('### User Persona')
  expect(renderedPrompt).toContain('- Name: Lina')
  expect(renderedPrompt).toContain('- Role In World: investigator')
  expect(renderedPrompt).toContain('### Retrieved Context')
}

async function assertPersistenceAndEvents(harness: ReturnType<typeof createIntegrationHarness>) {
  expect(await harness.sessionRepository.findById('session_1')).toMatchObject({
    gmNotes: 'Keep the next reply grounded in tide evidence.',
    unlockedAvatarIds: ['avatar_1'],
  })
  expect(await harness.gmStateRepository.findBySessionId('session_1')).toMatchObject({
    currentAvatarId: 'avatar_1',
    progression: 'intro [advanced]',
    topicsCovered: ['setup', 'harbor_timeline'],
    interactionCount: 2,
  })

  const event = harness.eventLogRepository.getAll()[0]
  expect(event).toMatchObject({
    type: 'gm_triggered',
    correlationId: 'corr_integration',
  })
  expect(JSON.stringify(event?.payload ?? {})).not.toContain('systemPrompt')
  expect(JSON.stringify(event?.payload ?? {})).not.toContain('## Role')
  expect(JSON.stringify(event?.payload ?? {})).not.toContain('## Current Turn')
  expect(harness.publishedRuntimeEvents).toContain('runtime.avatar_suggested')
}

function assertTraceMetadata(event: TraceEvent | undefined): void {
  expect(event?.event).toBe('gm.llm_completion')
  expect(event?.requestId).toMatch(/^gm_/)
  expect(event?.sessionId).toBe('session_1')
  expect(event?.metadata).toMatchObject({
    gmSystemPromptVersion: GAME_MASTER_SYSTEM_PROMPT_VERSION,
    gmInputRendererVersion: GAME_MASTER_INPUT_RENDERER_VERSION,
  })
}

class RecordingLlmAdapter implements ILlmAdapter {
  readonly requests: Array<Omit<LlmRequest, 'trace'>> = []

  constructor(private readonly response: LlmResponse) {}

  complete(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(request)
    return Promise.resolve(this.response)
  }
}

class RecordingObservabilityAdapter implements IObservabilityAdapter {
  readonly events: TraceEvent[] = []

  trace(event: TraceEvent): Promise<void> {
    this.events.push(event)
    return Promise.resolve()
  }

  flush(): Promise<void> {
    return Promise.resolve()
  }
}

function expectSectionOrder(prompt: string, sections: string[]): void {
  let previousIndex = -1

  for (const section of sections) {
    const index = prompt.indexOf(section)
    expect(index).toBeGreaterThan(previousIndex)
    previousIndex = index
  }
}
