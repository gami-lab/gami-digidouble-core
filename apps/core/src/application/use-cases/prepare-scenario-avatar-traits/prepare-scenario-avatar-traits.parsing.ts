import { AVATAR_COMPUTED_TRAIT_KEYS, coerceAvatarComputedTraits } from '@gami/shared'
import type { AvatarComputedTraits } from '@gami/shared'

/**
 * Parses raw LLM output into the fixed trait shape.
 *
 * Lenient by design: only the seven allowed fields are ever read (any other
 * key the model invents is silently dropped), and a missing/invalid field
 * defaults to `[]` rather than failing the whole parse — an LLM omitting a
 * field it has no signal for is expected, not an error.
 *
 * Returns `null` only when the response isn't parseable JSON at all.
 */
export function parseTraitPreparationOutput(content: string): AvatarComputedTraits | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripMarkdownFences(content))
  } catch {
    return null
  }
  return coerceAvatarComputedTraits(parsed)
}

/**
 * Normalizes a parsed trait object: trims whitespace, drops empties, and
 * deduplicates exact repeats. No item-count cap — the prompt guides how
 * many items each field should have, but if the model returns more than
 * asked for, we keep all of it rather than truncate potentially important
 * detail (e.g. a longer timeline).
 */
export function normalizeComputedTraits(raw: AvatarComputedTraits): AvatarComputedTraits {
  const result = {} as AvatarComputedTraits
  for (const field of AVATAR_COMPUTED_TRAIT_KEYS) {
    result[field] = normalizeField(raw[field])
  }
  return result
}

function normalizeField(items: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const item of items) {
    const trimmed = item.trim()
    if (trimmed.length === 0 || seen.has(trimmed)) continue
    seen.add(trimmed)
    normalized.push(trimmed)
  }
  return normalized
}

function stripMarkdownFences(content: string): string {
  const trimmed = content.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match?.[1]?.trim() ?? trimmed
}
