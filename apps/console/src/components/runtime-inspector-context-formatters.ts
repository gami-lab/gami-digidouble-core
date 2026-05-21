import type { RuntimeInspectorViewModel } from '../api'

type ContextTrace = RuntimeInspectorViewModel['context']['trace']
type RetrievalCounts = { memory: number; world: number; media: number }
type GmKnowledge = RuntimeInspectorViewModel['context']['gm']['knowledge']

export function formatGmKnowledgeCounts(gmKnowledge: GmKnowledge): string {
  return formatCounts(
    gmKnowledge === undefined
      ? undefined
      : {
          memory: gmKnowledge.memory.length,
          world: gmKnowledge.world.length,
          media: gmKnowledge.media.length,
        },
  )
}

export function formatTraceKeptTrimmed(trace: ContextTrace): string {
  if (trace === undefined) return '0 / 0'
  return `${String(trace.selection.kept.length)} / ${String(trace.selection.trimmed.length)}`
}

export function formatTraceRetrievalCounts(trace: ContextTrace): string {
  return formatCounts(trace?.selectedInputs.retrievalCounts)
}

export function formatTraceVisibilityExcludedCounts(trace: ContextTrace): string {
  return formatCounts(trace?.selectedInputs.visibility?.excludedCounts)
}

export function formatTraceVisibilityGmRetrievalCounts(trace: ContextTrace): string {
  return formatCounts(trace?.selectedInputs.visibility?.gmRetrievalCounts)
}

export function formatVisibility(visibleToAvatarIds: string[] | undefined): string {
  if (visibleToAvatarIds === undefined || visibleToAvatarIds.length === 0) return 'all'
  return visibleToAvatarIds.join('|')
}

function formatCounts(counts: RetrievalCounts | undefined): string {
  if (counts === undefined) return '0 / 0 / 0'
  return `${String(counts.memory)} / ${String(counts.world)} / ${String(counts.media)}`
}
