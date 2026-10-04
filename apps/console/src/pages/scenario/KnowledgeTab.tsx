import { useState } from 'react'
import type { JSX } from 'react'
import {
  getKnowledgeTypeLabel,
  type AvatarSummary,
  type KnowledgeSourceDto,
  type TypedKnowledgeRetrievalDto,
} from '@gami/shared'
import { formatApiError } from '../../api/error'
import {
  listIngestionJobs,
  listKnowledgeChunks,
  listKnowledgeSources,
  queryKnowledgeRetrieval,
} from '../../api/knowledge'
import { listScenarioAvatars } from '../../api/scenarios'
import { formatDateTime } from '../../debug/format'
import { RetrievalView } from '../../debug/RetrievalView'
import { Badge, Empty, ErrorText, Section } from '../../ui/ui'
import { useAsync } from '../../ui/use-async'

export function KnowledgeTab({ scenarioId }: { scenarioId: string }): JSX.Element {
  const sources = useAsync(() => listKnowledgeSources(scenarioId), [scenarioId])
  const avatars = useAsync(() => listScenarioAvatars(scenarioId), [scenarioId])
  const sourceList = sources.data?.sources ?? []
  const sourceNames = Object.fromEntries(sourceList.map((source) => [source.sourceId, source.name]))

  return (
    <div className="stack">
      <RetrievalBench
        scenarioId={scenarioId}
        avatars={avatars.data ?? []}
        sourceNames={sourceNames}
      />
      <h2>Sources</h2>
      <ErrorText error={sources.error} />
      {sources.data !== null && sourceList.length === 0 ? (
        <Empty>No knowledge sources.</Empty>
      ) : null}
      {sourceList.map((source) => (
        <SourceSection key={source.sourceId} source={source} avatars={avatars.data ?? []} />
      ))}
    </div>
  )
}

function RetrievalBench({
  scenarioId,
  avatars,
  sourceNames,
}: {
  scenarioId: string
  avatars: AvatarSummary[]
  sourceNames: Record<string, string>
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [avatarId, setAvatarId] = useState('')
  const [limit, setLimit] = useState(3)
  const [result, setResult] = useState<TypedKnowledgeRetrievalDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  function run(): void {
    setIsRunning(true)
    setError(null)
    queryKnowledgeRetrieval({
      scenarioId,
      query: query.trim(),
      limitPerType: limit,
      ...(avatarId === '' ? {} : { activeAvatarId: avatarId }),
    })
      .then((response) => {
        setResult(response.retrieval)
      })
      .catch((queryError: unknown) => {
        setError(formatApiError(queryError, 'Retrieval failed'))
      })
      .finally(() => {
        setIsRunning(false)
      })
  }

  return (
    <Section
      defaultOpen
      title="Retrieval bench"
      aside={<span className="muted small">test what RAG returns for a query</span>}
    >
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault()
          run()
        }}
      >
        <input
          aria-label="Query"
          placeholder="What would the user ask?"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
          style={{ flex: 1, minWidth: 240 }}
        />
        <select
          aria-label="Visibility"
          value={avatarId}
          onChange={(event) => {
            setAvatarId(event.target.value)
          }}
        >
          <option value="">No avatar filter</option>
          {avatars.map((avatar) => (
            <option key={avatar.avatarId} value={avatar.avatarId}>
              As {avatar.name}
            </option>
          ))}
        </select>
        <label className="row small muted">
          per type
          <input
            type="number"
            min={1}
            max={9}
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value))
            }}
            style={{ width: 56 }}
          />
        </label>
        <button type="submit" className="primary" disabled={isRunning || query.trim() === ''}>
          {isRunning ? 'Searching…' : 'Search'}
        </button>
      </form>
      <ErrorText error={error} />
      {result !== null ? (
        <RetrievalView trace={result.trace} items={result} sourceNames={sourceNames} />
      ) : null}
    </Section>
  )
}

function SourceSection({
  source,
  avatars,
}: {
  source: KnowledgeSourceDto
  avatars: AvatarSummary[]
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const visibility =
    source.visibilityPolicy === 'avatars'
      ? `only ${(source.visibleToAvatarIds ?? [])
          .map((id) => avatars.find((avatar) => avatar.avatarId === id)?.name ?? id)
          .join(', ')}`
      : source.visibilityPolicy === 'none'
        ? 'GM only'
        : 'all avatars'

  return (
    <details
      className="section"
      onToggle={(event) => {
        setIsOpen(event.currentTarget.open)
      }}
    >
      <summary>
        <span className="summary-title">{source.name}</span>
        <span className="summary-aside">
          <Badge>{getKnowledgeTypeLabel(source.knowledgeType)}</Badge>
          <Badge>{visibility}</Badge>
          <Badge
            tone={source.status === 'ready' ? 'ok' : source.status === 'error' ? 'error' : 'warn'}
          >
            {source.status}
          </Badge>
        </span>
      </summary>
      <div className="section-body">
        {isOpen ? <SourceDetails sourceId={source.sourceId} /> : null}
      </div>
    </details>
  )
}

function SourceDetails({ sourceId }: { sourceId: string }): JSX.Element {
  const jobs = useAsync(() => listIngestionJobs(sourceId), [sourceId])
  const chunks = useAsync(() => listKnowledgeChunks(sourceId), [sourceId])
  const latestJob = [...(jobs.data?.jobs ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0]

  return (
    <>
      <ErrorText error={jobs.error ?? chunks.error} />
      {latestJob !== undefined ? (
        <p className="small">
          Last ingestion{' '}
          <Badge
            tone={
              latestJob.status === 'failed'
                ? 'error'
                : latestJob.status === 'completed'
                  ? 'ok'
                  : 'warn'
            }
          >
            {latestJob.status}
          </Badge>{' '}
          {formatDateTime(latestJob.createdAt)} · attempts {latestJob.attempts}
          {latestJob.chunkSize != null ? ` · chunk size ${String(latestJob.chunkSize)}` : ''}
          {latestJob.errorMessage ? (
            <span className="error-text"> · {latestJob.errorMessage}</span>
          ) : null}
        </p>
      ) : (
        <Empty>Never ingested.</Empty>
      )}
      {chunks.data !== null ? (
        <Section nested title={`${String(chunks.data.chunks.length)} chunks`}>
          {chunks.data.chunks
            .slice()
            .sort((a, b) => a.chunkIndex - b.chunkIndex)
            .map((chunk) => (
              <div key={chunk.chunkId} className="chunk">
                <p className="muted small">#{chunk.chunkIndex}</p>
                <p className="prewrap small">{chunk.content}</p>
              </div>
            ))}
        </Section>
      ) : null}
    </>
  )
}
