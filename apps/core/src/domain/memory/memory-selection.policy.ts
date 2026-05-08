import type { ConversationMemory, MemorySelectionReason } from './memory.types.js'

type ScoreInput = {
  memory: ConversationMemory
  userMessageText: string
  workingUnresolvedThreads: string[]
  recencyRank: number
}

export function scoreEpisodicMemorySelection(input: ScoreInput): {
  score: number
  reasons: MemorySelectionReason[]
} {
  const reasons: MemorySelectionReason[] = ['continuity']
  let score = 10

  const recencyPoints = Math.max(0, 4 - input.recencyRank)
  if (recencyPoints > 0) {
    reasons.push('recency')
    score += recencyPoints
  }

  const queryTokens = tokenize(input.userMessageText)
  const topicTokens = new Set([
    ...input.memory.unresolvedTopics.flatMap((topic) => tokenize(topic)),
    ...input.memory.keyDiscoveries.flatMap((item) => tokenize(item)),
  ])
  const overlap = countTokenOverlap(queryTokens, topicTokens)
  if (overlap > 0) {
    reasons.push('relevance')
    score += Math.min(5, overlap * 2)
  }

  const unresolvedOverlap = countNormalizedOverlap(
    input.workingUnresolvedThreads,
    input.memory.unresolvedTopics,
  )
  if (unresolvedOverlap > 0) {
    reasons.push('unresolved_topic')
    score += Math.min(4, unresolvedOverlap * 2)
  }

  return { score, reasons: uniqueReasons(reasons) }
}

function countTokenOverlap(tokens: string[], topicTokens: Set<string>): number {
  let overlap = 0
  for (const token of tokens) {
    if (topicTokens.has(token)) overlap += 1
  }
  return overlap
}

function countNormalizedOverlap(source: string[], target: string[]): number {
  const sourceSet = new Set(source.map(normalizeText).filter((value) => value.length > 0))
  let overlap = 0
  for (const item of target) {
    if (sourceSet.has(normalizeText(item))) overlap += 1
  }
  return overlap
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((token) => token.length >= 3)
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim()
}

function uniqueReasons(reasons: MemorySelectionReason[]): MemorySelectionReason[] {
  return Array.from(new Set(reasons))
}
