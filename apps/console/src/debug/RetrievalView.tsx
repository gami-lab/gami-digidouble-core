import type { JSX } from 'react'
import {
  getKnowledgeTypeLabel,
  type KnowledgeRetrievalReferenceDto,
  type KnowledgeType,
  type RetrievalTraceDto,
} from '@gami/shared'
import { Badge, Empty, KeyValues, Section } from '../ui/ui'
import { formatMs } from './format'

export type RetrievedItem = KnowledgeRetrievalReferenceDto & { content?: string }

export type RetrievedByType = Record<KnowledgeType, RetrievedItem[]>

const KNOWLEDGE_TYPES: KnowledgeType[] = ['avatar_knowledge', 'world', 'media']

type RetrievalViewProps = {
  trace: RetrievalTraceDto | undefined
  items: RetrievedByType
  sourceNames: Record<string, string>
}

/** Explains one retrieval: which queries ran, what was searched, and what came back. */
export function RetrievalView({ trace, items, sourceNames }: RetrievalViewProps): JSX.Element {
  const total = KNOWLEDGE_TYPES.reduce((sum, type) => sum + items[type].length, 0)
  return (
    <div className="stack">
      {trace !== undefined ? <RetrievalSummary trace={trace} /> : null}
      {total === 0 ? <Empty>No knowledge chunks were selected.</Empty> : null}
      {KNOWLEDGE_TYPES.filter((type) => items[type].length > 0).map((type) => (
        <div key={type} className="stack">
          <h3>
            {getKnowledgeTypeLabel(type)}{' '}
            <span className="muted small">({items[type].length})</span>
          </h3>
          {items[type].map((item) => (
            <ChunkView
              key={`${item.chunkId}-${String(item.queryIndex ?? 0)}`}
              item={item}
              sourceNames={sourceNames}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// eslint-disable-next-line complexity -- render-only branching
export function RetrievalSummary({ trace }: { trace: RetrievalTraceDto }): JSX.Element {
  const queries = trace.queries ?? [{ source: 'last_user_input' as const, text: trace.query }]
  return (
    <div className="stack">
      <div className="row">
        {trace.outcome !== undefined ? (
          <Badge
            tone={
              trace.outcome === 'failed' ? 'error' : trace.outcome === 'no_results' ? 'warn' : 'ok'
            }
          >
            {trace.outcome}
          </Badge>
        ) : null}
        {trace.failure !== undefined ? <Badge tone="error">{trace.failure.code}</Badge> : null}
        <span className="small muted">
          {String(trace.candidateCount ?? 0)} candidates → {String(trace.selectedCount ?? 0)}{' '}
          selected
          {trace.duplicateCount ? ` · ${String(trace.duplicateCount)} duplicates` : ''}
          {trace.selectionExcludedCount
            ? ` · ${String(trace.selectionExcludedCount)} cut by limit`
            : ''}
        </span>
      </div>
      <KeyValues
        items={[
          [
            'Queries',
            <ol className="plain" style={{ margin: 0 }}>
              {queries.map((query, index) => (
                <li key={`${String(index)}-${query.text}`}>
                  <Badge>{query.source}</Badge> {query.text}
                </li>
              ))}
            </ol>,
          ],
          [
            'Timing',
            `${formatMs(trace.timings?.totalMs)} total · embed ${formatMs(trace.timings?.queryEmbeddingMs)} · search ${formatMs(trace.timings?.vectorSearchMs)}`,
          ],
          [
            'Visibility',
            trace.gmUnrestricted === true ? 'GM (unrestricted)' : (trace.visibilityMode ?? '—'),
          ],
        ]}
      />
      <Section
        nested
        title="Per knowledge type"
        aside={<span className="muted small">sources, visibility</span>}
      >
        <table className="data">
          <thead>
            <tr>
              <th>Type</th>
              <th>Sources</th>
              <th>Chunks visible</th>
              <th>Candidates</th>
              <th>Selected</th>
            </tr>
          </thead>
          <tbody>
            {KNOWLEDGE_TYPES.map((type) => {
              const perType = trace.perType[type]
              return (
                <tr key={type}>
                  <td>{getKnowledgeTypeLabel(type)}</td>
                  <td>{perType.sourceIds.length}</td>
                  <td>{perType.visibility?.consideredChunkCount ?? '—'}</td>
                  <td>{perType.candidateCount ?? '—'}</td>
                  <td>{perType.selectedCount ?? perType.selectedChunkIds.length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {trace.embeddingProfile !== undefined ? (
          <p className="small muted">
            Embeddings: {trace.embeddingProfile.provider}/{trace.embeddingProfile.model} (
            {trace.embeddingProfile.dimensions}d)
          </p>
        ) : null}
      </Section>
    </div>
  )
}

function ChunkView({
  item,
  sourceNames,
}: {
  item: RetrievedItem
  sourceNames: Record<string, string>
}): JSX.Element {
  const similarity = item.similarity
  return (
    <div className="chunk stack" style={{ gap: 4 }}>
      <div className="row small">
        <strong>{sourceNames[item.sourceId] ?? item.sourceId}</strong>
        {similarity !== undefined ? (
          <span title={`similarity ${similarity.toFixed(3)}`}>
            <span className="similarity">
              <span style={{ width: `${String(Math.max(0, Math.min(1, similarity)) * 100)}%` }} />
            </span>{' '}
            {similarity.toFixed(2)}
          </span>
        ) : null}
        {item.matchType !== undefined ? <Badge>{item.matchType}</Badge> : null}
        {item.matchedQuery !== undefined ? (
          <span className="muted">via “{item.matchedQuery.text}”</span>
        ) : null}
      </div>
      {item.content !== undefined ? (
        <p className="prewrap small">{item.content}</p>
      ) : (
        <p className="muted small mono">chunk {item.chunkId}</p>
      )}
    </div>
  )
}
