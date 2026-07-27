import type { ShortTermMemoryExchange } from '../../../domain/memory/memory.types.js'
import type { RetrievalQueryVariant } from '../../../domain/knowledge/knowledge.types.js'

export type TypedRetrievalQueryVariant = RetrievalQueryVariant

export function buildAvatarTypedRetrievalQueries(input: {
  gmGuideline?: string | null | undefined
  gmRetrievalQueries?: string[] | null | undefined
  gmRequiredFacts?: string[] | null | undefined
  lastUserInput?: string | null | undefined
  workingMemorySummary?: string | null | undefined
  recentExchanges?: ShortTermMemoryExchange[] | undefined
}): TypedRetrievalQueryVariant[] {
  const plannedQueries = input.gmRetrievalQueries ?? []
  const requiredFacts = input.gmRequiredFacts ?? []
  const usePlannedRetrieval = shouldUsePlannedRetrieval(input.lastUserInput, [
    ...plannedQueries,
    ...requiredFacts,
  ])
  const candidates: TypedRetrievalQueryVariant[] = [
    toQueryVariant('gm_guideline', usePlannedRetrieval ? input.gmGuideline : undefined),
    ...(usePlannedRetrieval ? toQueryVariants('gm_retrieval_query', plannedQueries) : []),
    ...(usePlannedRetrieval ? toQueryVariants('gm_required_fact', requiredFacts) : []),
    toQueryVariant('last_user_input', input.lastUserInput),
    toQueryVariant(
      'working_memory',
      buildMemoryAndExchangeQuery(input.workingMemorySummary, input.recentExchanges),
    ),
  ].filter((query): query is TypedRetrievalQueryVariant => query !== undefined)

  return deduplicateQueries(candidates)
}

// eslint-disable-next-line complexity
function shouldUsePlannedRetrieval(
  lastUserInput: string | null | undefined,
  plannedQueries: string[],
): boolean {
  if (plannedQueries.length === 0) return true

  const userText = lastUserInput?.trim() ?? ''
  if (userText.length === 0) return true

  const normalized = userText.toLowerCase()
  if (
    normalized.includes('instead') ||
    normalized.includes('different topic') ||
    normalized.includes('change the subject') ||
    normalized.includes('parlons de') ||
    normalized.includes('parle-moi de')
  ) {
    return false
  }

  const userTokens = meaningfulTokens(userText)
  const plannedTokens = new Set(meaningfulTokens(plannedQueries.join(' ')))
  if (userTokens.some((token) => plannedTokens.has(token))) return true

  if (/\b(feel|feeling|feelings|emotion|émotion|ressens|sentir)\b/i.test(userText)) {
    return false
  }

  return userTokens.length === 0 || isExplicitContinuation(userText)
}

function isExplicitContinuation(userText: string): boolean {
  return /\b(and|also|still|then|next|more about|tell me more|what about|how about)\b/i.test(
    userText,
  )
}

function meaningfulTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9à-ÿ]+/i)
    .filter((token) => token.length >= 4 && !RETRIEVAL_STOP_WORDS.has(token))
}

const RETRIEVAL_STOP_WORDS = new Set([
  'about',
  'after',
  'does',
  'from',
  'have',
  'what',
  'when',
  'where',
  'which',
  'with',
])

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

function toQueryVariants(
  source: TypedRetrievalQueryVariant['source'],
  values: string[],
): TypedRetrievalQueryVariant[] {
  return values
    .map((value) => toQueryVariant(source, value))
    .filter((query): query is TypedRetrievalQueryVariant => query !== undefined)
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
