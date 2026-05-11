import { useState } from 'react'
import type { JSX } from 'react'
import { createKnowledgeSource, listIngestionJobs, listKnowledgeSources, queryKnowledgeRetrieval, triggerIngestion } from '../api/knowledge'
import { formatApiError } from '../api/error'
import { buttonStyle } from './form-styles'

type KnowledgeOperationsPanelProps = {
  scenarioId: string | null
  sessionId: string
  conversationId: string | null
}

export function KnowledgeOperationsPanel({
  scenarioId,
  sessionId,
  conversationId,
}: KnowledgeOperationsPanelProps): JSX.Element {
  const [name, setName] = useState('')
  const [uriOrPath, setUriOrPath] = useState('')
  const [knowledgeType, setKnowledgeType] = useState<'memory' | 'world' | 'media'>('world')
  const [format, setFormat] = useState<'pdf' | 'text' | 'markdown' | 'url' | 'media'>('markdown')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sourcesSummary, setSourcesSummary] = useState<string>('')
  const [retrievalSummary, setRetrievalSummary] = useState<string>('')
  const disabled = scenarioId === null

  return (
    <div style={{ marginTop: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px' }}>
      <strong>Knowledge operations</strong>
      <p style={{ margin: '6px 0', color: '#4b5563' }}>
        Register sources, trigger ingestion, and inspect retrieval for this session.
      </p>
      <KnowledgeInputFields
        name={name}
        uriOrPath={uriOrPath}
        knowledgeType={knowledgeType}
        format={format}
        disabled={disabled}
        setName={setName}
        setUriOrPath={setUriOrPath}
        setKnowledgeType={setKnowledgeType}
        setFormat={setFormat}
      />
      <KnowledgeButtons
        disabled={disabled}
        onRegisterAndIngest={() => {
          if (scenarioId === null) return
          void registerAndIngestSource(
            { scenarioId, name, uriOrPath, knowledgeType, format },
            { setStatus, setError, setSourcesSummary, setName, setUriOrPath },
          )
        }}
        onRefreshSources={() => {
          if (scenarioId === null) return
          void refreshKnowledgeSources(scenarioId, setSourcesSummary, setError)
        }}
        onInspectRetrieval={() => {
          if (scenarioId === null) return
          void inspectRetrieval(sessionId, conversationId, scenarioId, setRetrievalSummary, setError)
        }}
      />
      {status !== null ? <p style={{ margin: '6px 0', color: '#166534' }}>{status}</p> : null}
      {sourcesSummary.length > 0 ? <p style={{ margin: '6px 0', color: '#1f2937' }}>{sourcesSummary}</p> : null}
      {retrievalSummary.length > 0 ? <p style={{ margin: '6px 0', color: '#1f2937' }}>{retrievalSummary}</p> : null}
      {error !== null ? <p style={{ margin: '6px 0', color: '#b91c1c' }}>{error}</p> : null}
    </div>
  )
}

type KnowledgeInputFieldsProps = {
  name: string
  uriOrPath: string
  knowledgeType: 'memory' | 'world' | 'media'
  format: 'pdf' | 'text' | 'markdown' | 'url' | 'media'
  disabled: boolean
  setName: (value: string) => void
  setUriOrPath: (value: string) => void
  setKnowledgeType: (value: 'memory' | 'world' | 'media') => void
  setFormat: (value: 'pdf' | 'text' | 'markdown' | 'url' | 'media') => void
}

function KnowledgeInputFields(props: KnowledgeInputFieldsProps): JSX.Element {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      <input
        aria-label="Knowledge name"
        placeholder="Source name"
        value={props.name}
        onChange={(event) => { props.setName(event.target.value) }}
        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        disabled={props.disabled}
      />
      <input
        aria-label="Knowledge uri"
        placeholder="URI or path"
        value={props.uriOrPath}
        onChange={(event) => { props.setUriOrPath(event.target.value) }}
        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        disabled={props.disabled}
      />
      <select
        aria-label="Knowledge type"
        value={props.knowledgeType}
        onChange={(event) => { props.setKnowledgeType(event.target.value as 'memory' | 'world' | 'media') }}
        disabled={props.disabled}
        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
      >
        <option value="memory">memory</option>
        <option value="world">world</option>
        <option value="media">media</option>
      </select>
      <select
        aria-label="Knowledge format"
        value={props.format}
        onChange={(event) => { props.setFormat(event.target.value as 'pdf' | 'text' | 'markdown' | 'url' | 'media') }}
        disabled={props.disabled}
        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
      >
        <option value="markdown">markdown</option>
        <option value="text">text</option>
        <option value="url">url</option>
        <option value="pdf">pdf</option>
        <option value="media">media</option>
      </select>
    </div>
  )
}

