/** Shared bounded BCP-47 language-tag validation for runtime contracts. */
export const LANGUAGE_TAG_MAX_LENGTH = 35

export function isLanguageTag(value: unknown): value is string {
  const normalized = normalizeLanguageTag(value)
  return normalized !== null && normalized !== undefined
}

export function normalizeLanguageTag(value: unknown): string | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (
    normalized.length === 0 ||
    normalized.length > LANGUAGE_TAG_MAX_LENGTH ||
    !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u.test(normalized)
  ) {
    return null
  }

  return normalized
    .split('-')
    .map((part, index) => {
      if (index === 0) return part.toLowerCase()
      if (/^[A-Za-z]{2}$/u.test(part) || /^\d{3}$/u.test(part)) return part.toUpperCase()
      const firstCharacter = part[0]
      return firstCharacter === undefined
        ? part
        : firstCharacter.toUpperCase() + part.slice(1).toLowerCase()
    })
    .join('-')
}
