import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { formatApiError } from '../api/error'
import type { KnowledgeChunkDto, KnowledgeSourceDto } from '../api/knowledge'
import { listKnowledgeChunks } from '../api/knowledge'

type ChunksState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; chunks: KnowledgeChunkDto[] }

type ScenarioKnowledgeChunksViewProps = {
  source: KnowledgeSourceDto
  onClose: () => void
}

export function ScenarioKnowledgeChunksView({
  source,
  onClose,
}: ScenarioKnowledgeChunksViewProps): JSX.Element {
  const [state, setState] = useState<ChunksState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    listKnowledgeChunks(source.sourceId)
      .then((chunks) => {
        if (!cancelled) setState({ status: 'ready', chunks })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: formatApiError(error, 'UNKNOWN_ERROR: Failed to load ingested data') })
      })
    return () => {
      cancelled = true
    }
  }, [source.sourceId])

  return (
    <>
      <div className="admin-detail-header">
        <h2>Ingested data: {source.name}</h2>
        <button type="button" className="admin-button admin-button-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="admin-muted">
        Source status: <span className="admin-status-pill">{source.status}</span>
        {' '}— this is the content Avatars and the Game Master actually see for this source once retrieved.
      </p>
      <ChunksBody state={state} />
    </>
  )
}

function ChunksBody({ state }: { state: ChunksState }): JSX.Element {
  if (state.status === 'loading') return <p>Loading ingested chunks…</p>
  if (state.status === 'error') return <p className="admin-error">{state.message}</p>
  if (state.chunks.length === 0) {
    return (
      <p className="admin-muted">
        No ingested chunks yet. If the source status above is not "ready", run Ingest first.
      </p>
    )
  }

  return (
    <ul className="admin-chunk-list">
      {state.chunks.map((chunk) => (
        <li key={chunk.chunkId} className="admin-chunk-item">
          <div className="admin-chunk-item-header">
            <strong>Chunk #{chunk.chunkIndex}</strong>
            <span className="admin-muted">{chunk.chunkId}</span>
          </div>
          <pre className="admin-chunk-content">{chunk.content}</pre>
          {chunk.metadata === undefined ? null : (
            <details>
              <summary className="admin-muted">Metadata</summary>
              <pre className="admin-chunk-content">{JSON.stringify(chunk.metadata, null, 2)}</pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  )
}
