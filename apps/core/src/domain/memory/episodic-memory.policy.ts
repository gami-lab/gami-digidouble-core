import type { ConversationMemory } from './memory.types.js'

const TOKEN_PATTERN = /[a-z0-9]+/gi

export function selectRelevantConversationMemories(
  memories: ConversationMemory[],
  query: string,
  limit: number,
): ConversationMemory[] {
  const queryTokens = tokenize(query)
  const byRecency = memories
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return byRecency
    .map((memory, index) => ({
      memory,
      score: relevanceScore(memory, queryTokens) + recencyScore(index),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.memory)
}

export function buildHydrationSummary(memories: ConversationMemory[]): string {
  if (memories.length === 0) return 'No prior episodic memory for this avatar and scenario.'
  const parts = memories.map((memory) => {
    const discoveries =
      memory.keyDiscoveries.length > 0
        ? `Discoveries: ${memory.keyDiscoveries.join('; ')}.`
        : 'Discoveries: none.'
    const unresolved =
      memory.unresolvedTopics.length > 0
        ? `Unresolved: ${memory.unresolvedTopics.join('; ')}.`
        : 'Unresolved: none.'
    return `${memory.summary} ${discoveries} ${unresolved}`
  })
  return `Hydration context: ${parts.join(' ')}`
}

function tokenize(input: string): Set<string> {
  const tokens = new Set<string>()
  const matches = input.toLowerCase().match(TOKEN_PATTERN)
  if (matches === null) return tokens
  for (const token of matches) {
    if (token.length >= 3) tokens.add(token)
  }
  return tokens
}

function relevanceScore(memory: ConversationMemory, queryTokens: Set<string>): number {
  if (queryTokens.size === 0) return 0
  const body =
    `${memory.summary} ${memory.keyDiscoveries.join(' ')} ${memory.unresolvedTopics.join(' ')}`.toLowerCase()
  let hits = 0
  for (const token of queryTokens) {
    if (body.includes(token)) hits += 1
  }
  return hits
}

function recencyScore(index: number): number {
  return Math.max(0, 5 - index)
}
