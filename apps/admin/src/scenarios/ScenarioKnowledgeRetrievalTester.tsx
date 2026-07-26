import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import type { AvatarSummary, KnowledgeType, RetrievedKnowledgeItemDto } from '@gami/shared'
import { formatApiError } from '../api/error'
import type { KnowledgeSourceDto, TypedKnowledgeRetrievalDto } from '../api/knowledge'
import { queryKnowledgeRetrieval } from '../api/knowledge'

type ScenarioKnowledgeRetrievalTesterProps = {
  scenarioId: string
  avatars: Pick<AvatarSummary, 'avatarId' | 'name'>[]
  knowledgeSources: KnowledgeSourceDto[]
  onClose: () => void
}

type ResultState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; retrieval: TypedKnowledgeRetrievalDto }

type MemoryScope = { sessionId: string; userId: string; conversationId: string }

const KNOWLEDGE_TYPES: KnowledgeType[] = ['memory', 'world', 'media']

export function ScenarioKnowledgeRetrievalTester({
  scenarioId,
  avatars,
  knowledgeSources,
  onClose,
}: ScenarioKnowledgeRetrievalTesterProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [activeAvatarId, setActiveAvatarId] = useState('')
  const [memoryScope, setMemoryScope] = useState<MemoryScope>({
    sessionId: '',
    userId: '',
    conversationId: '',
  })
  const [result, setResult] = useState<ResultState>({ status: 'idle' })

  const sourceNamesById = new Map(
    knowledgeSources.map((source) => [source.sourceId, source.name] as const),
  )
  const loading = result.status === 'loading'

  async function handleSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault()
    if (query.trim().length === 0) return
    setResult({ status: 'loading' })
    try {
      const retrieval = await queryKnowledgeRetrieval(
        buildRetrievalRequest(scenarioId, query, activeAvatarId, memoryScope),
      )
      setResult({ status: 'ready', retrieval })
    } catch (error: unknown) {
      setResult({
        status: 'error',
        message: formatApiError(error, 'UNKNOWN_ERROR: Retrieval failed'),
      })
    }
  }

  return (
    <>
      <div className="admin-detail-header">
        <h2>Test retrieval</h2>
        <button type="button" className="admin-button admin-button-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="admin-muted">
        Runs the same typed retrieval Avatars and the Game Master use at runtime, so you can see
        exactly which chunks a query would surface — and why. Leave &quot;Active avatar&quot; empty
        to see the Game Master&apos;s unrestricted view.
      </p>

      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
      >
        <div className="admin-form-group">
          <label htmlFor="rag-query" className="admin-form-label">
            Query <span aria-hidden="true">*</span>
          </label>
          <input
            id="rag-query"
            type="text"
            className="admin-form-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
            }}
            required
            disabled={loading}
          />
        </div>

        <RetrievalAvatarField
          avatars={avatars}
          activeAvatarId={activeAvatarId}
          loading={loading}
          onChange={setActiveAvatarId}
        />
        <RetrievalMemoryScopeFields
          memoryScope={memoryScope}
          loading={loading}
          onChange={setMemoryScope}
        />

        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={loading || query.trim().length === 0}
          >
            {loading ? 'Running…' : 'Run retrieval'}
          </button>
        </div>
      </form>

      <RetrievalResult
        result={result}
        sourceNamesById={sourceNamesById}
        knowledgeSources={knowledgeSources}
      />
    </>
  )
}

function buildRetrievalRequest(
  scenarioId: string,
  query: string,
  activeAvatarId: string,
  memoryScope: MemoryScope,
) {
  return {
    scenarioId,
    query: query.trim(),
    ...(activeAvatarId.length > 0 ? { activeAvatarId } : {}),
    ...(memoryScope.sessionId.trim().length > 0 ? { sessionId: memoryScope.sessionId.trim() } : {}),
    ...(memoryScope.userId.trim().length > 0 ? { userId: memoryScope.userId.trim() } : {}),
    ...(memoryScope.conversationId.trim().length > 0
      ? { conversationId: memoryScope.conversationId.trim() }
      : {}),
  }
}

