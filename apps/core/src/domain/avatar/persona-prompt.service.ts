import type { AvatarComputedTraits, AvatarConfig } from './avatar.types.js'
import type {
  AvatarAwarenessItem,
  AvatarPromptIdentityConfig,
  AvatarPromptIdentityInput,
  AvatarPromptIdentitySource,
  AvatarPromptOptions,
} from './persona-prompt.types.js'
import type {
  AvatarContextConversationState,
  ContextScenarioSnapshot,
} from '../context/session-context.types.js'
import type { DialogueControlMode } from '../game-master/game-master.types.js'
import type { LayeredMemorySnapshot } from '../memory/memory.types.js'

const DEFAULT_STYLE_RULE = [
  'Stay in character and keep responses concise.',
  'Use dialogue over lectures: default to 1-3 short sentences for simple questions.',
  'Match answer length to user effort and question complexity.',
  'Apply the 80/20 rule: assume most context is already known and provide only the next useful 20%.',
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
  const promptInputs = resolvePromptSectionInputs(config, opts)
  const sections = [
    ...buildGameMasterGuidance(promptInputs.gmGuidance),
    ...(promptInputs.gmGuidance === undefined
      ? buildDirectorNotes(promptInputs.directorNotes)
      : []),
    buildResponseRulesSection(promptInputs.responseRules, promptInputs.gmGuidance),
    ...buildConversationStateSection(promptInputs.memory, promptInputs.avatarAwareness),
    ...buildUserPersonaContext(promptInputs.userPersona),
    ...buildWorldContext(promptInputs.worldContext),
    ...buildRetrievalContext(promptInputs.retrieval),
  ]
  const avatarTraitsSection = buildAvatarTraitsSection(config, opts)
  if (avatarTraitsSection !== null) {
    sections.push(avatarTraitsSection)
  }
  return sections.join('\n\n')
}

function resolvePromptSectionInputs(
  config: AvatarConfig,
  opts?: AvatarPromptOptions,
): {
  directorNotes: string | undefined
  responseRules: string[] | undefined
  memory: AvatarPromptOptions['memory']
  avatarAwareness: AvatarAwarenessItem[] | undefined
  userPersona: AvatarPromptOptions['userPersona']
  worldContext: string | ContextScenarioSnapshot | undefined
  retrieval: AvatarPromptOptions['retrieval']
  gmGuidance: AvatarPromptOptions['gmGuidance']
} {
  const promptSections = opts?.sections
  if (promptSections === undefined) {
    return resolveLegacyPromptSectionInputs(config, opts)
  }

  return resolveSelectedPromptSectionInputs(promptSections, opts)
}

function resolveLegacyPromptSectionInputs(
  config: AvatarConfig,
  opts?: AvatarPromptOptions,
): {
  directorNotes: string | undefined
  responseRules: string[] | undefined
  memory: AvatarPromptOptions['memory']
  avatarAwareness: AvatarAwarenessItem[] | undefined
  userPersona: AvatarPromptOptions['userPersona']
  worldContext: string | ContextScenarioSnapshot | undefined
  retrieval: AvatarPromptOptions['retrieval']
  gmGuidance: AvatarPromptOptions['gmGuidance']
} {
  return {
    directorNotes: opts?.gmNotes,
    responseRules: config.adjustments,
    memory: opts?.memory,
    avatarAwareness: opts?.avatarAwareness,
    userPersona: opts?.userPersona,
    worldContext: opts?.worldContext,
    retrieval: opts?.retrieval,
    gmGuidance: opts?.gmGuidance,
  }
}

function resolveSelectedPromptSectionInputs(
  promptSections: NonNullable<AvatarPromptOptions['sections']>,
  opts?: AvatarPromptOptions,
): {
  directorNotes: string | undefined
  responseRules: string[] | undefined
  memory: AvatarPromptOptions['memory']
  avatarAwareness: AvatarAwarenessItem[] | undefined
  userPersona: AvatarPromptOptions['userPersona']
  worldContext: string | ContextScenarioSnapshot | undefined
  retrieval: AvatarPromptOptions['retrieval']
  gmGuidance: AvatarPromptOptions['gmGuidance']
} {
  return {
    directorNotes: promptSections.directorNotes ?? undefined,
    responseRules: promptSections.responseRules.items,
    memory: toLayeredMemorySnapshot(promptSections.conversationState),
    avatarAwareness: opts?.avatarAwareness,
    userPersona: promptSections.userPersona ?? undefined,
    worldContext: promptSections.worldContext,
    retrieval: promptSections.retrievedContext?.typedSections,
    gmGuidance: opts?.gmGuidance,
  }
}

/**
 * Compatibility boundary for EPIC 8.1 -> 8.2:
 * prefer prepared `computedTraits`, otherwise fall back to authored
 * `personaPrompt` so pre-preparation avatars still answer normally.
 */
