import type { AvatarConfig } from './avatar.types.js'
import type { LayeredMemorySnapshot } from '../memory/memory.types.js'
import type { UserPersona } from '../user/index.js'
import type { RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'

const DEFAULT_STYLE_RULE = [
  'Stay in character and keep responses concise.',
  'Use dialogue over lectures: default to 1-3 short sentences for simple questions.',
  'Match answer length to user effort and question complexity.',
  'Apply the 80/20 rule: assume most context is already known and provide only the next useful 20%.',
  'Prioritize curiosity: end with one focused follow-up question when it helps the user go deeper.',
].join(' ')

export type AvatarAwarenessItem = {
  name: string
  description?: string
  scope?: string
  availability: 'available' | 'locked'
}

export function assemblePersonaPrompt(
  config: AvatarConfig,
  opts?: {
    gmNotes?: string
    avatarAwareness?: AvatarAwarenessItem[]
    userPersona?: UserPersona
    memory?: LayeredMemorySnapshot
    retrieval?: {
      memory: RetrievedKnowledgeItem[]
      world: RetrievedKnowledgeItem[]
      media: RetrievedKnowledgeItem[]
    }
  },
): string {
  const personaPrompt = requirePersonaPrompt(config.personaPrompt)
  const sections: string[] = [buildCorePersonaSection(personaPrompt, config)]

  // Deterministic precedence for adaptive context: persona -> memory -> retrieval snippets.
  sections.push(...buildUserPersonaContext(opts?.userPersona))
  sections.push(...buildMemoryContext(opts?.memory))
  sections.push(...buildRetrievalContext(opts?.retrieval))
  sections.push(...buildAvatarAwareness(opts?.avatarAwareness))
  sections.push(buildResponseRulesSection(config.adjustments))
  sections.push(...buildDirectorNotes(opts?.gmNotes))
  return sections.join('\n\n')
}

function buildCorePersonaSection(personaPrompt: string, config: AvatarConfig): string {
  const lines = ['## Core Persona', personaPrompt]

  if (shouldAppendName(personaPrompt, config.name)) {
    lines.push(`Your name is ${config.name.trim()}.`)
  }

  if (hasText(config.tone)) {
    lines.push(`Your tone is ${config.tone.trim()}.`)
  }

  return lines.join('\n')
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

function buildMemoryContext(memory: LayeredMemorySnapshot | undefined): string[] {
  if (memory === undefined) return []
  const lines: string[] = ['## Memory Context']
  appendWorkingMemory(lines, memory)
  appendLongTermMemory(lines, memory)

  return lines.length > 1 ? [lines.join('\n')] : []
}

function appendWorkingMemory(lines: string[], memory: LayeredMemorySnapshot): void {
  if (hasText(memory.working?.session?.summary)) {
    lines.push(`Session working memory: ${memory.working.session.summary}`)
  }
  if (hasText(memory.working?.avatar?.summary)) {
    lines.push(`Current avatar memory: ${memory.working.avatar.summary}`)
  }
}

function appendLongTermMemory(lines: string[], memory: LayeredMemorySnapshot): void {
  const facts = memory.longTerm?.facts ?? []
  const validFacts = facts.filter((fact) => hasText(fact.key) && hasText(fact.value))
  if (validFacts.length === 0) return
  lines.push('Remembered user facts:')
  for (const fact of validFacts) {
    lines.push(`- ${fact.key}: ${fact.value}`)
  }
}

function buildRetrievalContext(
  retrieval:
    | {
        memory: RetrievedKnowledgeItem[]
        world: RetrievedKnowledgeItem[]
        media: RetrievedKnowledgeItem[]
      }
    | undefined,
): string[] {
  if (retrieval === undefined) return []

  const memoryLines = formatRetrievalSection('Memory retrieval', retrieval.memory)
  const worldLines = formatRetrievalSection('World retrieval', retrieval.world)
  const mediaLines = formatRetrievalSection('Media retrieval', retrieval.media)
  const lines = ['## Retrieved Context', ...memoryLines, ...worldLines, ...mediaLines]
  return lines.length > 1 ? [lines.join('\n')] : []
}

function formatRetrievalSection(label: string, items: RetrievedKnowledgeItem[]): string[] {
  if (items.length === 0) return []
  const lines = [`${label}:`]
  for (const item of items.slice(0, 2)) {
    lines.push(`- ${compactText(item.content, 200)}`)
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

function buildAvatarAwareness(avatars: AvatarAwarenessItem[] | undefined): string[] {
  if (avatars === undefined || avatars.length === 0) return []

  const lines = avatars.map((avatar) => {
    const details = [avatar.description, avatar.scope].filter(hasText).join(' Scope: ')
    const suffix = details.length > 0 ? ` — ${details}` : ''
    return `- ${avatar.name} (${avatar.availability})${suffix}`
  })

  return [
    [
      '## Other Avatars',
      'Other avatars in this scenario:',
      ...lines,
      'You may suggest that the user talk to another avatar when their scope is a better fit and you may mention locked avatars. Availability is managed by the director, who may unlock mentioned avatars automatically.',
    ].join('\n'),
  ]
}

function buildDirectorNotes(gmNotes: string | undefined): string[] {
  if (!hasText(gmNotes)) return []
  return [['## Director Notes', gmNotes.trim()].join('\n')]
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compactText(value: string, maxLength: number): string {
  const compact = value.trim().replaceAll(/\s+/g, ' ')
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength)}...`
}
