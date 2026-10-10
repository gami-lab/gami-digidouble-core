import { describe, expect, it } from 'vitest'
import type { GameMasterInput } from './game-master.types.js'
import { renderGameMasterInputForLlm } from './gm-input-renderer.js'

type InputOverrides = {
  session?: Partial<GameMasterInput['session']>
  userMessage?: Partial<GameMasterInput['userMessage']>
  state?: Partial<GameMasterInput['state']>
  context?: {
    experience?: Partial<GameMasterInput['context']['experience']>
    conversationState?: Partial<GameMasterInput['context']['conversationState']>
    retrievedContext?: Partial<NonNullable<GameMasterInput['context']['retrievedContext']>>
    userPersona?: GameMasterInput['context']['userPersona']
    availableAvatars?: GameMasterInput['context']['availableAvatars']
  }
}

/* eslint-disable max-lines-per-function -- retained fixture or orchestration setup is clearer together */
// eslint-disable-next-line complexity -- retained non-linear boundary mapping is clearer together
function makeInput(overrides: InputOverrides = {}): GameMasterInput {
  const recentMessages = [
    { role: 'user' as const, content: 'What happened at the harbor?' },
    { role: 'avatar' as const, content: 'The docks were crowded at dusk.' },
  ]
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
      conversationState: {
        recentMessages,
        recentExchanges: [
          { user: 'What happened at the harbor?', avatar: 'The docks were crowded at dusk.' },
        ],
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
        ...overrides.context?.conversationState,
      },
      retrievedContext: {
        avatar_knowledge: [
          {
            sourceId: 'memory_source_1',
            chunkId: 'memory_chunk_1',
            knowledgeType: 'avatar_knowledge',
            content: 'The witness already contradicted the tide schedule.',
          },
        ],
        world: [
          {
            sourceId: 'world_source_1',
            chunkId: 'world_chunk_1',
            knowledgeType: 'world',
            content: 'Storm tide rises at dusk.',
          },
        ],
        media: [
          {
            sourceId: 'media_source_1',
            chunkId: 'media_chunk_1',
            knowledgeType: 'media',
            content: 'Harbor map with dock markers.',
          },
        ],
        ...overrides.context?.retrievedContext,
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
      ...(overrides.context?.userPersona !== undefined
        ? { userPersona: overrides.context.userPersona }
        : {}),
      ...(overrides.context?.availableAvatars !== undefined
        ? { availableAvatars: overrides.context.availableAvatars }
        : {}),
    },
  }

  if (overrides.context?.conversationState?.recentMessages !== undefined) {
    input.context.conversationState.recentMessages =
      overrides.context.conversationState.recentMessages
  }

  return input
}