type KnowledgeButtonsProps = {
  disabled: boolean
  onRegisterAndIngest: () => void
  onRefreshSources: () => void
  onInspectRetrieval: () => void
}

function KnowledgeButtons(props: KnowledgeButtonsProps): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
      <button type="button" style={{ ...buttonStyle, marginTop: 0, fontSize: '12px', padding: '6px 10px' }} disabled={props.disabled} onClick={props.onRegisterAndIngest}>
        Register + ingest
      </button>
      <button type="button" style={{ ...buttonStyle, marginTop: 0, fontSize: '12px', padding: '6px 10px' }} disabled={props.disabled} onClick={props.onRefreshSources}>
        Refresh sources
      </button>
      <button type="button" style={{ ...buttonStyle, marginTop: 0, fontSize: '12px', padding: '6px 10px' }} disabled={props.disabled} onClick={props.onInspectRetrieval}>
        Inspect retrieval
      </button>
    </div>
  )
}

type RegisterAndIngestInput = {
  scenarioId: string
  name: string
  uriOrPath: string
  knowledgeType: 'memory' | 'world' | 'media'
  format: 'pdf' | 'text' | 'markdown' | 'url' | 'media'
}

type RegisterAndIngestState = {
  setStatus: (v: string | null) => void
  setError: (v: string | null) => void
  setSourcesSummary: (v: string) => void
  setName: (v: string) => void
  setUriOrPath: (v: string) => void
}

export async function registerAndIngestSource(input: RegisterAndIngestInput, state: RegisterAndIngestState): Promise<void> {
  state.setError(null)
  state.setStatus(null)
  const trimmedName = input.name.trim()
  const trimmedUri = input.uriOrPath.trim()
  if (trimmedName.length === 0 || trimmedUri.length === 0) {
    state.setError('Source name and URI/path are required.')
    return
  }
  try {
    const created = await createKnowledgeSource({
      scenarioId: input.scenarioId,
      name: trimmedName,
      knowledgeType: input.knowledgeType,
      format: input.format,
      uriOrPath: trimmedUri,
    })
    const triggered = await triggerIngestion(created.source.sourceId)
    const jobs = await listIngestionJobs(created.source.sourceId)
    state.setStatus(`Registered ${created.source.sourceId} and scheduled ${triggered.ingestionJob.ingestionJobId}.`)
    state.setSourcesSummary(`Source ${created.source.name} (${created.source.knowledgeType}/${created.source.format}) · jobs: ${String(jobs.jobs.length)}.`)
    state.setName('')
    state.setUriOrPath('')
  } catch (error) {
    state.setError(formatApiError(error, 'Failed to register/ingest knowledge source'))
  }
}

export async function refreshKnowledgeSources(
  scenarioId: string,
  setSummary: (v: string) => void,
  setError: (v: string | null) => void,
): Promise<void> {
  setError(null)
  try {
    const listed = await listKnowledgeSources(scenarioId)
    setSummary(
      listed.sources.length === 0
        ? 'No knowledge sources registered.'
        : `Knowledge sources: ${listed.sources.map((source) => `${source.name} [${source.status}]`).join(', ')}`,
    )
  } catch (error) {
    setError(formatApiError(error, 'Failed to list knowledge sources'))
  }
}

export async function inspectRetrieval(
  sessionId: string,
  conversationId: string | null,
  scenarioId: string,
  setSummary: (v: string) => void,
  setError: (v: string | null) => void,
): Promise<void> {
  setError(null)
  try {
    const response = await queryKnowledgeRetrieval({
      scenarioId,
      sessionId,
      query: 'runtime_inspector_probe',
      ...(conversationId !== null ? { conversationId } : {}),
      limitPerType: 3,
    })
    const { memory, world, media } = response.retrieval
    setSummary(`retrieval: memory=${String(memory.length)}, world=${String(world.length)}, media=${String(media.length)}.`)
  } catch (error) {
    setError(formatApiError(error, 'Failed to inspect retrieval'))
  }
}