export function resolveAvatarPromptIdentitySource(
  config: AvatarPromptIdentityInput,
): AvatarPromptIdentitySource {
  if (config.computedTraits !== undefined && config.computedTraits !== null) {
    return {
      source: 'computedTraits',
      computedTraits: config.computedTraits,
    }
  }

  return {
    source: 'personaPrompt',
    personaPrompt: requirePersonaPrompt(config.personaPrompt),
  }
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

function buildUserPersonaContext(userPersona: AvatarPromptOptions['userPersona']): string[] {
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
  memory: AvatarPromptOptions['memory'],
  avatarAwareness: AvatarAwarenessItem[] | undefined,
): string[] {
  if (memory === undefined && (avatarAwareness === undefined || avatarAwareness.length === 0))
    return []

  const lines: string[] = ['## Conversation State']
  appendLongTermMemory(lines, memory)
  appendAvatarAwareness(lines, avatarAwareness)

  return lines.length > 1 ? [lines.join('\n')] : []
}

function appendLongTermMemory(lines: string[], memory: AvatarPromptOptions['memory']): void {
  const facts = memory?.longTerm?.facts ?? []
  const validFacts = facts.filter((fact) => hasText(fact.key) && hasText(fact.value))
  if (validFacts.length === 0) return
  lines.push('Remembered user facts:')
  for (const fact of validFacts) {
    lines.push(`- ${fact.key}: ${fact.value}`)
  }
}

function buildRetrievalContext(retrieval: AvatarPromptOptions['retrieval']): string[] {
  if (retrieval === undefined) return []

  const memoryLines = formatRetrievalSection('Memory retrieval', retrieval.memory)
  const worldLines = formatRetrievalSection('World retrieval', retrieval.world)
  const mediaLines = formatRetrievalSection('Media retrieval', retrieval.media)
  const lines = ['## Retrieved Context', ...memoryLines, ...worldLines, ...mediaLines]
  return lines.length > 1 ? [lines.join('\n')] : []
}

function formatRetrievalSection(
  label: string,
  items: NonNullable<AvatarPromptOptions['retrieval']>[keyof NonNullable<
    AvatarPromptOptions['retrieval']
  >],
): string[] {
  if (items.length === 0) return []
  const lines = [`${label}:`]
  for (const item of items) {
    lines.push(`- ${item.content.trim()}`)
  }
  return lines
}

function requirePersonaPrompt(personaPrompt: string): string {
  if (!hasText(personaPrompt)) {
    throw new Error('Avatar personaPrompt must be a non-empty string.')
  }

  return personaPrompt
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
  gmGuidance: AvatarPromptOptions['gmGuidance'],
): string {
  const lines = ['## Response Rules', ...buildAdjustments(responseRules), DEFAULT_STYLE_RULE]
  if (gmGuidance !== undefined) {
    lines.push(
      'Dialogue-control rule:',
      DIALOGUE_CONTROL_RULES[gmGuidance.mode],
      "Respect the Game Master's askFollowUp value. When false, do not end with a question unless clarification is required to understand the user's request.",
    )
  }
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
    `Dialogue mode: ${guidance.mode}`,
    `Follow-up question: ${guidance.askFollowUp ? 'yes' : 'no'}`,
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
  config: AvatarPromptIdentityConfig,
  opts?: AvatarPromptOptions,
): string | null {
  const identitySource = resolvePromptIdentitySource(config, opts)
  if (identitySource === null) return null
  const lines = ['## Avatar Traits']

  if (identitySource.source === 'personaPrompt') {
    lines.push(identitySource.personaPrompt)

    if (shouldAppendName(identitySource.personaPrompt, config.name)) {
      lines.push(`Your name is ${config.name.trim()}.`)
    }

    if (hasText(config.tone)) {
      lines.push(`Your tone is ${config.tone.trim()}.`)
    }

    return lines.join('\n')
  }

  const traitText = flattenTraitText(identitySource.computedTraits)

  if (shouldAppendName(traitText, config.name)) {
    lines.push(`Name: ${config.name.trim()}`)
  }
  if (shouldAppendTone(traitText, config.tone)) {
    lines.push(`Tone: ${config.tone.trim()}`)
  }

  lines.push(...buildTraitField('Identity', identitySource.computedTraits.identity))
  lines.push(...buildTraitField('Personality', identitySource.computedTraits.personality))
  lines.push(...buildTraitField('Speaking Style', identitySource.computedTraits.speakingStyle))
  lines.push(...buildTraitField('Background', identitySource.computedTraits.background))
  lines.push(...buildTraitField('Timeline', identitySource.computedTraits.timeline))
  lines.push(
    ...buildTraitField('Current Situation', identitySource.computedTraits.currentSituation),
  )
  lines.push(
    ...buildTraitField('Behavioural Rules', identitySource.computedTraits.behaviouralRules),
  )

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

function resolvePromptIdentitySource(
  config: AvatarPromptIdentityConfig,
  opts?: AvatarPromptOptions,
): AvatarPromptIdentitySource | null {
  if (opts?.identitySource !== undefined) {
    return opts.identitySource
  }
  if (opts?.sections?.avatarTraits !== undefined) {
    return {
      source: 'computedTraits',
      computedTraits: opts.sections.avatarTraits,
    }
  }
  return resolveAvatarPromptIdentitySource(config)
}

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
    conversationState.workingMemory.avatar !== undefined
      ? {
          working: {
            ...(conversationState.workingMemory.session !== undefined
              ? { session: conversationState.workingMemory.session }
              : {}),
            ...(conversationState.workingMemory.avatar !== undefined
              ? { avatar: conversationState.workingMemory.avatar }
              : {}),
          },
        }
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
