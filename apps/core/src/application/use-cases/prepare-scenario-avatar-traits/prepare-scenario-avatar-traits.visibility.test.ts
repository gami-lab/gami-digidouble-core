import { describe, expect, it, vi } from 'vitest'
import type { ILlmAdapter, LlmRequest } from '../../ports/ILlmAdapter.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { PrepareScenarioAvatarTraitsUseCase } from './prepare-scenario-avatar-traits.use-case.js'

const TIMESTAMP = '2026-07-20T00:00:00.000Z'

function makeAvatar(avatarId: string, name: string): AvatarConfig {
  return {
    avatarId,
    scenarioId: 'scenario_1',
    name,
    status: 'active',
    personaPrompt: `You are ${name}.`,
    config: {},
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
}

function makeSource(
  overrides: Pick<KnowledgeSource, 'sourceId' | 'knowledgeType' | 'visibilityPolicy'> &
    Partial<KnowledgeSource>,
): KnowledgeSource {
  return {
    scenarioId: 'scenario_1',
    name: overrides.sourceId,
    format: 'text',
    uriOrPath: `inline://${overrides.sourceId}`,
    status: 'ready',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    metadata: { inlineText: `TEXT OF ${overrides.sourceId}` },
    ...overrides,
  }
}

function createRecordingLlm(): ILlmAdapter & { userMessageByAvatarId: Map<string, string> } {
  const userMessageByAvatarId = new Map<string, string>()
  return {
    userMessageByAvatarId,
    complete: vi.fn((request: LlmRequest) => {
      const avatarId = request.trace?.metadata?.['avatarId']
      if (typeof avatarId === 'string') {
        userMessageByAvatarId.set(avatarId, request.messages[0]?.content ?? '')
      }
      return Promise.resolve({
        content: '{}',
        model: 'test-model',
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 1,
      })
    }),
  }
}

describe('PrepareScenarioAvatarTraitsUseCase — knowledge visibility', () => {
  it('gives each avatar only the memory and world sources visible to it', async () => {
    const llm = createRecordingLlm()
    const useCase = new PrepareScenarioAvatarTraitsUseCase(
      new InMemoryScenarioRepository([
        {
          scenarioId: 'scenario_1',
          name: 'Scenario',
          status: 'active',
          objectives: [],
          worldContext: '',
          avatarAvailability: { initialAvatarIds: [] },
          config: {},
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        },
      ]),
      new InMemoryAvatarRepository([
        makeAvatar('avatar_emma', 'Emma'),
        makeAvatar('avatar_max', 'Max'),
      ]),
      new InMemoryKnowledgeSourceRepository([
        makeSource({
          sourceId: 'emma_memory',
          knowledgeType: 'avatar_knowledge',
          visibilityPolicy: 'avatars',
          visibleToAvatarIds: ['avatar_emma'],
        }),
        makeSource({
          sourceId: 'shared_memory',
          knowledgeType: 'avatar_knowledge',
          visibilityPolicy: 'all',
        }),
        makeSource({
          sourceId: 'emma_world',
          knowledgeType: 'world',
          visibilityPolicy: 'avatars',
          visibleToAvatarIds: ['avatar_emma'],
        }),
        makeSource({ sourceId: 'hidden_world', knowledgeType: 'world', visibilityPolicy: 'none' }),
      ]),
      llm,
    )

    await useCase.execute({ scenarioId: 'scenario_1' })

    const emmaMessage = llm.userMessageByAvatarId.get('avatar_emma') ?? ''
    const maxMessage = llm.userMessageByAvatarId.get('avatar_max') ?? ''
    expect(emmaMessage).toContain('TEXT OF emma_memory')
    expect(emmaMessage).toContain('TEXT OF emma_world')
    expect(emmaMessage).toContain('TEXT OF shared_memory')
    expect(maxMessage).toContain('TEXT OF shared_memory')
    expect(maxMessage).not.toContain('TEXT OF emma_memory')
    expect(maxMessage).not.toContain('TEXT OF emma_world')
    expect(emmaMessage + maxMessage).not.toContain('TEXT OF hidden_world')
  })
})
