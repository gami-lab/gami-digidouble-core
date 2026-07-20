import type { GameMasterInput } from './game-master.types.js'

export const GAME_MASTER_INPUT_RENDERER_VERSION = 'gm-input-renderer.v2'

/**
 * Internal LLM rendering for the Game Master input contract.
 *
 * Ownership:
 * - Runtime input fields remain owned by GameMasterInput.
 * - This renderer only controls how that canonical contract is serialized for
 *   the prompt and must not introduce prompt-only fields.
 */
export function renderGameMasterInputForLlm(input: GameMasterInput): string {
  return [
    renderSection('Current Turn', renderCurrentTurn(input)),
    renderSection('Current Discussion Context', [
      ...renderRecentMessages(input.recentMessages),
      ...renderGameMasterState(input.state),
      ...renderMemoryContext(input.context.memory),
      ...renderUserPersona(input.context.userPersona),
    ]),
    renderSection('Experience Context', [
      ...renderExperience(input.context.experience),
      ...renderAvailableAvatars(input.context.availableAvatars),
      ...renderRetrievedContext(input.context.rag),
    ]),
    renderSection('Output Reminder', [
      '- Return only the JSON object required by the system prompt.',
      '- Base decisions on the labeled context above and do not repeat it back as prose.',
    ]),
  ].join('\n\n')
}

function renderCurrentTurn(input: GameMasterInput): string[] {
  const lines = [
    `- Session ID: ${normalizeInlineText(input.session.sessionId)}`,
    `- Turn Index: ${formatNumber(input.session.turnIndex)}`,
    hasText(input.userMessage.text)
      ? `- Latest User Message: ${normalizeInlineText(input.userMessage.text)}`
      : '- Latest User Message: [none - session start; provide opening guidance for the Avatar].',
  ]

  const latestAvatarReply = findLatestMessageByRole(input.recentMessages, 'avatar')
  if (latestAvatarReply !== undefined) {
    lines.push(`- Latest Avatar Reply: ${normalizeInlineText(latestAvatarReply.content)}`)
  }

  return lines
}

function renderSection(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines].join('\n')
}

function renderRecentMessages(recentMessages: GameMasterInput['recentMessages']): string[] {
  if (recentMessages === undefined || recentMessages.length === 0) {
    return []
  }

  return [
    '### Recent Exchanges',
    ...recentMessages.map(
      (message, index) =>
        `${formatNumber(index + 1)}. ${formatMessageRole(message.role)}: ${normalizeInlineText(message.content)}`,
    ),
  ]
}

function renderGameMasterState(state: GameMasterInput['state']): string[] {
  return [
    '### Current GM State',
    `- Current Avatar ID: ${
      hasText(state.currentAvatarId) ? normalizeInlineText(state.currentAvatarId) : 'none'
    }`,
    `- Progression: ${hasText(state.progression) ? normalizeInlineText(state.progression) : 'none'}`,
    `- Topics Covered: ${formatInlineList(state.topicsCovered)}`,
    `- Interaction Count: ${formatNumber(state.interactionCount)}`,
  ]
}

function renderMemoryContext(memory: GameMasterInput['context']['memory']): string[] {
  if (memory === undefined) {
    return []
  }

  return [
    ...renderWorkingMemory(memory.workingMemory),
    ...renderEpisodicMemories(memory.episodicMemories),
    ...renderLongTermFacts(memory.longTermFacts),
  ]
}

function renderWorkingMemory(
  workingMemory: NonNullable<GameMasterInput['context']['memory']>['workingMemory'],
): string[] {
  if (workingMemory === undefined) {
    return []
  }

  return [
    '### Working Memory',
    `- Summary: ${normalizeInlineText(workingMemory.summary)}`,
    `- Unresolved Threads: ${formatInlineList(workingMemory.unresolvedThreads)}`,
  ]
}

function renderEpisodicMemories(
  episodicMemories: NonNullable<GameMasterInput['context']['memory']>['episodicMemories'],
): string[] {
  if (episodicMemories === undefined || episodicMemories.length === 0) {
    return []
  }

  return [
    '### Episodic Memories',
    ...episodicMemories.flatMap((memory, index) => [
      `${formatNumber(index + 1)}. Memory ID: ${normalizeInlineText(memory.memoryId)} | Conversation ID: ${normalizeInlineText(memory.conversationId)} | Score: ${formatNumber(memory.score)} | Created At: ${normalizeInlineText(memory.createdAt)}`,
      `   Summary: ${normalizeInlineText(memory.summary)}`,
      `   Key Discoveries: ${formatInlineList(memory.keyDiscoveries)}`,
      `   Unresolved Topics: ${formatInlineList(memory.unresolvedTopics)}`,
      `   Selection Reasons: ${formatInlineList(memory.selectionReasons)}`,
    ]),
  ]
}