function RetrievalAvatarField({
  avatars,
  activeAvatarId,
  loading,
  onChange,
}: {
  avatars: Pick<AvatarSummary, 'avatarId' | 'name'>[]
  activeAvatarId: string
  loading: boolean
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <div className="admin-form-group">
      <label htmlFor="rag-avatar" className="admin-form-label">
        Active avatar (visibility filter)
      </label>
      <select
        id="rag-avatar"
        className="admin-form-select"
        value={activeAvatarId}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        disabled={loading}
      >
        <option value="">— Game Master (unrestricted) —</option>
        {avatars.map((avatar) => (
          <option key={avatar.avatarId} value={avatar.avatarId}>
            {avatar.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function RetrievalMemoryScopeFields({
  memoryScope,
  loading,
  onChange,
}: {
  memoryScope: MemoryScope
  loading: boolean
  onChange: (value: MemoryScope) => void
}): JSX.Element {
  return (
    <details>
      <summary className="admin-muted">Advanced (memory scope)</summary>
      <div className="admin-form-group">
        <label htmlFor="rag-session" className="admin-form-label">
          Session ID
        </label>
        <input
          id="rag-session"
          type="text"
          className="admin-form-input"
          value={memoryScope.sessionId}
          onChange={(event) => {
            onChange({ ...memoryScope, sessionId: event.target.value })
          }}
          disabled={loading}
        />
      </div>
      <div className="admin-form-group">
        <label htmlFor="rag-user" className="admin-form-label">
          User ID
        </label>
        <input
          id="rag-user"
          type="text"
          className="admin-form-input"
          value={memoryScope.userId}
          onChange={(event) => {
            onChange({ ...memoryScope, userId: event.target.value })
          }}
          disabled={loading}
        />
      </div>
      <div className="admin-form-group">
        <label htmlFor="rag-conversation" className="admin-form-label">
          Conversation ID
        </label>
        <input
          id="rag-conversation"
          type="text"
          className="admin-form-input"
          value={memoryScope.conversationId}
          onChange={(event) => {
            onChange({ ...memoryScope, conversationId: event.target.value })
          }}
          disabled={loading}
        />
      </div>
    </details>
  )
}

function RetrievalResult({
  result,
  sourceNamesById,
  knowledgeSources,
}: {
  result: ResultState
  sourceNamesById: Map<string, string>
  knowledgeSources: KnowledgeSourceDto[]
}): JSX.Element | null {
  if (result.status === 'idle') return null
  if (result.status === 'loading') return <p>Running retrieval…</p>
  if (result.status === 'error') return <p className="admin-error">{result.message}</p>

  return (
    <>
      <p className="admin-muted">
        Inputs used:{' '}
        {result.retrieval.trace.queries
          ?.map((input) => `${input.source}=${input.text}`)
          .join(' · ') ?? result.retrieval.trace.query}
      </p>
      {result.retrieval.memory.length === 0 &&
      result.retrieval.world.length === 0 &&
      result.retrieval.media.length === 0 ? (
        <p className="admin-muted">
          No chunks matched. Ready sources:{' '}
          {String(knowledgeSources.filter((source) => source.status === 'ready').length)}. Ingestion
          must be completed before retrieval can return chunks.
        </p>
      ) : null}
      {KNOWLEDGE_TYPES.map((type) => (
        <RetrievalTypeSection
          key={type}
          type={type}
          items={result.retrieval[type]}
          sourceNamesById={sourceNamesById}
        />
      ))}
    </>
  )
}

function RetrievalTypeSection({
  type,
  items,
  sourceNamesById,
}: {
  type: KnowledgeType
  items: RetrievedKnowledgeItemDto[]
  sourceNamesById: Map<string, string>
}): JSX.Element {
  return (
    <>
      <h3>
        {type} <span className="admin-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="admin-muted">No {type} chunks matched.</p>
      ) : (
        <ul className="admin-chunk-list">
          {items.map((item) => (
            <li key={item.chunkId} className="admin-chunk-item">
              <div className="admin-chunk-item-header">
                <strong>{sourceNamesById.get(item.sourceId) ?? item.sourceId}</strong>
                <span className="admin-muted">
                  {item.score !== undefined ? `score ${item.score.toFixed(2)}` : null}
                  {item.reason !== undefined ? ` · ${item.reason}` : null}
                </span>
              </div>
              <pre className="admin-chunk-content">{item.content}</pre>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
