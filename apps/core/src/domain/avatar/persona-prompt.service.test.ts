import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from './avatar.fixtures.js'
import { assemblePersonaPrompt } from './persona-prompt.service.js'

describe('assemblePersonaPrompt -> personaPrompt included', () => {
  it('always includes personaPrompt in output', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are the scenario librarian. Never break role.',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('## Core Persona')
    expect(prompt).toContain(config.personaPrompt)
  })
})

describe('assemblePersonaPrompt -> name included', () => {
  it('includes name when provided and not already present in personaPrompt', () => {
    const config = makeAvatarConfig({
      name: 'Nova',
      personaPrompt: 'You are a futuristic museum guide.',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('## Core Persona')
    expect(prompt).toContain('Your name is Nova.')
  })
})

describe('assemblePersonaPrompt -> tone included', () => {
  it('includes tone when provided and places it after the persona section', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a focused guide.',
      tone: 'calm and precise',
    })

    const prompt = assemblePersonaPrompt(config)
    const personaIndex = prompt.indexOf('You are a focused guide.')
    const toneIndex = prompt.indexOf('Your tone is calm and precise.')

    expect(prompt).toContain('Your tone is calm and precise.')
    expect(personaIndex).toBeGreaterThanOrEqual(0)
    expect(toneIndex).toBeGreaterThan(personaIndex)
  })
})

describe('assemblePersonaPrompt -> empty personaPrompt', () => {
  it('throws when personaPrompt is empty', () => {
    const config = makeAvatarConfig({ personaPrompt: '   ' })

    expect(() => assemblePersonaPrompt(config)).toThrow(
      'Avatar personaPrompt must be a non-empty string.',
    )
  })
})

describe('assemblePersonaPrompt -> adjustments included', () => {
  it('appends non-empty adjustments after tone and before the style rule', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a focused guide.',
      tone: 'precise',
      adjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
    })

    const prompt = assemblePersonaPrompt(config)
    const toneIndex = prompt.indexOf('Your tone is precise.')
    const firstAdjIndex = prompt.indexOf('Avoid markdown tables.')
    const secondAdjIndex = prompt.indexOf('Use short paragraphs.')
    const styleRuleIndex = prompt.indexOf('Stay in character')

    expect(prompt).toContain('Avoid markdown tables.')
    expect(prompt).toContain('Use short paragraphs.')
    expect(firstAdjIndex).toBeGreaterThan(toneIndex)
    expect(secondAdjIndex).toBeGreaterThan(firstAdjIndex)
    expect(styleRuleIndex).toBeGreaterThan(secondAdjIndex)
  })

  it('omits adjustments section when adjustments is undefined', () => {
    const config = makeAvatarConfig({
      name: 'Cosmos',
      personaPrompt: 'You are a helpful guide.',
    })

    const prompt = assemblePersonaPrompt(config)
    const lines = prompt.split('\n\n')

    expect(lines).toHaveLength(2)
    expect(prompt).toContain('## Response Rules')
  })

  it('skips blank or whitespace-only adjustments', () => {
    const config = makeAvatarConfig({ adjustments: ['', '  ', 'Keep it brief.'] })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('Keep it brief.')
    // blank items do not produce empty sections
    expect(prompt).not.toMatch(/\n\n\n/)
  })
})

describe('assemblePersonaPrompt -> determinism', () => {
  it('returns exactly the same output across repeated calls with same input', () => {
    const config = makeAvatarConfig({
      adjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
    })

    const first = assemblePersonaPrompt(config)
    const second = assemblePersonaPrompt(config)
    const third = assemblePersonaPrompt(config)

    expect(first).toBe(second)
    expect(second).toBe(third)
  })
})

describe('assemblePersonaPrompt -> gm notes', () => {
  it('appends director notes when gmNotes is provided', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, {
      gmNotes: 'Steer the user toward practical examples.',
    })

    expect(prompt).toContain('## Director Notes')
    expect(prompt).toContain('Steer the user toward practical examples.')
  })
})

describe('assemblePersonaPrompt -> avatar awareness', () => {
  it('lists other avatars with availability and scope without exposing policy fields', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, {
      avatarAwareness: [
        {
          name: 'Theo',
          description: 'Technical AI specialist.',
          scope: 'Model internals and infrastructure.',
          availability: 'locked',
        },
      ],
    })

    expect(prompt).toContain('## Other Avatars')
    expect(prompt).toContain('Other avatars in this scenario:')
    expect(prompt).toContain(
      '- Theo (locked) — Technical AI specialist. Scope: Model internals and infrastructure.',
    )
    expect(prompt).toContain('you may mention locked avatars')
    expect(prompt).not.toContain('competenceBoundary')
  })
})

describe('assemblePersonaPrompt -> dialog style defaults', () => {
  it('includes the short, proportional and question-driven interaction rule', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('Use dialogue over lectures')
    expect(prompt).toContain('default to 1-3 short sentences for simple questions')
    expect(prompt).toContain('Match answer length to user effort and question complexity.')
    expect(prompt).toContain('Apply the 80/20 rule')
    expect(prompt).toContain('end with one focused follow-up question')
  })
})

