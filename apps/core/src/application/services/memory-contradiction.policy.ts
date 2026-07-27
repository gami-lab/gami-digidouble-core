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
  const normalizedText = text.replace(/\s+/g, ' ').trim().toLowerCase()
  const normalizedValue = fact.value.replace(/\s+/g, ' ').trim().toLowerCase()
  return normalizedValue.length > 0 && normalizedText.includes(normalizedValue)
}
