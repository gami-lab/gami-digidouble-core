import type { AvatarComputedTraits } from '@gami/shared'
import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from './avatar.fixtures.js'
import {
  assemblePersonaPrompt,
  resolveAvatarPromptIdentitySource,
} from './persona-prompt.service.js'

const SAMPLE_TRAITS: AvatarComputedTraits = {
  identity: ['Archivist of the north wing'],
  personality: ['Measured under pressure'],
  speakingStyle: ['Short and literal'],
  background: ['Former restorer of fragile maps'],
  timeline: ['Joined after the renovation'],
  currentSituation: ['Guiding late arrivals through the archive'],
  behaviouralRules: ['Never reveal sealed exhibits'],
}

describe('resolveAvatarPromptIdentitySource', () => {
  it('prefers computedTraits when they are prepared', () => {
    expect(
      resolveAvatarPromptIdentitySource(
        makeAvatarConfig({
          computedTraits: SAMPLE_TRAITS,
          personaPrompt: 'Legacy authored persona that should not win when traits exist.',
        }),
      ),
    ).toEqual({
      source: 'computedTraits',
      computedTraits: SAMPLE_TRAITS,
    })
  })

  it('falls back to personaPrompt when computedTraits are absent or null', () => {
    expect(
      resolveAvatarPromptIdentitySource(
        makeAvatarConfig({
          personaPrompt: 'You are the scenario librarian. Never break role.',
        }),
      ),
    ).toEqual({
      source: 'personaPrompt',
      personaPrompt: 'You are the scenario librarian. Never break role.',
    })

    expect(
      resolveAvatarPromptIdentitySource({
        personaPrompt: 'You are the scenario librarian. Never break role.',
        computedTraits: null,
      }),
    ).toEqual({
      source: 'personaPrompt',
      personaPrompt: 'You are the scenario librarian. Never break role.',
    })
  })
})

// eslint-disable-next-line max-lines-per-function
describe('assemblePersonaPrompt -> section order', () => {
  it('renders structured Game Master dialogue guidance and removes generic follow-up pressure', () => {
    const prompt = assemblePersonaPrompt(makeAvatarConfig(), {
      gmGuidance: {
        mode: 'repair',
        askFollowUp: false,
        directorNotes: 'Resolve the location contradiction before progressing.',
      },
    })

    expect(prompt).toContain('## Game Master Guidance')
    expect(prompt).toContain('Dialogue mode: repair')
    expect(prompt).toContain('Follow-up question: no')
    expect(prompt).toContain(
      'Director note:\nResolve the location contradiction before progressing.',
    )
    expect(prompt).toContain('Do not introduce a new topic until the issue is clarified.')
    expect(prompt).not.toContain('end with one focused follow-up question when it helps')
  })

  it('assembles runtime sections in EPIC 8.2 order', () => {
    const prompt = assemblePersonaPrompt(
      makeAvatarConfig({
        name: 'Nova',
        tone: 'calm and precise',
        personaPrompt: 'Legacy persona text that should not appear when traits exist.',
        adjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
        computedTraits: SAMPLE_TRAITS,
      }),
      {
        gmNotes: 'Steer the user toward practical examples.',
        userPersona: {
          name: 'Maya',
          roleInWorld: 'student',
          avatarRelationships: ['Friend of Eva'],
          dialogGuidance: 'Prefer practical examples.',
        },
        memory: {
          shortTerm: {
            exchangeCount: 2,
            recentExchanges: [{ user: 'Hi', avatar: 'Hello there' }],
          },
          working: {
            session: {
              summary: 'Session summary',
              updatedAt: '2026-07-20T10:00:00.000Z',
            },
            avatar: {
              avatarId: 'avatar_1',
              summary: 'Avatar summary',
              updatedAt: '2026-07-20T10:00:00.000Z',
            },
          },
          longTerm: {
            facts: [{ category: 'pref', key: 'language', value: 'English' }],
          },
        },
        worldContext: 'The archive closes at moonrise.',
        retrieval: {
          memory: [
            {
              sourceId: 'source_1',
              chunkId: 'chunk_1',
              knowledgeType: 'memory',
              content: 'The user prefers concise examples.',
            },
          ],
          world: [
            {
              sourceId: 'source_2',
              chunkId: 'chunk_2',
              knowledgeType: 'world',
              content: 'Ships dock at tidefall.',
            },
          ],
          media: [
            {
              sourceId: 'source_3',
              chunkId: 'chunk_3',
              knowledgeType: 'media',
              content: 'Reference frame: lantern map sketch.',
            },
          ],
        },
        avatarAwareness: [
          {
            name: 'Theo',
            description: 'Technical AI specialist.',
            scope: 'Model internals and infrastructure.',
            availability: 'locked',
          },
        ],
      },
    )

    expectSectionOrder(prompt, [
      '## Director Notes',
      '## Response Rules',
      '## Conversation State',
      '## User Persona',
      '## World Context',
      '## Retrieved Context',
      '## Avatar Traits',
    ])
    expectTraitFieldOrder(prompt, [
      'Identity:',
      'Personality:',
      'Speaking Style:',
      'Background:',
      'Timeline:',
      'Current Situation:',
      'Behavioural Rules:',
    ])
  })
})

