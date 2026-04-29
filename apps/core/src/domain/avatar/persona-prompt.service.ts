import type { AvatarConfig } from './avatar.types.js'

const DEFAULT_STYLE_RULE = 'Stay in character and keep responses concise.'

export type AvatarAwarenessItem = {
  name: string
  description?: string
  scope?: string
  availability: 'available' | 'locked'
}

export function assemblePersonaPrompt(
  config: AvatarConfig,
  opts?: { gmNotes?: string; avatarAwareness?: AvatarAwarenessItem[] },
): string {
  const personaPrompt = requirePersonaPrompt(config.personaPrompt)
  const sections: string[] = [personaPrompt]

  if (shouldAppendName(personaPrompt, config.name)) {
    sections.push(`Your name is ${config.name.trim()}.`)
  }

  if (hasText(config.tone)) {
    sections.push(`Your tone is ${config.tone.trim()}.`)
  }

  sections.push(...buildAdjustments(config.adjustments))
  sections.push(...buildAvatarAwareness(opts?.avatarAwareness))

  // EPIC 2.2 extension point: inject async Game Master directives here.
  sections.push(DEFAULT_STYLE_RULE)
  if (hasText(opts?.gmNotes)) {
    sections.push(`Director notes: ${opts.gmNotes.trim()}`)
  }
  return sections.join('\n\n')
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

function buildAvatarAwareness(avatars: AvatarAwarenessItem[] | undefined): string[] {
  if (avatars === undefined || avatars.length === 0) return []

  const lines = avatars.map((avatar) => {
    const details = [avatar.description, avatar.scope].filter(hasText).join(' Scope: ')
    const suffix = details.length > 0 ? ` — ${details}` : ''
    return `- ${avatar.name} (${avatar.availability})${suffix}`
  })

  return [
    [
      'Other avatars in this scenario:',
      ...lines,
      'You may suggest that the user talk to another avatar when their scope is a better fit. You cannot unlock avatars yourself; availability is managed by the director.',
    ].join('\n'),
  ]
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
