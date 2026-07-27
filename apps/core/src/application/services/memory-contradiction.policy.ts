import type { MemoryFactRecord, VerifiedMemoryContext } from '../../domain/memory/memory.types.js'

export function isUnsupportedContradictedAvatarClaim(
  fact: MemoryFactRecord,
  messages: Array<{ role: 'user' | 'avatar' | 'system'; createdAt: string; content: string }>,
  verifiedContext: VerifiedMemoryContext[] | undefined,
): boolean {
  const hasVerifiedSupport = (verifiedContext ?? []).some((entry) =>
    containsFactText(entry.content, fact),
  )
  if (hasVerifiedSupport) return false

  const hasUserSupport = messages
    .filter((message) => message.role === 'user')
    .some((message) => containsFactText(message.content, fact))
  if (hasUserSupport) return false

  const avatarClaimIndexes = messages.reduce<number[]>((indexes, message, index) => {
    if (message.role === 'avatar' && containsFactText(message.content, fact)) indexes.push(index)
    return indexes
  }, [])
  if (avatarClaimIndexes.length === 0) return false

  return avatarClaimIndexes.some((claimIndex) =>
    messages
      .slice(claimIndex + 1)
      .some(
        (message) =>
          message.role === 'user' &&
          /\b(contradict|contradiction|contradictory|inconsistent|incorrect|wrong|not true|that cannot be|doesn't make sense|confused|contradictoire|incohérent)\b/i.test(
            message.content,
          ),
      ),
  )
}

function containsFactText(text: string, fact: MemoryFactRecord): boolean {
  const normalizedText = normalizeText(text)
  const normalizedValue = normalizeText(fact.value)
  if (normalizedValue.length === 0) return false
  if (normalizedText.includes(normalizedValue)) return true

  const valueTokens = significantTokens(normalizedValue)
  if (valueTokens.length === 0) return false
  const textTokens = significantTokens(normalizedText)
  let nextTokenIndex = 0

  return valueTokens.every((valueToken) => {
    const matchingIndex = textTokens.indexOf(valueToken, nextTokenIndex)
    if (matchingIndex === -1) return false
    nextTokenIndex = matchingIndex + 1
    return true
  })
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function significantTokens(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !CONTRADICTION_STOP_WORDS.has(token))
}

const CONTRADICTION_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'from',
  'her',
  'his',
  'their',
  'with',
  'that',
  'this',
])
