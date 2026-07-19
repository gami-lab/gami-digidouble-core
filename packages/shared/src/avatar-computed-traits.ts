import type { AvatarComputedTraits } from './entity-types.js'

export const AVATAR_COMPUTED_TRAIT_KEYS = [
  'identity',
  'personality',
  'speakingStyle',
  'background',
  'timeline',
  'currentSituation',
  'behaviouralRules',
] as const satisfies readonly (keyof AvatarComputedTraits)[]

export const AVATAR_COMPUTED_TRAIT_LABELS: Record<
  (typeof AVATAR_COMPUTED_TRAIT_KEYS)[number],
  string
> = {
  identity: 'Identity',
  personality: 'Personality',
  speakingStyle: 'Speaking style',
  background: 'Background',
  timeline: 'Timeline',
  currentSituation: 'Current situation',
  behaviouralRules: 'Behavioural rules',
}

export function createEmptyAvatarComputedTraits(): AvatarComputedTraits {
  return {
    identity: [],
    personality: [],
    speakingStyle: [],
    background: [],
    timeline: [],
    currentSituation: [],
    behaviouralRules: [],
  }
}

/**
 * Converts arbitrary input into the fixed seven-field trait shape.
 *
 * - Returns `null` when the value is not an object.
 * - Drops invented fields.
 * - Keeps only string items inside each canonical field array.
 */
export function coerceAvatarComputedTraits(value: unknown): AvatarComputedTraits | null {
  if (!isRecord(value)) return null

  const result = createEmptyAvatarComputedTraits()
  for (const key of AVATAR_COMPUTED_TRAIT_KEYS) {
    result[key] = readStringArray(value[key])
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}
