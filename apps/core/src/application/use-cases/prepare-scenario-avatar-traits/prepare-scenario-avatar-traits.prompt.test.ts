import { describe, expect, it } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import {
  buildTraitPreparationUserMessage,
  TRAIT_PREPARATION_SYSTEM_PROMPT,
} from './prepare-scenario-avatar-traits.prompt.js'

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

describe('TRAIT_PREPARATION_SYSTEM_PROMPT — grounding constraints', () => {
  it('instructs the model not to invent unsupported details', () => {
    expect(TRAIT_PREPARATION_SYSTEM_PROMPT).toContain(
      'Never invent details that are not supported by the provided sources.',
    )
  })

  it('instructs the model not to copy generic world facts into avatar traits', () => {
    expect(TRAIT_PREPARATION_SYSTEM_PROMPT).toContain(
      'never copy generic world facts into avatar traits',
    )
  })

  it('caps the non-timeline fields at 5-7 concise items', () => {
    expect(TRAIT_PREPARATION_SYSTEM_PROMPT).toContain(
      'identity, personality, speakingStyle, background, currentSituation, and behaviouralRules must each contain at most 5-7 concise items.',
    )
  })

  it('exempts timeline from the fixed item cap so events are not compressed away', () => {
    expect(TRAIT_PREPARATION_SYSTEM_PROMPT).toContain('timeline has no fixed item cap')
    expect(TRAIT_PREPARATION_SYSTEM_PROMPT).toContain(
      'never drop critical events (deaths, discoveries, confrontations, turning points)',
    )
  })

  it('forbids adding extra fields beyond the fixed structure', () => {
    expect(TRAIT_PREPARATION_SYSTEM_PROMPT).toContain('Do not add extra fields.')
  })
})

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

  it('skips knowledge sources whose inline text is present but whitespace-only', () => {
    const message = buildTraitPreparationUserMessage({
      avatar: makeAvatar(),
      scenario: makeScenario(),
      memorySources: [
        makeKnowledgeSource({
          sourceId: 'mem_blank',
          name: 'Blank upload',
          metadata: { inlineText: '   \n  ' },
        }),
      ],
      worldSources: [],
    })

    expect(message).not.toContain('--- MEMORY DOCUMENTS ---')
    expect(message).not.toContain('Blank upload')
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
