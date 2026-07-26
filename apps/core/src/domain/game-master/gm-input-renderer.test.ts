import { describe, expect, it } from 'vitest'
import type { GameMasterInput } from './game-master.types.js'
import { renderGameMasterInputForLlm } from './gm-input-renderer.js'

/* eslint-disable max-lines-per-function */
function makeInput(overrides: Partial<GameMasterInput> = {}): GameMasterInput {
  const input: GameMasterInput = {
    session: {
      sessionId: 'session_1',
      turnIndex: 2,
      activeAvatarId: 'avatar_1',
      ...overrides.session,
    },
    userMessage: {
      text: 'How should we approach the harbor?',
      ...overrides.userMessage,
    },
    state: {
      progression: 'investigation',
      topicsCovered: ['harbor'],
      interactionCount: 3,
      ...overrides.state,
    },
    context: {
      experience: {
        scenarioId: 'scenario_1',
        description: 'Storm tide rises at dusk.',
        goals: ['Understand the harbor timeline.', 'Decide whether to switch specialists.'],
        ...overrides.context?.experience,
      },
      memory: {
        workingMemory: {
          summary: 'The witness already contradicted the tide schedule.',
          unresolvedThreads: ['Confirm the dock number.'],
          coveredTopics: ['witness_timeline'],
        },
        episodicMemories: [
          {
            memoryId: 'memory_1',
            conversationId: 'conversation_7',
            summary: 'A prior harbor inspection raised the same contradiction.',
            keyDiscoveries: ['The tide log was altered.'],
            unresolvedTopics: ['Who changed the tide log?'],
            createdAt: '2026-07-19T12:00:00.000Z',
            selectionReasons: ['continuity'],
            score: 0.92,
          },
        ],
        longTermFacts: [{ category: 'preference', key: 'tone', value: 'concise' }],
        ...overrides.context?.memory,
      },
      rag: {
        memory: [
          {
            sourceId: 'memory_source_1',
            excerpt: 'The witness already contradicted the tide schedule.',
          },
        ],
        world: [{ sourceId: 'world_source_1', excerpt: 'Storm tide rises at dusk.' }],
        media: [{ sourceId: 'media_source_1', excerpt: 'Harbor map with dock markers.' }],
        ...overrides.context?.rag,
      },
      userPersona: {
        name: 'Lina',
        roleInWorld: 'investigator',
        avatarRelationships: ['Trusts Ava'],
        dialogGuidance: 'Prefer evidence-first reasoning.',
        ...overrides.context?.userPersona,
      },
      availableAvatars: [
        {
          avatarId: 'avatar_1',
          name: 'Ava',
          description: 'Harbor witness.',
          scope: 'Dock activity and local rumors.',
          availability: 'available',
        },
        {
          avatarId: 'avatar_2',
          name: 'Theo',
          availability: 'locked',
        },
      ],
      ...overrides.context,
    },
  }

  if (Object.hasOwn(overrides, 'recentMessages')) {
    if (overrides.recentMessages !== undefined) {
      input.recentMessages = overrides.recentMessages
    }
  } else {
    input.recentMessages = [
      { role: 'user', content: 'What happened at the harbor?' },
      { role: 'avatar', content: 'The docks were crowded at dusk.' },
    ]
  }

  return input
}

