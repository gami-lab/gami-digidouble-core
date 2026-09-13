import type { GameMasterInput } from './game-master.types.js'

export const GAME_MASTER_INPUT_RENDERER_VERSION = 'gm-input-renderer.v4'

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
    renderSection('Conversation State', [
      ...renderRecentMessages(
        excludeCurrentTurnFromRecentMessages(
          input.context.conversationState.recentMessages,
          input.userMessage.text,
        ),
      ),
      ...renderGameMasterState(input),
      ...renderConversationState(input.context.conversationState),
      ...renderUserPersona(input.context.userPersona),
    ]),
    renderSection('Experience Context', [
      ...renderExperience(input.context.experience),
      ...renderAvailableAvatars(input.context.availableAvatars),
    ]),
    renderSection('Retrieved Context', renderRetrievedContext(input.context.retrievedContext)),
    renderSection('Output Reminder', [
      '- Return only the JSON object required by the system prompt.',
      '- Base decisions on the labeled context above and do not repeat it back as prose.',
    ]),
  ].join('\n\n')
}

function renderCurrentTurn(input: GameMasterInput): string[] {
  const lines = [
    `- Turn Index: ${formatNumber(input.session.turnIndex)}`,
    hasText(input.userMessage.text)
      ? `- Latest User Message: ${normalizeInlineText(input.userMessage.text)}`
      : '- Latest User Message: [none - session start; provide opening guidance for the Avatar].',
  ]

  const latestAvatarReply = findLatestMessageByRole(
    input.context.conversationState.recentMessages,
    'avatar',
  )
  if (latestAvatarReply !== undefined) {
    lines.push(`- Latest Avatar Reply: ${normalizeInlineText(latestAvatarReply.content)}`)
  }

  return lines
}

/**
 * `recentMessages` is fetched fresh from the conversation history and, on the
 * normal post-turn path, already ends with the same user/avatar pair shown
 * under "Current Turn". Trim that duplicated tail so it isn't repeated in
 * "Recent Exchanges".
 */
function excludeCurrentTurnFromRecentMessages(
  recentMessages: GameMasterInput['context']['conversationState']['recentMessages'],
  userMessageText: string,
): GameMasterInput['context']['conversationState']['recentMessages'] {
  if (recentMessages.length === 0) {
    return recentMessages
  }

  let end = recentMessages.length
  if (recentMessages[end - 1]?.role === 'avatar') {
    end -= 1
  }

  const priorMessage = end > 0 ? recentMessages[end - 1] : undefined
  if (
    priorMessage?.role === 'user' &&
    hasText(userMessageText) &&
    normalizeInlineText(priorMessage.content) === normalizeInlineText(userMessageText)
  ) {
    end -= 1
  }

  return recentMessages.slice(0, end)
}

function renderSection(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines].join('\n')
}

function renderRecentMessages(
  recentMessages: GameMasterInput['context']['conversationState']['recentMessages'],
): string[] {
  if (recentMessages.length === 0) {
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

/**
 * Covered-topic tracking lives in Working Memory (memory compaction owns it) —
 * GM state no longer reports its own topic list here.
 */
function renderGameMasterState(input: GameMasterInput): string[] {
  return [
    '### Current GM State',
    ...(input.context.availableAvatars.length > 1
      ? [`- Current Avatar ID: ${normalizeInlineText(input.session.activeAvatarId)}`]
      : []),
    `- Progression: ${hasText(input.state.progression) ? normalizeInlineText(input.state.progression) : 'none'}`,
    `- Interaction Count: ${formatNumber(input.state.interactionCount)}`,
  ]
}

function renderConversationState(
  conversationState: GameMasterInput['context']['conversationState'],
): string[] {
  return [
    ...renderShortTermExchanges(conversationState.recentExchanges),
    ...renderWorkingMemory(conversationState.workingMemory),
    ...renderEpisodicMemories(conversationState.episodicMemories),
    ...renderLongTermFacts(conversationState.longTermFacts),
  ]
}

function renderShortTermExchanges(
  exchanges: GameMasterInput['context']['conversationState']['recentExchanges'],
): string[] {
  if (exchanges.length === 0) return []
  return [
    '### Recent Exchanges',
    ...exchanges.flatMap((exchange, index) => [
      `${formatNumber(index + 1)}. User: ${normalizeInlineText(exchange.user)}`,
      `   Avatar: ${normalizeInlineText(exchange.avatar)}`,
    ]),
  ]
}

function renderWorkingMemory(
  workingMemory: GameMasterInput['context']['conversationState']['workingMemory'],
): string[] {
  if (workingMemory === undefined) {
    return []
  }

  return [
    '### Working Memory',
    `- Summary: ${normalizeInlineText(workingMemory.summary)}`,
    `- Unresolved Threads: ${formatInlineList(workingMemory.unresolvedThreads)}`,
    `- Covered Topics: ${formatInlineList(workingMemory.coveredTopics)}`,
  ]
}

function renderEpisodicMemories(
  episodicMemories: GameMasterInput['context']['conversationState']['episodicMemories'],
): string[] {
  if (episodicMemories.length === 0) {
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
  longTermFacts: GameMasterInput['context']['conversationState']['longTermFacts'],
): string[] {
  if (longTermFacts.length === 0) {
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
    ...(hasText(experience.language)
      ? [`- Language: ${normalizeInlineText(experience.language)}`]
      : []),
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

function renderRetrievedContext(
  retrievedContext: GameMasterInput['context']['retrievedContext'],
): string[] {
  if (retrievedContext === undefined) {
    return []
  }

  const avatarKnowledgeLines = renderRetrievedCategory(
    'Avatar knowledge',
    retrievedContext.avatar_knowledge,
  )
  const worldLines = renderRetrievedCategory('World', retrievedContext.world)
  const mediaLines = renderRetrievedCategory('Media', retrievedContext.media)

  const lines = [...avatarKnowledgeLines, ...worldLines, ...mediaLines]
  return lines
}

function renderRetrievedCategory(
  title: string,
  entries: NonNullable<GameMasterInput['context']['retrievedContext']>['avatar_knowledge'],
): string[] {
  if (entries.length === 0) {
    return []
  }

  return [
    `${title} excerpts:`,
    ...entries.map(
      (entry, index) =>
        `${formatNumber(index + 1)}. [${normalizeInlineText(entry.sourceId)} / ${normalizeInlineText(entry.chunkId)} / ${entry.knowledgeType}] ${normalizeInlineText(entry.content)}`,
    ),
  ]
}

function findLatestMessageByRole(
  recentMessages: GameMasterInput['context']['conversationState']['recentMessages'],
  role: 'user' | 'avatar' | 'system',
): { role: 'user' | 'avatar' | 'system'; content: string } | undefined {
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
