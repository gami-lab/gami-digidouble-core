import type { ShortTermMemoryExchange } from '../../../domain/memory/memory.types.js'

export type TypedRetrievalQueryVariant = {
  source: 'gm_guideline' | 'last_user_input' | 'working_memory' | 'world_context' | 'direct_query'
  text: string
}

export function buildAvatarTypedRetrievalQueries(input: {
  gmGuideline?: string | null | undefined
  lastUserInput?: string | null | undefined
  workingMemorySummary?: string | null | undefined
  recentExchanges?: ShortTermMemoryExchange[] | undefined
}): TypedRetrievalQueryVariant[] {
  const candidates: TypedRetrievalQueryVariant[] = [
    toQueryVariant('gm_guideline', input.gmGuideline),
    toQueryVariant('last_user_input', input.lastUserInput),
    toQueryVariant(
      'working_memory',
      buildMemoryAndExchangeQuery(input.workingMemorySummary, input.recentExchanges),
    ),
  ].filter((query): query is TypedRetrievalQueryVariant => query !== undefined)

  return deduplicateQueries(candidates)
}

export function buildGameMasterTypedRetrievalQueries(input: {
  worldContext?: string | null | undefined
  workingMemorySummary?: string | null | undefined
  recentExchanges?: ShortTermMemoryExchange[] | undefined
}): TypedRetrievalQueryVariant[] {
  const candidates: TypedRetrievalQueryVariant[] = [
    toQueryVariant('world_context', input.worldContext),
    toQueryVariant(
      'working_memory',
      buildMemoryAndExchangeQuery(input.workingMemorySummary, input.recentExchanges),
    ),
  ].filter((query): query is TypedRetrievalQueryVariant => query !== undefined)

  return deduplicateQueries(candidates)
}

function deduplicateQueries(queries: TypedRetrievalQueryVariant[]): TypedRetrievalQueryVariant[] {
  const seen = new Set<string>()
  return queries.filter((query) => {
    const normalized = query.text.toLowerCase()
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

export function flattenTypedRetrievalQueries(queries: TypedRetrievalQueryVariant[]): string {
  return queries
    .map((query) => query.text.trim())
    .filter((text) => text.length > 0)
    .join(' | ')
}

function toQueryVariant(
  source: TypedRetrievalQueryVariant['source'],
  value: string | null | undefined,
): TypedRetrievalQueryVariant | undefined {
  const text = value?.trim()
  if (text === undefined || text.length === 0) return undefined
  return { source, text }
}

function buildMemoryAndExchangeQuery(
  workingMemorySummary: string | null | undefined,
  recentExchanges: ShortTermMemoryExchange[] | undefined,
): string | undefined {
  const exchangeText = (recentExchanges ?? [])
    .map((exchange) => toExchangeText(exchange))
    .filter((value): value is string => value !== undefined)
    .join(' ')
    .trim()
  const query = [workingMemorySummary?.trim(), exchangeText]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(' ')
    .trim()

  return query.length > 0 ? query : undefined
}

function toExchangeText(exchange: ShortTermMemoryExchange): string | undefined {
  const user = exchange.user.trim()
  const avatar = exchange.avatar.trim()
  const query = [`User: ${user}`, `Avatar: ${avatar}`].join(' ').trim()

  return query.length > 0 ? query : undefined
}
