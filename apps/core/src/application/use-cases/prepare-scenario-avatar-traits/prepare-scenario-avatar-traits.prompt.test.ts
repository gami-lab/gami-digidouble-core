import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { buildTraitPreparationUserMessage } from './prepare-scenario-avatar-traits.prompt.js'

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava, a warm guide.',
    config: {},
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  }
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
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
    name: 'Some Source',
    knowledgeType: 'memory',
    format: 'text',
    uriOrPath: 'inline://source_1',
    status: 'ready',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildTraitPreparationUserMessage', () => {
  it('includes the avatar description fields', () => {
    const message = buildTraitPreparationUserMessage({
      avatar: makeAvatar({
        tone: 'warm',
        description: 'Onboarding guide',
        adjustments: ['Be concise'],
      }),
      scenario: makeScenario(),
      memorySources: [],
      worldSources: [],
    })

    expect(message).toContain('Name: Ava')
    expect(message).toContain('Tone: warm')
    expect(message).toContain('Description: Onboarding guide')
    expect(message).toContain('Persona prompt: You are Ava, a warm guide.')
    expect(message).toContain('Adjustments: Be concise')
  })

  it('includes memory source inline text under its own section', () => {
    const message = buildTraitPreparationUserMessage({
      avatar: makeAvatar(),
      scenario: makeScenario(),
      memorySources: [
        makeKnowledgeSource({
          sourceId: 'mem_1',
          name: 'Backstory notes',
          metadata: { inlineText: 'Ava grew up in a coastal village.' },
        }),
      ],
      worldSources: [],
    })

    expect(message).toContain('--- MEMORY DOCUMENTS ---')
    expect(message).toContain('Ava grew up in a coastal village.')
  })

  it('includes scenario.worldContext and world source inline text under one section', () => {
    const message = buildTraitPreparationUserMessage({
      avatar: makeAvatar(),
      scenario: makeScenario({ worldContext: 'A rain-soaked port city.' }),
      memorySources: [],
      worldSources: [
        makeKnowledgeSource({
          sourceId: 'world_1',
          name: 'City lore',
          knowledgeType: 'world',
          metadata: { inlineText: 'The city runs on tidal power.' },
        }),
      ],
    })

    expect(message).toContain('--- WORLD CONTEXT ---')
    expect(message).toContain('A rain-soaked port city.')
    expect(message).toContain('The city runs on tidal power.')
  })

  it('skips knowledge sources with no preserved inline text', () => {
    const message = buildTraitPreparationUserMessage({
      avatar: makeAvatar(),
      scenario: makeScenario(),
      memorySources: [
        makeKnowledgeSource({ sourceId: 'mem_missing', name: 'Unparsed upload', metadata: {} }),
      ],
      worldSources: [],
    })

    expect(message).not.toContain('--- MEMORY DOCUMENTS ---')
    expect(message).not.toContain('Unparsed upload')
  })

  it('omits the world context section entirely when there is nothing to say', () => {
    const message = buildTraitPreparationUserMessage({
      avatar: makeAvatar(),
      scenario: makeScenario({ worldContext: '' }),
      memorySources: [],
      worldSources: [],
    })

    expect(message).not.toContain('--- WORLD CONTEXT ---')
  })
})