describe('renderGameMasterInputForLlm', () => {
  it('renders structured sections in deterministic order with separated discussion and experience context', () => {
    const prompt = renderGameMasterInputForLlm(makeInput())

    expectSectionOrder(prompt, [
      '## Participants',
      '## Current Turn',
      '## Conversation State',
      '## Experience Context',
      '## Retrieved Context',
      '## Output Reminder',
    ])
    expect(prompt).toContain(
      '- Active Avatar: Ava (avatar_1). The AI character whose next reply you guide.',
    )
    expect(prompt).toContain('- User: the real human talking with the Avatar.')
    expect(prompt).toContain('- Latest User Message (Lina): How should we approach the harbor?')
    expect(prompt).toContain('- Latest Avatar Reply (Ava): The docks were crowded at dusk.')
    expect(prompt).toContain('### Recent Exchanges')
    expect(prompt).toContain('1. User: What happened at the harbor?')
    expect(prompt).toContain('### Current GM State')
    expect(prompt).toContain('- Progression: investigation')
    expect(prompt).toContain('### Working Memory')
    expect(prompt).toContain('- Covered Topics: witness_timeline')
    expect(prompt).toContain('### Episodic Memories')
    expect(prompt).toContain(
      "### User Persona (the user's in-world character, already known to the Avatar)",
    )
    expect(prompt.indexOf('### User Persona')).toBeLessThan(prompt.indexOf('## Current Turn'))
    expect(prompt).toContain('### Scenario')
    expect(prompt).toContain('- Goal 1: Understand the harbor timeline.')
    expect(prompt).toContain('### Available Avatars')
    expect(prompt).toContain(
      '- Ava (avatar_1) [available]; description: Harbor witness.; scope: Dock activity and local rumors.',
    )
    expect(prompt).toContain('- Theo (avatar_2) [locked]')
    expect(prompt).toContain('## Retrieved Context')
    expect(prompt).toContain(
      'Avatar knowledge (addressed to the active Avatar; "tu"/"you" means Ava) excerpts:',
    )
    expect(prompt).toContain('World excerpts:')
    expect(prompt).toContain('Media excerpts:')

    const conversationStateStart = prompt.indexOf('## Conversation State')
    const retrievedContextStart = prompt.indexOf('## Retrieved Context')
    const conversationStateSection = prompt.slice(conversationStateStart, retrievedContextStart)
    expect(conversationStateSection).not.toContain('Harbor map with dock markers.')
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
        interactionCount: 0,
      },
      context: {
        experience: {
          scenarioId: 'scenario_1',
        },
        conversationState: {
          recentMessages: [],
          recentExchanges: [],
          episodicMemories: [],
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
    expect(prompt).not.toContain('### User Persona')
    expect(prompt).not.toContain('### Retrieved Context')
    expect(prompt).toContain(
      '- Active Avatar: avatar_1. The AI character whose next reply you guide.',
    )
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
          conversationState: {
            recentMessages: [],
            recentExchanges: [],
            episodicMemories: [],
          },
          availableAvatars: [{ avatarId: 'avatar_1', name: 'Ava', availability: 'available' }],
        },
      }),
    )

    expect(prompt).toContain('### Available Avatars')
    expect(prompt).toContain('Ava (avatar_1) [available]')
    expect(prompt).toContain('- Active Avatar: Ava (avatar_1).')
  })

  it('does not include locked metadata when every Avatar is unlocked', () => {
    const prompt = renderGameMasterInputForLlm(
      makeInput({
        context: {
          experience: { scenarioId: 'scenario_1' },
          conversationState: {
            recentMessages: [],
            recentExchanges: [],
            episodicMemories: [],
          },
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

    expect(singlePrompt.length).toBeLessThan(routedPrompt.length * 0.97)
  })
})

describe('renderGameMasterInputForLlm — current turn deduplication', () => {
  it('does not repeat the current turn inside Recent Exchanges', () => {
    const prompt = renderGameMasterInputForLlm(
      makeInput({
        userMessage: { text: 'Ready to talk about what happened?' },
        context: {
          conversationState: {
            recentMessages: [
              { role: 'user', content: 'Hi Max, how are you?' },
              { role: 'avatar', content: 'Holding up, still shaken.' },
              { role: 'user', content: 'Ready to talk about what happened?' },
              { role: 'avatar', content: 'I am ready, ask away.' },
            ],
          },
        },
      }),
    )

    expect(prompt).toContain('- Latest User Message (Lina): Ready to talk about what happened?')
    expect(prompt).toContain('- Latest Avatar Reply (Ava): I am ready, ask away.')
    expect(prompt).toContain('1. User: Hi Max, how are you?')
    expect(prompt).toContain('2. Avatar: Holding up, still shaken.')
    expect(prompt).not.toContain('3. User: Ready to talk about what happened?')
    expect(prompt).not.toContain('4. Avatar: I am ready, ask away.')
  })

  it('keeps a non-matching prior user exchange when the current turn text differs', () => {
    const prompt = renderGameMasterInputForLlm(
      makeInput({
        userMessage: { text: 'A brand new question not yet persisted.' },
        context: {
          conversationState: {
            recentMessages: [
              { role: 'user', content: 'Earlier question.' },
              { role: 'avatar', content: 'Earlier reply.' },
            ],
          },
        },
      }),
    )

    expect(prompt).toContain(
      '- Latest User Message (Lina): A brand new question not yet persisted.',
    )
    expect(prompt).toContain('- Latest Avatar Reply (Ava): Earlier reply.')
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
