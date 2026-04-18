import type { AvatarConfig } from './avatar.types.js'

const DEFAULT_STYLE_RULE = 'Stay in character and keep responses concise.'

export function assemblePersonaPrompt(config: AvatarConfig): string {
  const personaPrompt = requirePersonaPrompt(config.personaPrompt)
  const sections: string[] = [personaPrompt]

  if (shouldAppendName(personaPrompt, config.name)) {
    sections.push(`Your name is ${config.name.trim()}.`)
  }

  if (hasText(config.tone)) {
    sections.push(`Your tone is ${config.tone.trim()}.`)
  }

  sections.push(...buildConfigAdjustments(config.config))

  // EPIC 2.2 extension point: inject async Game Master directives here.
  sections.push(DEFAULT_STYLE_RULE)
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

function buildConfigAdjustments(config: AvatarConfig['config']): string[] {
  if (config === undefined) {
    return []
  }

  const rawAdjustments = config.personaAdjustments
  if (!Array.isArray(rawAdjustments)) {
    return []
  }

  return rawAdjustments
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