function renderLongTermFacts(
  longTermFacts: NonNullable<GameMasterInput['context']['memory']>['longTermFacts'],
): string[] {
  if (longTermFacts === undefined || longTermFacts.length === 0) {
    return []
  }

  return [
    '### Long-Term Facts',
    ...longTermFacts.map(
      (fact) =>
        `- ${normalizeInlineText(fact.category)} / ${normalizeInlineText(fact.key)}: ${normalizeInlineText(fact.value)}`,
    ),
  ]
}

function renderUserPersona(userPersona: GameMasterInput['context']['userPersona']): string[] {
  if (userPersona === undefined) {
    return []
  }

  const lines = [
    hasText(userPersona.name) ? `- Name: ${normalizeInlineText(userPersona.name)}` : undefined,
    hasText(userPersona.roleInWorld)
      ? `- Role In World: ${normalizeInlineText(userPersona.roleInWorld)}`
      : undefined,
    Array.isArray(userPersona.avatarRelationships) && userPersona.avatarRelationships.length > 0
      ? `- Avatar Relationships: ${formatInlineList(userPersona.avatarRelationships)}`
      : undefined,
    hasText(userPersona.dialogGuidance)
      ? `- Dialog Guidance: ${normalizeInlineText(userPersona.dialogGuidance)}`
      : undefined,
  ].filter((line): line is string => line !== undefined)

  return lines.length > 0 ? ['### User Persona', ...lines] : []
}

function renderExperience(experience: GameMasterInput['context']['experience']): string[] {
  return [
    '### Scenario',
    `- Scenario ID: ${normalizeInlineText(experience.scenarioId)}`,
    ...(hasText(experience.description)
      ? [`- Description: ${normalizeInlineText(experience.description)}`]
      : []),
    ...(Array.isArray(experience.goals) && experience.goals.length > 0
      ? experience.goals.map(
          (goal, index) => `- Goal ${formatNumber(index + 1)}: ${normalizeInlineText(goal)}`,
        )
      : []),
  ]
}

function renderAvailableAvatars(avatars: GameMasterInput['context']['availableAvatars']): string[] {
  return [
    '### Available Avatars',
    ...(avatars.length > 0
      ? avatars.map((avatar) => {
          const details = [
            hasText(avatar.description)
              ? `description: ${normalizeInlineText(avatar.description)}`
              : undefined,
            hasText(avatar.scope) ? `scope: ${normalizeInlineText(avatar.scope)}` : undefined,
          ].filter((detail): detail is string => detail !== undefined)

          const label = `- ${normalizeInlineText(avatar.name)} (${normalizeInlineText(avatar.avatarId)})${
            avatar.availability !== undefined ? ` [${avatar.availability}]` : ''
          }`

          return details.length > 0 ? `${label}; ${details.join('; ')}` : label
        })
      : ['- None provided.']),
  ]
}

function renderRetrievedContext(rag: GameMasterInput['context']['rag']): string[] {
  if (rag === undefined) {
    return []
  }

  const memoryLines = renderRetrievedCategory('Memory', rag.memory)
  const worldLines = renderRetrievedCategory('World', rag.world)
  const mediaLines = renderRetrievedCategory('Media', rag.media)

  const lines = [...memoryLines, ...worldLines, ...mediaLines]
  return lines.length > 0 ? ['### Retrieved Context', ...lines] : []
}

function renderRetrievedCategory(
  title: string,
  entries: Array<{ sourceId: string; excerpt: string }> | undefined,
): string[] {
  if (entries === undefined || entries.length === 0) {
    return []
  }

  return [
    `${title} excerpts:`,
    ...entries.map(
      (entry, index) =>
        `${formatNumber(index + 1)}. [${normalizeInlineText(entry.sourceId)}] ${normalizeInlineText(entry.excerpt)}`,
    ),
  ]
}

function findLatestMessageByRole(
  recentMessages: GameMasterInput['recentMessages'],
  role: 'user' | 'avatar' | 'system',
): { role: 'user' | 'avatar' | 'system'; content: string } | undefined {
  if (recentMessages === undefined) {
    return undefined
  }

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index]
    if (message?.role === role) {
      return message
    }
  }

  return undefined
}

function formatMessageRole(role: 'user' | 'avatar' | 'system'): string {
  switch (role) {
    case 'user':
      return 'User'
    case 'avatar':
      return 'Avatar'
    case 'system':
      return 'System'
  }
}

function formatInlineList(values: string[]): string {
  return values.length > 0 ? values.map(normalizeInlineText).join(', ') : 'none'
}

function formatNumber(value: number): string {
  return value.toString()
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeInlineText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}
