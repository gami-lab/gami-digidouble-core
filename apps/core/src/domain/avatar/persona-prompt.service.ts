import type { AvatarComputedTraits, AvatarConfig } from './avatar.types.js'
import type { RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import { AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS } from '@gami/shared'
import type {
  AvatarAwarenessItem,
  AvatarPromptRetrievalSections,
  AvatarPromptOptions,
} from './persona-prompt.types.js'
import type {
  AvatarContextConversationState,
  ContextScenarioSnapshot,
} from '../context/session-context.types.js'
import type { DialogueControlMode } from '../game-master/game-master.types.js'
import type { LayeredMemorySnapshot } from '../memory/memory.types.js'
import type { UserPersona } from '../user/user.types.js'
import { selectBalancedRetrievedItems } from '../knowledge/retrieval-selection.js'

const DEFAULT_STYLE_RULE = [
  'Stay in character and keep responses concise.',
  'Use dialogue over lectures: default to 1-3 short sentences for simple questions.',
  'Match answer length to user effort and question complexity.',
  'Apply the 80/20 rule: assume most context is already known and provide only the next useful 20%.',
  'Return spoken dialogue only.',
  'Do not describe gestures, facial expressions, body language, thoughts, silence, or scene actions.',
  'Do not use stage directions, narration, Markdown emphasis, speaker labels, or em-dash dialogue formatting.',
  'Answer directly as the Avatar in natural sentences.',
].join(' ')

const DIALOGUE_CONTROL_RULES: Record<DialogueControlMode, string> = {
  user_led:
    "Answer the user's question directly. Let the user control the sequence. Do not add a generic follow-up question.",
  avatar_guided: 'Answer directly. You may offer one focused question or next direction.',
  avatar_led: 'Take initiative. Introduce one meaningful topic, recollection, or question.',
  repair:
    'Resolve the contradiction, misunderstanding, or unsupported claim before progressing. Do not introduce a new topic until the issue is clarified.',
  transition: 'Close the current topic naturally and move toward the indicated subject or Avatar.',
}

export function assemblePersonaPrompt(config: AvatarConfig, opts?: AvatarPromptOptions): string {
  if (opts === undefined) {
    throw new Error('Avatar prompt assembly requires structured context sections.')
  }
  const promptInputs = resolveSelectedPromptSectionInputs(opts.sections, opts)
  const sections = [
    ...buildGameMasterGuidance(promptInputs.gmGuidance),
    ...(promptInputs.gmGuidance === undefined
      ? buildDirectorNotes(promptInputs.directorNotes)
      : []),
    buildResponseRulesSection(promptInputs.responseRules, promptInputs.language),
    ...buildConversationStateSection(promptInputs.memory, promptInputs.avatarAwareness),
    ...buildUserPersonaContext(promptInputs.userPersona),
    ...buildWorldContext(promptInputs.worldContext),
    ...buildRetrievalContext(promptInputs.retrieval, opts.retrievalOptions),
  ]
  sections.push(buildAvatarTraitsSection(config, promptInputs.avatarTraits))
  return sections.join('\n\n')
}

function resolveSelectedPromptSectionInputs(
  promptSections: AvatarPromptOptions['sections'],
  opts: AvatarPromptOptions,
): {
  directorNotes: string | undefined
  responseRules: string[] | undefined
  memory: LayeredMemorySnapshot | undefined
  avatarAwareness: AvatarAwarenessItem[] | undefined
  userPersona: UserPersona | undefined
  worldContext: string | ContextScenarioSnapshot | undefined
  retrieval: AvatarPromptRetrievalSections | undefined
  gmGuidance: AvatarPromptOptions['gmGuidance']
  language: string | undefined
  avatarTraits: AvatarComputedTraits
} {
  return {
    directorNotes: promptSections.directorNotes ?? undefined,
    responseRules: promptSections.responseRules.items,
    memory: toLayeredMemorySnapshot(promptSections.conversationState),
    avatarAwareness: opts.avatarAwareness,
    userPersona: promptSections.userPersona ?? undefined,
    worldContext: promptSections.worldContext,
    retrieval: promptSections.retrievedContext?.typedSections,
    gmGuidance: opts.gmGuidance,
    language: promptSections.worldContext.language,
    avatarTraits: requireAvatarTraits(promptSections.avatarTraits),
  }
}

function requireAvatarTraits(traits: AvatarComputedTraits | undefined): AvatarComputedTraits {
  if (traits === undefined) {
    throw new Error('Avatar prompt assembly requires prepared computedTraits.')
  }
  return traits
}

function buildWorldContext(worldContext: string | ContextScenarioSnapshot | undefined): string[] {
  if (typeof worldContext === 'string') {
    if (!hasText(worldContext)) return []
    return [['## World Context', worldContext.trim()].join('\n')]
  }
  if (worldContext === undefined) return []

  const lines = ['## World Context']
  if (hasText(worldContext.name)) {
    lines.push(`Scenario: ${worldContext.name.trim()}`)
  }
  if (hasText(worldContext.description)) {
    lines.push(worldContext.description.trim())
  }
  const goals = (worldContext.goals ?? [])
    .map((goal) => goal.trim())
    .filter((goal) => goal.length > 0)
  if (goals.length > 0) {
    lines.push('Objectives:')
    for (const goal of goals) {
      lines.push(`- ${goal}`)
    }
  }

  return lines.length > 1 ? [lines.join('\n')] : []
}

function buildUserPersonaContext(userPersona: UserPersona | undefined): string[] {
  if (userPersona === undefined) return []

  const lines: string[] = ['## User Persona']
  if (hasText(userPersona.name)) {
    lines.push(`Name: ${userPersona.name.trim()}`)
  }
  if (hasText(userPersona.roleInWorld)) {
    lines.push(`Role in this world: ${userPersona.roleInWorld.trim()}`)
  }
  const relationships = (userPersona.avatarRelationships ?? [])
    .map((relationship) => relationship.trim())
    .filter((relationship) => relationship.length > 0)
  if (relationships.length > 0) {
    lines.push(`Potential avatar relationships: ${relationships.join('; ')}`)
  }
  if (hasText(userPersona.dialogGuidance)) {
    lines.push(`Dialog guidance: ${userPersona.dialogGuidance.trim()}`)
  }

  return lines.length > 1 ? [lines.join('\n')] : []
}

function buildConversationStateSection(
  memory: LayeredMemorySnapshot | undefined,
  avatarAwareness: AvatarAwarenessItem[] | undefined,
): string[] {
  if (memory === undefined && (avatarAwareness === undefined || avatarAwareness.length === 0))
    return []

  const lines: string[] = ['## Conversation State']
  appendRecentExchanges(lines, memory)
  appendWorkingMemory(lines, memory)
  appendEpisodicMemories(lines, memory)
  appendLongTermMemory(lines, memory)
  appendAvatarAwareness(lines, avatarAwareness)

  return lines.length > 1 ? [lines.join('\n')] : []
}

function appendRecentExchanges(lines: string[], memory: LayeredMemorySnapshot | undefined): void {
  const exchanges = memory?.shortTerm?.recentExchanges ?? []
  if (exchanges.length === 0) return
  lines.push('Recent exchanges:')
  exchanges.forEach((exchange, index) => {
    lines.push(`${String(index + 1)}. User: ${exchange.user.trim()}`)
    lines.push(`   Avatar: ${exchange.avatar.trim()}`)
  })
}

function appendWorkingMemory(lines: string[], memory: LayeredMemorySnapshot | undefined): void {
  const working = memory?.working
  if (working === undefined) return
  const hasWorkingContent =
    working.session !== undefined ||
    working.avatar !== undefined ||
    working.conversation !== undefined
  if (!hasWorkingContent) return

  lines.push('Working memory:')
  if (working.session !== undefined) {
    lines.push(`- Session: ${working.session.summary.trim()}`)
  }
  if (working.avatar !== undefined) {
    lines.push(`- Avatar (${working.avatar.avatarId}): ${working.avatar.summary.trim()}`)
  }
  if (working.conversation !== undefined) {
    lines.push(`- Conversation: ${working.conversation.summary.trim()}`)
    lines.push(`  Unresolved threads: ${formatPromptList(working.conversation.unresolvedThreads)}`)
    lines.push(`  Covered topics: ${formatPromptList(working.conversation.coveredTopics)}`)
  }
}

function appendEpisodicMemories(lines: string[], memory: LayeredMemorySnapshot | undefined): void {
  const episodicMemories = memory?.episodicMemories ?? []
  if (episodicMemories.length === 0) return
  lines.push('Episodic memories:')
  episodicMemories.forEach((episode, index) => {
    lines.push(
      `${String(index + 1)}. ${episode.summary.trim()} (memory ${episode.memoryId}, score ${String(episode.score)})`,
    )
    if (episode.keyDiscoveries.length > 0) {
      lines.push(`   Key discoveries: ${formatPromptList(episode.keyDiscoveries)}`)
    }
    if (episode.unresolvedTopics.length > 0) {
      lines.push(`   Unresolved topics: ${formatPromptList(episode.unresolvedTopics)}`)
    }
  })
}

function appendLongTermMemory(lines: string[], memory: LayeredMemorySnapshot | undefined): void {
  const facts = memory?.longTerm?.facts ?? []
  const validFacts = facts.filter((fact) => hasText(fact.key) && hasText(fact.value))
  if (validFacts.length === 0) return
  lines.push('Remembered user facts:')
  for (const fact of validFacts) {
    lines.push(`- ${fact.key}: ${fact.value}`)
  }
}

function formatPromptList(values: string[]): string {
  return values.length > 0 ? values.map((value) => value.trim()).join('; ') : 'none'
}

function buildRetrievalContext(
  retrieval: AvatarPromptRetrievalSections | undefined,
  options: AvatarPromptOptions['retrievalOptions'],
): string[] {
  if (retrieval === undefined) return []

  const avatarKnowledgeAndWorld = selectBalancedRetrievedItems(
    [...retrieval.avatar_knowledge, ...retrieval.world],
    options?.maxChunks ?? AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS,
    options,
  )
  const contextLines = formatRetrievedItems(avatarKnowledgeAndWorld, 'Context')
  const mediaLines = formatRetrievedItems(retrieval.media, 'Media context')
  const lines = [
    '## Retrieved Context',
    ...contextLines,
    ...(mediaLines.length > 0 ? ['', 'Media retrieval:', ...mediaLines] : []),
  ]
  return lines.length > 1 ? [lines.join('\n')] : []
}

function formatRetrievedItems(items: RetrievedKnowledgeItem[], label: string): string[] {
  if (items.length === 0) return []
  const lines: string[] = []
  items.forEach((item, index) => {
    if (index > 0) lines.push('', '---', '')
    lines.push(`${label} ${String(index + 1)} (${item.knowledgeType}):`, item.content.trim())
  })
  return lines
}

function shouldAppendName(personaPrompt: string, name: string): boolean {
  if (!hasText(name)) {
    return false
  }

  const escapedName = escapeForRegExp(name.trim())
  const namePattern = new RegExp(`\\b${escapedName}\\b`, 'i')
  return !namePattern.test(personaPrompt)
}

function buildAdjustments(adjustments: AvatarConfig['adjustments']): string[] {
  if (adjustments === undefined) return []
  return adjustments.map((a) => a.trim()).filter((a) => a.length > 0)
}

function buildResponseRulesSection(
  responseRules: string[] | undefined,
  language: string | undefined,
): string {
  const lines = [
    '## Response Rules',
    ...buildAdjustments(responseRules),
    ...(language === undefined
      ? []
      : [
          `Respond entirely in ${language}. Do not switch languages unless the Scenario language changes.`,
        ]),
    DEFAULT_STYLE_RULE,
  ]
  return lines.join('\n')
}

function appendAvatarAwareness(lines: string[], avatars: AvatarAwarenessItem[] | undefined): void {
  if (avatars === undefined || avatars.length === 0) return

  const awarenessLines = avatars.map((avatar) => {
    const details = [avatar.description, avatar.scope].filter(hasText).join(' Scope: ')
    const suffix = details.length > 0 ? ` — ${details}` : ''
    return `- ${avatar.name} (${avatar.availability})${suffix}`
  })

  // Awareness belongs to Conversation State because availability/lock status is
  // runtime-scoped rather than a stable world fact.
  lines.push('Other avatars in this scenario:')
  lines.push(...awarenessLines)
  lines.push(
    'You may suggest that the user talk to another avatar when their scope is a better fit and you may mention locked avatars. Availability is managed by the director, who may unlock mentioned avatars automatically.',
  )
}

function buildDirectorNotes(gmNotes: string | undefined): string[] {
  if (!hasText(gmNotes)) return []
  return [['## Director Notes', gmNotes.trim()].join('\n')]
}

function buildGameMasterGuidance(guidance: AvatarPromptOptions['gmGuidance']): string[] {
  if (guidance === undefined) return []

  const lines = [
    '## Game Master Guidance',
    DIALOGUE_CONTROL_RULES[guidance.mode],
    guidance.askFollowUp
      ? 'You may end with one focused follow-up question when it helps.'
      : "Do not end with a question unless clarification is required to understand the user's request.",
  ]
  if (hasText(guidance.directorNotes)) {
    lines.push('', 'Director note:', guidance.directorNotes.trim())
  }
  if (guidance.retrievalStatus === 'insufficient_evidence') {
    lines.push(
      '',
      'Retrieval status: insufficient evidence.',
      'Do not assert the planned facts as certain. Answer from limited knowledge and say when you do not know.',
    )
  }
  return [lines.join('\n')]
}

function buildAvatarTraitsSection(
  config: AvatarConfig,
  computedTraits: AvatarComputedTraits,
): string {
  const lines = ['## Avatar Traits']

  const traitText = flattenTraitText(computedTraits)

  if (shouldAppendName(traitText, config.name)) {
    lines.push(`Name: ${config.name.trim()}`)
  }
  if (shouldAppendTone(traitText, config.tone)) {
    lines.push(`Tone: ${config.tone.trim()}`)
  }

  lines.push(...buildTraitField('Identity', computedTraits.identity))
  lines.push(...buildTraitField('Personality', computedTraits.personality))
  lines.push(...buildTraitField('Speaking Style', computedTraits.speakingStyle))
  lines.push(...buildTraitField('Background', computedTraits.background))
  lines.push(...buildTraitField('Timeline', computedTraits.timeline))
  lines.push(...buildTraitField('Current Situation', computedTraits.currentSituation))
  lines.push(...buildTraitField('Behavioural Rules', computedTraits.behaviouralRules))

  return lines.join('\n')
}

function buildTraitField(label: string, items: string[]): string[] {
  const lines = [`${label}:`]
  const normalizedItems = items.map((item) => item.trim()).filter((item) => item.length > 0)
  for (const item of normalizedItems) {
    lines.push(`- ${item}`)
  }
  return lines
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function shouldAppendTone(traitText: string, tone: string | undefined): tone is string {
  return hasText(tone) && !traitText.toLocaleLowerCase().includes(tone.trim().toLocaleLowerCase())
}

function flattenTraitText(config: AvatarComputedTraits): string {
  return [
    ...config.identity,
    ...config.personality,
    ...config.speakingStyle,
    ...config.background,
    ...config.timeline,
    ...config.currentSituation,
    ...config.behaviouralRules,
  ].join(' ')
}

// eslint-disable-next-line complexity
function toLayeredMemorySnapshot(
  conversationState: AvatarContextConversationState,
): LayeredMemorySnapshot | undefined {
  const memory = {
    ...(conversationState.recentExchanges.length > 0
      ? {
          shortTerm: {
            exchangeCount: conversationState.recentExchanges.length,
            recentExchanges: conversationState.recentExchanges,
          },
        }
      : {}),
    ...(conversationState.workingMemory.session !== undefined ||
    conversationState.workingMemory.avatar !== undefined ||
    conversationState.workingMemory.conversation !== undefined
      ? {
          working: {
            ...(conversationState.workingMemory.session !== undefined
              ? { session: conversationState.workingMemory.session }
              : {}),
            ...(conversationState.workingMemory.avatar !== undefined
              ? { avatar: conversationState.workingMemory.avatar }
              : {}),
            ...(conversationState.workingMemory.conversation !== undefined
              ? { conversation: conversationState.workingMemory.conversation }
              : {}),
          },
        }
      : {}),
    ...(conversationState.episodicMemories.length > 0
      ? { episodicMemories: conversationState.episodicMemories }
      : {}),
    ...(conversationState.longTermFacts.length > 0
      ? { longTerm: { facts: conversationState.longTermFacts } }
      : {}),
  } satisfies Partial<LayeredMemorySnapshot>

  return Object.keys(memory).length > 0 ? memory : undefined
}

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