describe('assemblePersonaPrompt -> identity source', () => {
  it('uses computed traits as the preferred identity input and preserves name and tone metadata', () => {
    const prompt = assemblePersonaPrompt(
      makeAvatarConfig({
        name: 'Nova',
        tone: 'calm and precise',
        personaPrompt: 'Legacy persona text that should not appear when traits exist.',
        computedTraits: SAMPLE_TRAITS,
      }),
    )

    expect(prompt).toContain('## Avatar Traits')
    expect(prompt).not.toContain('Legacy persona text that should not appear when traits exist.')
    expect(prompt).toContain('Name: Nova')
    expect(prompt).toContain('Tone: calm and precise')
    expect(prompt).toContain('Identity:')
    expect(prompt).toContain('- Archivist of the north wing')
    expect(prompt).toContain('Behavioural Rules:')
    expect(prompt).toContain('- Never reveal sealed exhibits')
  })

  it('falls back to personaPrompt in the avatar traits section when computedTraits are absent, and null compatibility resolves to the same source', () => {
    const withoutTraits = assemblePersonaPrompt(
      makeAvatarConfig({
        name: 'Nova',
        personaPrompt: 'You are a focused guide.',
        tone: 'calm and precise',
      }),
    )

    expect(
      resolveAvatarPromptIdentitySource({
        personaPrompt: 'You are a focused guide.',
        computedTraits: null,
      }),
    ).toEqual({
      source: 'personaPrompt',
      personaPrompt: 'You are a focused guide.',
    })
    expect(withoutTraits).toContain('## Avatar Traits')
    expect(withoutTraits).toContain('You are a focused guide.')
    expect(withoutTraits).toContain('Your name is Nova.')
    expect(withoutTraits).toContain('Your tone is calm and precise.')
    expect(withoutTraits).not.toContain('## Core Persona')
  })
})

describe('assemblePersonaPrompt -> runtime context sections', () => {
  it('keeps bounded conversation state, remembered facts, and avatar awareness together', () => {
    const prompt = assemblePersonaPrompt(makeAvatarConfig({ computedTraits: SAMPLE_TRAITS }), {
      memory: {
        shortTerm: {
          exchangeCount: 2,
          recentExchanges: [{ user: 'Where do I start?', avatar: 'At the north wing.' }],
        },
        working: {
          session: {
            summary: 'The user is planning a quick visit.',
            updatedAt: '2026-07-20T10:00:00.000Z',
          },
          avatar: {
            avatarId: 'avatar_1',
            summary: 'Point them to accessible exhibits first.',
            updatedAt: '2026-07-20T10:00:00.000Z',
          },
        },
        longTerm: {
          facts: [{ category: 'pref', key: 'pace', value: 'quick overview' }],
        },
      },
      avatarAwareness: [
        {
          name: 'Theo',
          description: 'Technical AI specialist.',
          scope: 'Model internals and infrastructure.',
          availability: 'locked',
        },
      ],
    })

    const conversationStateStart = prompt.indexOf('## Conversation State')
    const conversationStateEnd = prompt.indexOf('\n\n## Avatar Traits')
    const conversationStateSection = prompt.slice(conversationStateStart, conversationStateEnd)

    expect(conversationStateSection).toContain('Recent exchanges:')
    expect(conversationStateSection).toContain('- User: Where do I start?')
    expect(conversationStateSection).toContain('- Avatar: At the north wing.')
    expect(conversationStateSection).toContain(
      'Session working memory: The user is planning a quick visit.',
    )
    expect(conversationStateSection).toContain(
      'Current avatar memory: Point them to accessible exhibits first.',
    )
    expect(conversationStateSection).toContain('Remembered user facts:')
    expect(conversationStateSection).toContain('- pace: quick overview')
    expect(conversationStateSection).toContain('Other avatars in this scenario:')
    expect(conversationStateSection).toContain(
      '- Theo (locked) — Technical AI specialist. Scope: Model internals and infrastructure.',
    )
    expect(prompt).not.toContain('## Other Avatars')
  })

  it('keeps world context separate from retrieved context with typed retrieval labels', () => {
    const prompt = assemblePersonaPrompt(makeAvatarConfig({ computedTraits: SAMPLE_TRAITS }), {
      worldContext: 'The archive closes at moonrise.',
      retrieval: {
        memory: [
          {
            sourceId: 'source_1',
            chunkId: 'chunk_1',
            knowledgeType: 'memory',
            content: 'The user prefers concise examples.',
          },
        ],
        world: [
          {
            sourceId: 'source_2',
            chunkId: 'chunk_2',
            knowledgeType: 'world',
            content: 'Ships dock at tidefall.',
          },
        ],
        media: [
          {
            sourceId: 'source_3',
            chunkId: 'chunk_3',
            knowledgeType: 'media',
            content: 'Reference frame: lantern map sketch.',
          },
        ],
      },
    })

    const worldContextStart = prompt.indexOf('## World Context')
    const retrievedContextStart = prompt.indexOf('## Retrieved Context')
    const avatarTraitsStart = prompt.indexOf('## Avatar Traits')
    const worldContextSection = prompt.slice(worldContextStart, retrievedContextStart)
    const retrievedContextSection = prompt.slice(retrievedContextStart, avatarTraitsStart)

    expect(worldContextSection).toContain('The archive closes at moonrise.')
    expect(worldContextSection).not.toContain('Memory retrieval:')
    expect(retrievedContextSection).toContain('Memory retrieval:')
    expect(retrievedContextSection).toContain('- The user prefers concise examples.')
    expect(retrievedContextSection).toContain('World retrieval:')
    expect(retrievedContextSection).toContain('- Ships dock at tidefall.')
    expect(retrievedContextSection).toContain('Media retrieval:')
    expect(retrievedContextSection).toContain('- Reference frame: lantern map sketch.')
  })
})

