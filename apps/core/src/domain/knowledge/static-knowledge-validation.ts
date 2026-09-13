/** Reserved metadata keys that would make static knowledge user- or conversation-scoped. */
export const RESERVED_STATIC_SCOPE_KEYS = ['conversationId', 'sessionId', 'userId'] as const

export function findReservedStaticScopeKeys(value: unknown): string[] {
  const found = new Set<string>()
  const visited = new WeakSet()

  function visit(current: unknown): void {
    if (typeof current !== 'object' || current === null) return
    if (visited.has(current)) return
    visited.add(current)

    if (Array.isArray(current)) {
      for (const item of current) visit(item)
      return
    }

    for (const [key, nested] of Object.entries(current)) {
      if ((RESERVED_STATIC_SCOPE_KEYS as readonly string[]).includes(key)) found.add(key)
      visit(nested)
    }
  }

  visit(value)
  return [...found].sort()
}

export function assertStaticMetadataAllowed(value: unknown, subject: string): void {
  const reservedKeys = findReservedStaticScopeKeys(value)
  if (reservedKeys.length === 0) return
  throw new Error(
    `Static knowledge ${subject} metadata cannot contain reserved scope keys: ${reservedKeys.join(', ')}.`,
  )
}
