import type { RetrievedKnowledgeItem, RetrievalQuerySource } from './knowledge.types.js'

const BALANCED_QUERY_SOURCES: RetrievalQuerySource[] = [
  'last_user_input',
  'gm_retrieval_query',
  'gm_required_fact',
]

const FALLBACK_QUERY_SOURCES: RetrievalQuerySource[] = [
  'gm_guideline',
  'working_memory',
  'world_context',
  'direct_query',
]

export type RetrievalSelectionOptions = {
  maxChunks?: number
  minimumChunksBySource?: Partial<Record<RetrievalQuerySource, number>>
}

// eslint-disable-next-line complexity
export function selectBalancedRetrievedItems(
  items: RetrievedKnowledgeItem[],
  limit: number,
  options: RetrievalSelectionOptions = {},
): RetrievedKnowledgeItem[] {
  const selected: RetrievedKnowledgeItem[] = []
  const selectedChunkIds = new Set<string>()
  const bySource = new Map<RetrievalQuerySource, RetrievedKnowledgeItem[]>()

  for (const item of items) {
    const source = item.matchedQuery?.source ?? 'direct_query'
    const entries = bySource.get(source) ?? []
    entries.push(item)
    bySource.set(source, entries)
  }

  for (const source of BALANCED_QUERY_SOURCES) {
    const minimum = options.minimumChunksBySource?.[source] ?? 1
    const candidates = bySource.get(source) ?? []
    let selectedForSource = 0
    for (const item of [...candidates].sort(compareRetrievedItems)) {
      if (selectedForSource >= minimum || selected.length >= limit) break
      if (selectedChunkIds.has(item.chunkId)) continue
      selected.push(item)
      selectedChunkIds.add(item.chunkId)
      selectedForSource += 1
    }
    if (selected.length >= limit) return sortRetrievedItems(selected)
  }

  const balancedItems = items.filter((item) =>
    BALANCED_QUERY_SOURCES.includes(item.matchedQuery?.source ?? 'direct_query'),
  )
  const hasPlannedRetrievalOrigin = items.some((item) => {
    const source = item.matchedQuery?.source
    return source === 'gm_retrieval_query' || source === 'gm_required_fact'
  })
  const fillCandidates = hasPlannedRetrievalOrigin ? balancedItems : items
  for (const item of [...fillCandidates].sort(compareRetrievedItems)) {
    if (selectedChunkIds.has(item.chunkId)) continue
    selected.push(item)
    selectedChunkIds.add(item.chunkId)
    if (selected.length >= limit) break
  }

  if (selected.length < limit) {
    for (const item of [...items].sort(compareRetrievedItems)) {
      if (selectedChunkIds.has(item.chunkId)) continue
      selected.push(item)
      selectedChunkIds.add(item.chunkId)
      if (selected.length >= limit) break
    }
  }

  return sortRetrievedItems(selected)
}

function sortRetrievedItems(items: RetrievedKnowledgeItem[]): RetrievedKnowledgeItem[] {
  return [...items].sort(compareRetrievedItems)
}

function compareRetrievedItems(a: RetrievedKnowledgeItem, b: RetrievedKnowledgeItem): number {
  const scoreDifference = (b.score ?? 0) - (a.score ?? 0)
  if (scoreDifference !== 0) return scoreDifference
  const sourceDifference = sourceRank(a.matchedQuery?.source) - sourceRank(b.matchedQuery?.source)
  if (sourceDifference !== 0) return sourceDifference
  if (a.chunkId !== b.chunkId) return a.chunkId.localeCompare(b.chunkId)
  return 0
}

function sourceRank(source: RetrievalQuerySource | undefined): number {
  const index = [...BALANCED_QUERY_SOURCES, ...FALLBACK_QUERY_SOURCES].indexOf(
    source ?? 'direct_query',
  )
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}