describe('renderGameMasterInputForLlm', () => {
  it('renders structured sections in deterministic order with separated discussion and experience context', () => {
    const prompt = renderGameMasterInputForLlm(makeInput())

    expectSectionOrder(prompt, [
      '## Current Turn',
      '## Current Discussion Context',
      '## Experience Context',
      '## Output Reminder',
    ])
    expect(prompt).toContain('- Latest User Message: How should we approach the harbor?')
    expect(prompt).toContain('- Latest Avatar Reply: The docks were crowded at dusk.')
    expect(prompt).toContain('- Current Avatar ID: avatar_1')
    expect(prompt).toContain('### Recent Exchanges')
    expect(prompt).toContain('1. User: What happened at the harbor?')
    expect(prompt).toContain('### Current GM State')
    expect(prompt).toContain('- Progression: investigation')
    expect(prompt).toContain('### Working Memory')
    expect(prompt).toContain('- Covered Topics: witness_timeline')
    expect(prompt).toContain('### Episodic Memories')
    expect(prompt).toContain('### Long-Term Facts')
    expect(prompt).toContain('### User Persona')
    expect(prompt).toContain('### Scenario')
    expect(prompt).toContain('- Goal 1: Understand the harbor timeline.')
    expect(prompt).toContain('### Available Avatars')
    expect(prompt).toContain(
      '- Ava (avatar_1) [available]; description: Harbor witness.; scope: Dock activity and local rumors.',
    )
    expect(prompt).toContain('- Theo (avatar_2) [locked]')
    expect(prompt).toContain('### Retrieved Context')
    expect(prompt).toContain('Memory excerpts:')
    expect(prompt).toContain('World excerpts:')
    expect(prompt).toContain('Media excerpts:')
  })

  it('omits empty optional blocks and preserves the session-start edge case', () => {
    const prompt = renderGameMasterInputForLlm({
      session: {
        sessionId: 'session_1',
        turnIndex: 0,
        activeAvatarId: 'avatar_1',
      },
      userMessage: {
        text: '',
      },
      state: {
        progression: '',
        topicsCovered: [],
        interactionCount: 0,
      },
      context: {
        experience: {
          scenarioId: 'scenario_1',
        },
        availableAvatars: [],
      },
    })

    expect(prompt).toContain(
      '- Latest User Message: [none - session start; provide opening guidance for the Avatar].',
    )
    expect(prompt).not.toContain('- Latest Avatar Reply:')
    expect(prompt).not.toContain('### Recent Exchanges')
    expect(prompt).not.toContain('### Working Memory')
    expect(prompt).not.toContain('### Episodic Memories')
    expect(prompt).not.toContain('### Long-Term Facts')
    expect(prompt).not.toContain('### User Persona')
    expect(prompt).not.toContain('### Retrieved Context')
    expect(prompt).not.toContain('- Current Avatar ID:')
    expect(prompt).toContain('- Progression: none')
    expect(prompt).not.toContain('- Topics Covered:')
    expect(prompt).toContain('### Available Avatars')
    expect(prompt).toContain('- None provided.')
  })

  it('renders the single Avatar explicitly so the GM knows the scenario cardinality', () => {
    const prompt = renderGameMasterInputForLlm(
      makeInput({
        context: {
          experience: { scenarioId: 'scenario_1' },
          availableAvatars: [{ avatarId: 'avatar_1', name: 'Ava', availability: 'available' }],
        },
      }),
    )

    expect(prompt).toContain('### Available Avatars')
    expect(prompt).toContain('Ava (avatar_1) [available]')
    expect(prompt).not.toContain('- Current Avatar ID:')
  })

  it('does not include locked metadata when every Avatar is unlocked', () => {
    const prompt = renderGameMasterInputForLlm(
      makeInput({
        context: {
          experience: { scenarioId: 'scenario_1' },
          availableAvatars: [
            { avatarId: 'avatar_1', name: 'Ava', availability: 'available' },
            { avatarId: 'avatar_2', name: 'Theo', availability: 'available' },
          ],
        },
      }),
    )

    expect(prompt).toContain('### Available Avatars')
    expect(prompt).toContain('Ava (avatar_1) [available]')
    expect(prompt).not.toContain('[locked]')
  })

  it('makes the single-Avatar prompt materially smaller than a routed prompt', () => {
    const singlePrompt = renderGameMasterInputForLlm(
      makeInput({
        context: {
          experience: { scenarioId: 'scenario_1' },
          availableAvatars: [{ avatarId: 'avatar_1', name: 'Ava', availability: 'available' }],
        },
      }),
    )
    const routedPrompt = renderGameMasterInputForLlm(makeInput())

    expect(singlePrompt.length).toBeLessThan(routedPrompt.length * 0.95)
  })
})

describe('renderGameMasterInputForLlm — current turn deduplication', () => {
  it('does not repeat the current turn inside Recent Exchanges', () => {
    const prompt = renderGameMasterInputForLlm(
      makeInput({
        userMessage: { text: 'Ready to talk about what happened?' },
        recentMessages: [
          { role: 'user', content: 'Hi Max, how are you?' },
          { role: 'avatar', content: 'Holding up, still shaken.' },
          { role: 'user', content: 'Ready to talk about what happened?' },
          { role: 'avatar', content: 'I am ready, ask away.' },
        ],
      }),
    )

    expect(prompt).toContain('- Latest User Message: Ready to talk about what happened?')
    expect(prompt).toContain('- Latest Avatar Reply: I am ready, ask away.')
    expect(prompt).toContain('1. User: Hi Max, how are you?')
    expect(prompt).toContain('2. Avatar: Holding up, still shaken.')
    expect(prompt).not.toContain('3. User: Ready to talk about what happened?')
    expect(prompt).not.toContain('4. Avatar: I am ready, ask away.')
  })

  it('keeps a non-matching prior user exchange when the current turn text differs', () => {
    const prompt = renderGameMasterInputForLlm(
      makeInput({
        userMessage: { text: 'A brand new question not yet persisted.' },
        recentMessages: [
          { role: 'user', content: 'Earlier question.' },
          { role: 'avatar', content: 'Earlier reply.' },
        ],
      }),
    )

    expect(prompt).toContain('- Latest User Message: A brand new question not yet persisted.')
    expect(prompt).toContain('- Latest Avatar Reply: Earlier reply.')
    expect(prompt).toContain('1. User: Earlier question.')
    expect(prompt).not.toContain('2. Avatar: Earlier reply.')
  })
})

function expectSectionOrder(prompt: string, sections: string[]): void {
  let previousIndex = -1

  for (const section of sections) {
    const index = prompt.indexOf(section)
    expect(index).toBeGreaterThan(previousIndex)
    previousIndex = index
  }
}
