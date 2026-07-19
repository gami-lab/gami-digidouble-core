import { describe, expect, it, vi } from 'vitest'
import type { AvatarComputedTraits } from '@gami/shared'
import type { ILlmAdapter, LlmRequest } from '../../ports/ILlmAdapter.js'
import type { IObservabilityAdapter, TraceEvent } from '../../ports/IObservabilityAdapter.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { LlmError } from '../../../infrastructure/llm/llm.error.js'
import { PrepareScenarioAvatarTraitsUseCase } from './prepare-scenario-avatar-traits.use-case.js'

const sampleTraits: AvatarComputedTraits = {
  identity: ['A guide'],
  personality: ['Curious'],
  speakingStyle: ['Short sentences'],
  background: ['Former teacher'],
  timeline: ['Joined at story start'],
  currentSituation: ['Welcoming visitors'],
  behaviouralRules: ['No spoilers'],
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: 'A quiet coastal town.',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava.',
    config: {},
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  }
}

function makeKnowledgeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: 'source_1',
    scenarioId: 'scenario_1',
    name: 'Source',
    knowledgeType: 'memory',
    format: 'text',
    uriOrPath: 'inline://source_1',
    status: 'ready',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  }
}

function llmResponse(content: string): ReturnType<ILlmAdapter['complete']> {
  return Promise.resolve({
    content,
    model: 'test-model',
    inputTokens: 10,
    outputTokens: 10,
    latencyMs: 1,
  })
}

/** Fake LLM adapter that answers per-avatar based on `trace.metadata.avatarId`. */
function createLlm(
  responsesByAvatarId: Record<string, string>,
): ILlmAdapter & { requests: LlmRequest[] } {
  const requests: LlmRequest[] = []
  return {
    requests,
    complete: vi.fn((request: LlmRequest) => {
      requests.push(request)
      const avatarId = request.trace?.metadata?.['avatarId']
      const content = typeof avatarId === 'string' ? (responsesByAvatarId[avatarId] ?? '{}') : '{}'
      return llmResponse(content)
    }),
  }
}

class FailingSaveAvatarRepository extends InMemoryAvatarRepository {
  constructor(
    initialData: AvatarConfig[],
    private readonly failingAvatarId: string,
  ) {
    super(initialData)
  }

  override async saveComputedTraits(
    avatarId: string,
    computedTraits: AvatarComputedTraits | null,
  ): Promise<AvatarConfig> {
    if (avatarId === this.failingAvatarId) {
      throw new Error('database write failed')
    }
    return await super.saveComputedTraits(avatarId, computedTraits)
  }
}

function createObservabilitySpy(): IObservabilityAdapter & { events: TraceEvent[] } {
  const events: TraceEvent[] = []
  return {
    events,
    trace: vi.fn((event: TraceEvent) => {
      events.push(event)
      return Promise.resolve()
    }),
    flush: vi.fn(() => Promise.resolve()),
  }
}