describe('assemblePersonaPrompt -> optional sections and determinism', () => {
  it('omits empty optional sections while keeping response rules and avatar traits stable', () => {
    const prompt = assemblePersonaPrompt(makeAvatarConfig())

    expect(prompt).toContain('## Response Rules')
    expect(prompt).toContain('## Avatar Traits')
    expect(prompt).not.toContain('## Director Notes')
    expect(prompt).not.toContain('## Conversation State')
    expect(prompt).not.toContain('## User Persona')
    expect(prompt).not.toContain('## World Context')
    expect(prompt).not.toContain('## Retrieved Context')
  })

  it('preserves the default response style rules and adjustment ordering ahead of conversation state', () => {
    const prompt = assemblePersonaPrompt(
      makeAvatarConfig({
        adjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
        computedTraits: SAMPLE_TRAITS,
      }),
      {
        memory: {
          working: {
            session: {
              summary: 'Session summary',
              updatedAt: '2026-07-20T10:00:00.000Z',
            },
          },
        },
      },
    )

    const responseRulesIndex = prompt.indexOf('## Response Rules')
    const firstAdjustmentIndex = prompt.indexOf('Avoid markdown tables.')
    const secondAdjustmentIndex = prompt.indexOf('Use short paragraphs.')
    const styleRuleIndex = prompt.indexOf('Stay in character and keep responses concise.')
    const conversationStateIndex = prompt.indexOf('## Conversation State')

    expect(firstAdjustmentIndex).toBeGreaterThan(responseRulesIndex)
    expect(secondAdjustmentIndex).toBeGreaterThan(firstAdjustmentIndex)
    expect(styleRuleIndex).toBeGreaterThan(secondAdjustmentIndex)
    expect(conversationStateIndex).toBeGreaterThan(styleRuleIndex)
  })

  it('throws when personaPrompt is empty and traits are not available', () => {
    expect(() => assemblePersonaPrompt(makeAvatarConfig({ personaPrompt: '   ' }))).toThrow(
      'Avatar personaPrompt must be a non-empty string.',
    )
  })

  it('returns exactly the same output across repeated calls with the same input', () => {
    const config = makeAvatarConfig({
      adjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
      computedTraits: SAMPLE_TRAITS,
    })
    const options = {
      gmNotes: 'Stay practical.',
      worldContext: 'The archive closes at moonrise.',
      userPersona: { name: 'Maya' },
      memory: {
        shortTerm: {
          exchangeCount: 1,
          recentExchanges: [{ user: 'Hi', avatar: 'Hello there' }],
        },
      },
    }

    const first = assemblePersonaPrompt(config, options)
    const second = assemblePersonaPrompt(config, options)
    const third = assemblePersonaPrompt(config, options)

    expect(first).toBe(second)
    expect(second).toBe(third)
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

function expectTraitFieldOrder(prompt: string, fields: string[]): void {
  let previousIndex = prompt.indexOf('## Avatar Traits')
  for (const field of fields) {
    const currentIndex = prompt.indexOf(field)
    expect(currentIndex).toBeGreaterThan(previousIndex)
    previousIndex = currentIndex
  }
}
