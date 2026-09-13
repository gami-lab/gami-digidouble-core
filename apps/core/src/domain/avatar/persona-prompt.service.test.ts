import type { AvatarComputedTraits, KnowledgeType } from '@gami/shared'
import { describe, expect, it } from 'vitest'
import type { AvatarContextSections } from '../context/session-context.types.js'
import { makeAvatarConfig } from './avatar.fixtures.js'
import { assemblePersonaPrompt } from './persona-prompt.service.js'

const SAMPLE_TRAITS: AvatarComputedTraits = {
  identity: ['Archivist of the north wing'],
  personality: ['Measured under pressure'],
  speakingStyle: ['Short and literal'],
  background: ['Former restorer of fragile maps'],
  timeline: ['Joined after the renovation'],
  currentSituation: ['Guiding late arrivals through the archive'],
  behaviouralRules: ['Never reveal sealed exhibits'],
}

function sections(overrides: Partial<AvatarContextSections> = {}): AvatarContextSections {
  return {
    directorNotes: null,
    responseRules: { items: ['Use short paragraphs.'] },
    conversationState: {
      recentExchanges: [],
      workingMemory: {},
      episodicMemories: [],
      longTermFacts: [],
    },
    userPersona: null,
    worldContext: {
      scenarioId: 'scenario-1',
      language: 'fr-FR',
      name: 'The archive',
      description: 'The archive closes at moonrise.',
    },
    avatarTraits: SAMPLE_TRAITS,
    ...overrides,
  }
}

function retrievalItem(knowledgeType: KnowledgeType, chunkId: string, content: string) {
  return { sourceId: `${knowledgeType}_${chunkId}`, chunkId, knowledgeType, content }
}

describe('assemblePersonaPrompt', () => {
  it('requires structured context sections', () => {
    expect(() => assemblePersonaPrompt(makeAvatarConfig())).toThrow(
      'Avatar prompt assembly requires structured context sections.',
    )
  })

  it('renders the canonical section order and Scenario language', () => {
    const prompt = assemblePersonaPrompt(makeAvatarConfig(), {
      sections: sections({
        directorNotes: 'Steer the user toward practical examples.',
        userPersona: { name: 'Maya', roleInWorld: 'student' },
        conversationState: {
          recentExchanges: [{ user: 'Hi', avatar: 'Hello there' }],
          workingMemory: {},
          episodicMemories: [],
          longTermFacts: [],
        },
        retrievedContext: {
          retrievedItems: [],
          typedSections: {
            avatar_knowledge: [
              retrievalItem('avatar_knowledge', 'chunk-1', 'The user prefers concise examples.'),
            ],
            world: [retrievalItem('world', 'chunk-2', 'Ships dock at tidefall.')],
            media: [retrievalItem('media', 'chunk-3', 'Reference frame: a lantern map.')],
          },
        },
      }),
    })

    const sectionNames = [
      '## Director Notes',
      '## Response Rules',
      '## Conversation State',
      '## User Persona',
      '## World Context',
      '## Retrieved Context',
      '## Avatar Traits',
    ]
    let previous = -1
    for (const sectionName of sectionNames) {
      const current = prompt.indexOf(sectionName)
      expect(current).toBeGreaterThan(previous)
      previous = current
    }
    expect(prompt).toContain(
      'Respond entirely in fr-FR. Do not switch languages unless the Scenario language changes.',
    )
    expect(prompt).toContain('Context 1 (avatar_knowledge):')
    expect(prompt).toContain('Media context 1 (media):')
    expect(prompt).toContain('- Archivist of the north wing')
  })

  it('rejects structured context without prepared traits', () => {
    const incompleteSections = sections()
    delete incompleteSections.avatarTraits
    expect(() =>
      assemblePersonaPrompt(makeAvatarConfig(), {
        sections: incompleteSections,
      }),
    ).toThrow('Avatar prompt assembly requires prepared computedTraits.')
  })

  it('keeps current dialogue guidance and layered memory projections', () => {
    const prompt = assemblePersonaPrompt(makeAvatarConfig(), {
      sections: sections({
        conversationState: {
          recentExchanges: [{ user: 'Where do I start?', avatar: 'At the north wing.' }],
          workingMemory: {
            session: { summary: 'The user is planning a quick visit.', updatedAt: 'now' },
          },
          episodicMemories: [],
          longTermFacts: [{ category: 'preference', key: 'pace', value: 'quick overview' }],
        },
      }),
      gmGuidance: {
        mode: 'repair',
        askFollowUp: false,
        directorNotes: 'Resolve the contradiction before progressing.',
      },
    })

    expect(prompt).toContain('Resolve the contradiction before progressing.')
    expect(prompt).toContain('1. User: Where do I start?')
    expect(prompt).toContain('- Session: The user is planning a quick visit.')
    expect(prompt).toContain('- pace: quick overview')
    expect(prompt).not.toContain('Legacy persona')
  })
})