describe('PrepareScenarioAvatarTraitsUseCase', () => {
  it('throws NOT_FOUND when the scenario does not exist', async () => {
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository(),
      new InMemoryAvatarRepository(),
      new InMemoryKnowledgeSourceRepository(),
      createLlm({}),
    )

    await expect(useCase.execute({ scenarioId: 'scenario_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('computes and persists traits for every avatar in the scenario', async () => {
    const avatarRepository = new InMemoryAvatarRepository([
      makeAvatar({ avatarId: 'avatar_1', name: 'Ava' }),
      makeAvatar({ avatarId: 'avatar_2', name: 'Theo' }),
    ])
    const llm = createLlm({
      avatar_1: JSON.stringify(sampleTraits),
      avatar_2: JSON.stringify({ ...sampleTraits, identity: ['A rival'] }),
    })
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([makeScenario()]),
      avatarRepository,
      new InMemoryKnowledgeSourceRepository(),
      llm,
    )

    const output = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(output.scenarioId).toBe('scenario_1')
    expect(output.results).toHaveLength(2)
    expect(output.results.every((result) => result.status === 'prepared')).toBe(true)

    const avatar1 = await avatarRepository.findById('avatar_1')
    const avatar2 = await avatarRepository.findById('avatar_2')
    expect(avatar1?.computedTraits).toEqual(sampleTraits)
    expect(avatar2?.computedTraits).toEqual({ ...sampleTraits, identity: ['A rival'] })
  })
})

describe('PrepareScenarioAvatarTraitsUseCase — output and source gathering', () => {
  it('returns the persisted computedTraits in the per-avatar result', async () => {
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([makeScenario()]),
      new InMemoryAvatarRepository([makeAvatar()]),
      new InMemoryKnowledgeSourceRepository(),
      createLlm({ avatar_1: JSON.stringify(sampleTraits) }),
    )

    const output = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(output.results).toEqual([
      { avatarId: 'avatar_1', status: 'prepared', computedTraits: sampleTraits },
    ])
  })

  it('only gathers memory/world knowledge sources scoped to the scenario', async () => {
    const llm = createLlm({ avatar_1: JSON.stringify(sampleTraits) })
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([makeScenario({ worldContext: '' })]),
      new InMemoryAvatarRepository([makeAvatar()]),
      new InMemoryKnowledgeSourceRepository([
        makeKnowledgeSource({
          sourceId: 'mem_in_scope',
          knowledgeType: 'memory',
          metadata: { inlineText: 'IN SCOPE MEMORY TEXT' },
        }),
        makeKnowledgeSource({
          sourceId: 'world_in_scope',
          knowledgeType: 'world',
          metadata: { inlineText: 'IN SCOPE WORLD TEXT' },
        }),
        makeKnowledgeSource({
          sourceId: 'media_excluded',
          knowledgeType: 'media',
          metadata: { inlineText: 'MEDIA TEXT SHOULD BE EXCLUDED' },
        }),
        makeKnowledgeSource({
          sourceId: 'other_scenario',
          scenarioId: 'scenario_other',
          knowledgeType: 'memory',
          metadata: { inlineText: 'OTHER SCENARIO TEXT SHOULD BE EXCLUDED' },
        }),
      ]),
      llm,
    )

    await useCase.execute({ scenarioId: 'scenario_1' })

    const userMessage = llm.requests[0]?.messages[0]?.content ?? ''
    expect(userMessage).toContain('IN SCOPE MEMORY TEXT')
    expect(userMessage).toContain('IN SCOPE WORLD TEXT')
    expect(userMessage).not.toContain('MEDIA TEXT SHOULD BE EXCLUDED')
    expect(userMessage).not.toContain('OTHER SCENARIO TEXT SHOULD BE EXCLUDED')
  })

  it('does not skip knowledge sources missing preserved inline text, it just omits them from context', async () => {
    const llm = createLlm({ avatar_1: JSON.stringify(sampleTraits) })
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([makeScenario({ worldContext: '' })]),
      new InMemoryAvatarRepository([makeAvatar()]),
      new InMemoryKnowledgeSourceRepository([
        makeKnowledgeSource({
          sourceId: 'no_inline_text',
          knowledgeType: 'memory',
          metadata: {},
        }),
      ]),
      llm,
    )

    const output = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(output.results[0]).toMatchObject({ status: 'prepared' })
    const userMessage = llm.requests[0]?.messages[0]?.content ?? ''
    expect(userMessage).not.toContain('MEMORY DOCUMENTS')
  })
})