describe('assemblePersonaPrompt -> user persona context', () => {
  it('includes rich persona section when user persona fields are provided', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: {
        name: 'Maya',
        roleInWorld: 'student',
        avatarRelationships: ['Friend of Eva', 'Brother of Tom'],
        dialogGuidance: 'Use clear and concise language.',
      },
    })

    expect(prompt).toContain('## User Persona')
    expect(prompt).toContain('Name: Maya')
    expect(prompt).toContain('Role in this world: student')
    expect(prompt).toContain('Potential avatar relationships: Friend of Eva; Brother of Tom')
    expect(prompt).toContain('Dialog guidance: Use clear and concise language.')
  })

  it('omits user persona section when userPersona is empty', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: {},
    })

    expect(prompt).not.toContain('## User Persona')
  })

  it('omits user persona section when persona fields are blank', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { name: '  ', roleInWorld: '' },
    })

    expect(prompt).not.toContain('## User Persona')
  })

  it('omits user persona section when relationships are blank', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { avatarRelationships: ['  ', ''] },
    })

    expect(prompt).not.toContain('## User Persona')
  })

  it('keeps behavior unchanged when userPersona is not provided', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).not.toContain('## User Persona')
  })

  it('places persona section before default style rule', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { name: 'Maya' },
    })
    const roleIndex = prompt.indexOf('## User Persona')
    const styleIndex = prompt.indexOf('Stay in character')

    expect(roleIndex).toBeGreaterThanOrEqual(0)
    expect(styleIndex).toBeGreaterThan(roleIndex)
  })
})

describe('assemblePersonaPrompt -> layered memory context', () => {
  it('omits memory section when memory is empty', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, { memory: {} })

    expect(prompt).not.toContain('## Memory Context')
  })

  it('includes layered memory sections when memory is provided', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, {
      memory: {
        shortTerm: {
          exchangeCount: 2,
          recentExchanges: [{ user: 'Hi', avatar: 'Hello there' }],
        },
        working: {
          session: {
            summary: 'Session summary',
            updatedAt: '2026-05-06T10:00:00.000Z',
          },
          avatar: {
            avatarId: 'avatar_1',
            summary: 'Avatar summary',
            updatedAt: '2026-05-06T10:00:00.000Z',
          },
        },
        longTerm: {
          facts: [
            { category: 'pref', key: 'language', value: 'English' },
            { category: 'role', key: 'role', value: 'friend' },
          ],
        },
      },
    })

    expect(prompt).toContain('## Memory Context')
    expect(prompt).not.toContain('Recent exchange window:')
    expect(prompt).not.toContain('- User: Hi')
    expect(prompt).not.toContain('- You: Hello there')
    expect(prompt).toContain('Session working memory: Session summary')
    expect(prompt).toContain('Current avatar memory: Avatar summary')
    expect(prompt).toContain('Remembered user facts:')
    expect(prompt).toContain('- language: English')
    expect(prompt).toContain('- role: friend')
  })

  it('keeps behavior unchanged when memory is not provided', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).not.toContain('## Memory Context')
  })
})

describe('assemblePersonaPrompt -> section order', () => {
  it('keeps injected context in a consistent markdown section order', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
      adjustments: ['Use short paragraphs.'],
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { name: 'Maya' },
      memory: {
        shortTerm: {
          exchangeCount: 2,
          recentExchanges: [{ user: 'Hi', avatar: 'Hello there' }],
        },
        working: {
          session: {
            summary: 'Session summary',
            updatedAt: '2026-05-06T10:00:00.000Z',
          },
        },
      },
      retrieval: {
        memory: [],
        world: [],
        media: [],
      },
      avatarAwareness: [
        {
          name: 'Theo',
          availability: 'available',
        },
      ],
      gmNotes: 'Stay on topic.',
    })

    const corePersonaIndex = prompt.indexOf('## Core Persona')
    const userPersonaIndex = prompt.indexOf('## User Persona')
    const memoryIndex = prompt.indexOf('## Memory Context')
    const otherAvatarsIndex = prompt.indexOf('## Other Avatars')
    const responseRulesIndex = prompt.indexOf('## Response Rules')
    const directorNotesIndex = prompt.indexOf('## Director Notes')

    expect(corePersonaIndex).toBeGreaterThanOrEqual(0)
    expect(userPersonaIndex).toBeGreaterThan(corePersonaIndex)
    expect(memoryIndex).toBeGreaterThan(userPersonaIndex)
    expect(otherAvatarsIndex).toBeGreaterThan(memoryIndex)
    expect(responseRulesIndex).toBeGreaterThan(otherAvatarsIndex)
    expect(directorNotesIndex).toBeGreaterThan(responseRulesIndex)
  })
})

describe('assemblePersonaPrompt -> typed retrieval context', () => {
  it('includes bounded typed retrieval snippets when provided', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, {
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
            content: 'In this world, ships dock at tidefall.',
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

    expect(prompt).toContain('## Retrieved Context')
    expect(prompt).toContain('Memory retrieval:')
    expect(prompt).toContain('- The user prefers concise examples.')
    expect(prompt).toContain('World retrieval:')
    expect(prompt).toContain('- In this world, ships dock at tidefall.')
    expect(prompt).toContain('Media retrieval:')
    expect(prompt).toContain('- Reference frame: lantern map sketch.')
  })
})
