import type { AvatarComputedTraits, AvatarConfig } from './avatar.types.js'
import type {
  AvatarAwarenessItem,
  AvatarPromptIdentityConfig,
  AvatarPromptIdentityInput,
  AvatarPromptIdentitySource,
  AvatarPromptOptions,
} from './persona-prompt.types.js'

const DEFAULT_STYLE_RULE = [
  'Stay in character and keep responses concise.',
  'Use dialogue over lectures: default to 1-3 short sentences for simple questions.',
  'Match answer length to user effort and question complexity.',
  'Apply the 80/20 rule: assume most context is already known and provide only the next useful 20%.',
  'Prioritize curiosity: end with one focused follow-up question when it helps the user go deeper.',
].join(' ')

export function assemblePersonaPrompt(config: AvatarConfig, opts?: AvatarPromptOptions): string {
  const sections: string[] = []

  sections.push(...buildDirectorNotes(opts?.gmNotes))
  sections.push(buildResponseRulesSection(config.adjustments))
  sections.push(...buildConversationStateSection(opts?.memory, opts?.avatarAwareness))
  sections.push(...buildUserPersonaContext(opts?.userPersona))
  sections.push(...buildWorldContext(opts?.worldContext))
  sections.push(...buildRetrievalContext(opts?.retrieval))
  sections.push(buildAvatarTraitsSection(config))
  return sections.join('\n\n')
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

function buildWorldContext(worldContext: string | undefined): string[] {
  if (!hasText(worldContext)) return []
  return [['## World Context', worldContext.trim()].join('\n')]
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
  appendRecentExchanges(lines, memory)
  appendWorkingMemory(lines, memory)
  appendLongTermMemory(lines, memory)
  appendAvatarAwareness(lines, avatarAwareness)

  return lines.length > 1 ? [lines.join('\n')] : []
}

function appendRecentExchanges(lines: string[], memory: AvatarPromptOptions['memory']): void {
  const recentExchanges = memory?.shortTerm?.recentExchanges ?? []
  if (recentExchanges.length === 0) return

  lines.push('Recent exchanges:')
  for (const exchange of recentExchanges) {
    if (hasText(exchange.user)) {
      lines.push(`- User: ${exchange.user.trim()}`)
    }
    if (hasText(exchange.avatar)) {
      lines.push(`- Avatar: ${exchange.avatar.trim()}`)
    }
  }
}

function appendWorkingMemory(lines: string[], memory: AvatarPromptOptions['memory']): void {
  const sessionSummary = memory?.working?.session?.summary
  if (hasText(sessionSummary)) {
    lines.push(`Session working memory: ${sessionSummary}`)
  }
  const avatarSummary = memory?.working?.avatar?.summary
  if (hasText(avatarSummary)) {
    lines.push(`Current avatar memory: ${avatarSummary}`)
  }
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

function buildResponseRulesSection(adjustments: AvatarConfig['adjustments']): string {
  const lines = ['## Response Rules', ...buildAdjustments(adjustments), DEFAULT_STYLE_RULE]
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

function buildAvatarTraitsSection(config: AvatarPromptIdentityConfig): string {
  const identitySource = resolveAvatarPromptIdentitySource(config)
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

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