describe('PrepareScenarioAvatarTraitsUseCase — failure isolation', () => {
  it('isolates a failed avatar so other avatars in the scenario still succeed', async () => {
    const avatarRepository = new InMemoryAvatarRepository([
      makeAvatar({ avatarId: 'avatar_good', name: 'Good' }),
      makeAvatar({ avatarId: 'avatar_bad', name: 'Bad' }),
    ])
    const llm = createLlm({
      avatar_good: JSON.stringify(sampleTraits),
      avatar_bad: 'not valid json',
    })
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([makeScenario()]),
      avatarRepository,
      new InMemoryKnowledgeSourceRepository(),
      llm,
    )

    const output = await useCase.execute({ scenarioId: 'scenario_1' })

    const good = output.results.find((result) => result.avatarId === 'avatar_good')
    const bad = output.results.find((result) => result.avatarId === 'avatar_bad')
    expect(good).toMatchObject({ status: 'prepared' })
    expect(bad).toMatchObject({ status: 'failed', reason: 'unparseable_output' })

    const badAvatar = await avatarRepository.findById('avatar_bad')
    expect(badAvatar?.computedTraits).toBeUndefined()
  })

  it('normalizes provider and persistence failures while tracing a batch summary', async () => {
    const avatarRepository = new FailingSaveAvatarRepository(
      [
        makeAvatar({ avatarId: 'avatar_good', name: 'Good' }),
        makeAvatar({ avatarId: 'avatar_llm', name: 'LLM fail' }),
        makeAvatar({ avatarId: 'avatar_persist', name: 'Persistence fail' }),
      ],
      'avatar_persist',
    )
    const observability = createObservabilitySpy()
    const llm: ILlmAdapter = {
      complete: vi.fn((request: LlmRequest) => {
        const avatarId = request.trace?.metadata?.['avatarId']
        if (avatarId === 'avatar_llm') {
          throw new LlmError('openai', 'raw provider message', 502)
        }
        return llmResponse(JSON.stringify(sampleTraits))
      }),
    }
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([makeScenario()]),
      avatarRepository,
      new InMemoryKnowledgeSourceRepository(),
      llm,
      undefined,
      undefined,
      undefined,
      observability,
    )

    const output = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(output.results.find((result) => result.avatarId === 'avatar_good')).toMatchObject({
      status: 'prepared',
      computedTraits: sampleTraits,
    })
    expect(output.results.find((result) => result.avatarId === 'avatar_llm')).toEqual({
      avatarId: 'avatar_llm',
      status: 'failed',
      reason: 'llm_error',
    })
    expect(output.results.find((result) => result.avatarId === 'avatar_persist')).toEqual({
      avatarId: 'avatar_persist',
      status: 'failed',
      reason: 'persistence_error',
    })

    const failedAvatar = await avatarRepository.findById('avatar_persist')
    expect(failedAvatar?.computedTraits).toBeUndefined()

    expect(observability.events).toHaveLength(1)
    expect(observability.events[0]).toMatchObject({
      event: 'avatar.trait_preparation.completed',
      output: {
        preparedCount: 1,
        failedCount: 2,
      },
      metadata: {
        scenarioId: 'scenario_1',
        avatarCount: 3,
        failureReasons: ['llm_error', 'persistence_error'],
      },
    })
    expect(observability.events[0]?.metadata?.['preparedAvatarIds']).toEqual(['avatar_good'])
    expect(observability.events[0]?.metadata?.['failedAvatarIds']).toEqual([
      'avatar_llm',
      'avatar_persist',
    ])
  })
})

describe('PrepareScenarioAvatarTraitsUseCase — recomputation', () => {
  it('recomputation overwrites derived traits without mutating original avatar fields', async () => {
    const avatarRepository = new InMemoryAvatarRepository([
      makeAvatar({
        avatarId: 'avatar_1',
        personaPrompt: 'Original prompt.',
        description: 'Original description.',
      }),
    ])
    const llm = createLlm({ avatar_1: JSON.stringify(sampleTraits) })
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([makeScenario()]),
      avatarRepository,
      new InMemoryKnowledgeSourceRepository(),
      llm,
    )

    await useCase.execute({ scenarioId: 'scenario_1' })

    const updatedTraits: AvatarComputedTraits = { ...sampleTraits, identity: ['Regenerated'] }
    llm.complete = vi.fn(() => llmResponse(JSON.stringify(updatedTraits)))

    const secondOutput = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(secondOutput.results[0]).toMatchObject({
      status: 'prepared',
      computedTraits: updatedTraits,
    })

    const avatar = await avatarRepository.findById('avatar_1')
    expect(avatar?.computedTraits).toEqual(updatedTraits)
    expect(avatar?.personaPrompt).toBe('Original prompt.')
    expect(avatar?.description).toBe('Original description.')
  })

  it('rerunning preparation after editing the avatar description reflects the new source text', async () => {
    const avatarRepository = new InMemoryAvatarRepository([
      makeAvatar({ avatarId: 'avatar_1', personaPrompt: 'Original prompt.' }),
    ])
    const llm = createLlm({ avatar_1: JSON.stringify(sampleTraits) })
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([makeScenario()]),
      avatarRepository,
      new InMemoryKnowledgeSourceRepository(),
      llm,
    )

    await useCase.execute({ scenarioId: 'scenario_1' })
    expect(llm.requests[0]?.messages[0]?.content).toContain('Original prompt.')

    await avatarRepository.update('avatar_1', { personaPrompt: 'Updated prompt after edit.' })
    const updatedTraits: AvatarComputedTraits = { ...sampleTraits, identity: ['Reflects the edit'] }
    llm.complete = vi.fn((request: LlmRequest) => {
      llm.requests.push(request)
      return llmResponse(JSON.stringify(updatedTraits))
    })

    const secondOutput = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(llm.requests[1]?.messages[0]?.content).toContain('Updated prompt after edit.')
    expect(llm.requests[1]?.messages[0]?.content).not.toContain('Original prompt.')
    expect(secondOutput.results[0]).toMatchObject({
      status: 'prepared',
      computedTraits: updatedTraits,
    })

    const avatar = await avatarRepository.findById('avatar_1')
    expect(avatar?.computedTraits).toEqual(updatedTraits)
    expect(avatar?.personaPrompt).toBe('Updated prompt after edit.')
  })
})
