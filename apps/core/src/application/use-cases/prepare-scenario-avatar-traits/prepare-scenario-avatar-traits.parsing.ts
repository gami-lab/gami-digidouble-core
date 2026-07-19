import { AVATAR_COMPUTED_TRAIT_KEYS, coerceAvatarComputedTraits } from '@gami/shared'
import type { AvatarComputedTraits } from '@gami/shared'

/**
 * Per-field safety ceiling. Most fields follow the EPIC's "5-7 concise
 * items" guidance; `timeline` has no fixed target — the prompt asks for one
 * item per notable event — so it gets a much higher ceiling that only
 * guards against a runaway response, not a compression target.
 */
const FIELD_ITEM_CAPS: Record<(typeof AVATAR_COMPUTED_TRAIT_KEYS)[number], number> = {
  identity: 7,
  personality: 7,
  speakingStyle: 7,
  background: 7,
  timeline: 25,
  currentSituation: 7,
  behaviouralRules: 7,
}

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
 * Normalizes a parsed trait object: trims whitespace, drops empties,
 * deduplicates exact repeats, and caps each field at its {@link FIELD_ITEM_CAPS}
 * ceiling.
 */
export function normalizeComputedTraits(raw: AvatarComputedTraits): AvatarComputedTraits {
  const result = {} as AvatarComputedTraits
  for (const field of AVATAR_COMPUTED_TRAIT_KEYS) {
    result[field] = normalizeField(raw[field], FIELD_ITEM_CAPS[field])
  }
  return result
}

function normalizeField(items: string[], maxItems: number): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const item of items) {
    const trimmed = item.trim()
    if (trimmed.length === 0 || seen.has(trimmed)) continue
    seen.add(trimmed)
    normalized.push(trimmed)
    if (normalized.length >= maxItems) break
  }
  return normalized
}

function stripMarkdownFences(content: string): string {
  const trimmed = content.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match?.[1]?.trim() ?? trimmed
}
