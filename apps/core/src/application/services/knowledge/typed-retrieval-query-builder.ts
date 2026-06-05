import type {
  LayeredMemorySnapshot,
  ShortTermMemoryExchange,
} from '../../../domain/memory/memory.types.js'

export type TypedRetrievalQueryVariant = {
  source: 'gm_guideline' | 'last_user_input' | 'working_memory' | 'direct_query'
  text: string
}

export function buildTypedRetrievalQueries(input: {
  gmGuideline?: string | null | undefined
  lastUserInput?: string | null | undefined
  memory?: LayeredMemorySnapshot | undefined
}): TypedRetrievalQueryVariant[] {
  const candidates: TypedRetrievalQueryVariant[] = [
    toQueryVariant('gm_guideline', input.gmGuideline),
    toQueryVariant('last_user_input', input.lastUserInput),
    toQueryVariant('working_memory', buildWorkingMemoryQuery(input.memory)),
  ].filter((query): query is TypedRetrievalQueryVariant => query !== undefined)

  const seen = new Set<string>()
  return candidates.filter((query) => {
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

function buildWorkingMemoryQuery(memory: LayeredMemorySnapshot | undefined): string | undefined {
  if (memory?.working === undefined) return undefined

  const sessionSummary = memory.working.session?.summary.trim()
  const avatarSummary = memory.working.avatar?.summary.trim()
  const lastExchange = toExchangeText(memory.shortTerm?.recentExchanges.at(-1))
  const query = [sessionSummary, avatarSummary, lastExchange]
    .filter((value): value is string => value !== undefined && value.length > 0)
    .join(' ')
    .trim()

  return query.length > 0 ? query : undefined
}

function toExchangeText(exchange: ShortTermMemoryExchange | undefined): string | undefined {
  if (exchange === undefined) return undefined

  const user = exchange.user.trim()
  const avatar = exchange.avatar.trim()
  const query = [`User: ${user}`, `Avatar: ${avatar}`].join(' ').trim()

  return query.length > 0 ? query : undefined
}
