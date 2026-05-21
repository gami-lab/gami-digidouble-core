import { useState } from 'react'
import type { JSX } from 'react'
import { createKnowledgeSource, listIngestionJobs, listKnowledgeSources, queryKnowledgeRetrieval, triggerIngestion } from '../api/knowledge'
import { formatApiError } from '../api/error'
import { buttonStyle } from './form-styles'
import type {
  KnowledgeSourceFormat,
  KnowledgeType,
  QueryKnowledgeRetrievalRequest,
} from '@gami/shared'

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
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeType>('world')
  const [format, setFormat] = useState<KnowledgeSourceFormat>('markdown')
  const [visibilityCsv, setVisibilityCsv] = useState('')
  const [retrievalAvatarId, setRetrievalAvatarId] = useState('')
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
        visibilityCsv={visibilityCsv}
        setVisibilityCsv={setVisibilityCsv}
        retrievalAvatarId={retrievalAvatarId}
        setRetrievalAvatarId={setRetrievalAvatarId}
      />
      <KnowledgeButtons
        disabled={disabled}
        onRegisterAndIngest={() => {
          if (scenarioId === null) return
          void registerAndIngestSource(
            { scenarioId, name, uriOrPath, knowledgeType, format, visibilityCsv },
            { setStatus, setError, setSourcesSummary, setName, setUriOrPath, setVisibilityCsv },
          )
        }}
        onRefreshSources={() => {
          if (scenarioId === null) return
          void refreshKnowledgeSources(scenarioId, setSourcesSummary, setError)
        }}
        onInspectRetrieval={() => {
          if (scenarioId === null) return
          void inspectRetrieval(
            sessionId,
            conversationId,
            scenarioId,
            retrievalAvatarId,
            setRetrievalSummary,
            setError,
          )
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
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  visibilityCsv: string
  retrievalAvatarId: string
  disabled: boolean
  setName: (value: string) => void
  setUriOrPath: (value: string) => void
  setKnowledgeType: (value: KnowledgeType) => void
  setFormat: (value: KnowledgeSourceFormat) => void
  setVisibilityCsv: (value: string) => void
  setRetrievalAvatarId: (value: string) => void
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
        onChange={(event) => { props.setKnowledgeType(event.target.value as KnowledgeType) }}
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
        onChange={(event) => { props.setFormat(event.target.value as KnowledgeSourceFormat) }}
        disabled={props.disabled}
        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
      >
        <option value="markdown">markdown</option>
        <option value="text">text</option>
        <option value="url">url</option>
        <option value="pdf">pdf</option>
        <option value="media">media</option>
      </select>
      <input
        aria-label="Knowledge visibility avatar ids"
        placeholder="Visible avatar IDs (comma-separated; blank=all)"
        value={props.visibilityCsv}
        onChange={(event) => { props.setVisibilityCsv(event.target.value) }}
        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        disabled={props.disabled}
      />
      <input
        aria-label="Retrieval active avatar id"
        placeholder="Retrieval avatar scope (optional)"
        value={props.retrievalAvatarId}
        onChange={(event) => { props.setRetrievalAvatarId(event.target.value) }}
        style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '6px' }}
        disabled={props.disabled}
      />
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
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  visibilityCsv: string
}

type RegisterAndIngestState = {
  setStatus: (v: string | null) => void
  setError: (v: string | null) => void
  setSourcesSummary: (v: string) => void
  setName: (v: string) => void
  setUriOrPath: (v: string) => void
  setVisibilityCsv: (v: string) => void
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
  const parsedVisibility = parseVisibilityCsv(input.visibilityCsv)
  if (parsedVisibility.error !== null) {
    state.setError(parsedVisibility.error)
    return
  }
  try {
    const created = await createKnowledgeSource({
      scenarioId: input.scenarioId,
      name: trimmedName,
      knowledgeType: input.knowledgeType,
      format: input.format,
      uriOrPath: trimmedUri,
      ...(parsedVisibility.visibleToAvatarIds !== undefined
        ? { visibleToAvatarIds: parsedVisibility.visibleToAvatarIds }
        : {}),
    })
    const triggered = await triggerIngestion(created.source.sourceId)
    const jobs = await listIngestionJobs(created.source.sourceId)
    state.setStatus(`Registered ${created.source.sourceId} and scheduled ${triggered.ingestionJob.ingestionJobId}.`)
    state.setSourcesSummary(
      `Source ${created.source.name} (${created.source.knowledgeType}/${created.source.format}) · visibility: ${formatVisibilityLabel(created.source.visibleToAvatarIds)} · jobs: ${String(jobs.jobs.length)}.`,
    )
    state.setName('')
    state.setUriOrPath('')
    state.setVisibilityCsv('')
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
        : `Knowledge sources: ${listed.sources
            .map(
              (source) =>
                `${source.name} [${source.status}] {visibility: ${formatVisibilityLabel(source.visibleToAvatarIds)}}`,
            )
            .join(', ')}`,
    )
  } catch (error) {
    setError(formatApiError(error, 'Failed to list knowledge sources'))
  }
}

export async function inspectRetrieval(
  sessionId: string,
  conversationId: string | null,
  scenarioId: string,
  retrievalAvatarId: string,
  setSummary: (v: string) => void,
  setError: (v: string | null) => void,
): Promise<void> {
  setError(null)
  const activeAvatarId = retrievalAvatarId.trim()
  try {
    const request: QueryKnowledgeRetrievalRequest = {
      scenarioId,
      sessionId,
      query: 'runtime_inspector_probe',
      ...(conversationId !== null ? { conversationId } : {}),
      ...(activeAvatarId.length > 0 ? { activeAvatarId } : {}),
      limitPerType: 3,
    }
    const response = await queryKnowledgeRetrieval(request)
    const { memory, world, media } = response.retrieval
    const memoryScope = firstVisibilityLabel(memory.map((item) => item.visibleToAvatarIds))
    const worldScope = firstVisibilityLabel(world.map((item) => item.visibleToAvatarIds))
    const mediaScope = firstVisibilityLabel(media.map((item) => item.visibleToAvatarIds))
    const worldVisibility = response.retrieval.trace.perType.world.visibility
    const diagnostics =
      worldVisibility === undefined
        ? 'visibility diagnostics unavailable'
        : `excluded(world)=${String(worldVisibility.excludedChunkCount)}`
    setSummary(
      `retrieval: memory=${String(memory.length)}(${memoryScope}), world=${String(world.length)}(${worldScope}), media=${String(media.length)}(${mediaScope}) · ${diagnostics}.`,
    )
  } catch (error) {
    setError(formatApiError(error, 'Failed to inspect retrieval'))
  }
}

type ParsedVisibility = {
  visibleToAvatarIds?: string[]
  error: string | null
}

export function parseVisibilityCsv(value: string): ParsedVisibility {
  const trimmed = value.trim()
  if (trimmed.length === 0) return { error: null }
  const parsed = trimmed
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  if (parsed.length === 0) {
    return { error: 'Visibility list is invalid. Use comma-separated avatar IDs or leave blank.' }
  }
  if (parsed.some((entry) => entry.includes(' '))) {
    return { error: 'Avatar IDs in visibility list must not contain spaces.' }
  }
  return { visibleToAvatarIds: parsed, error: null }
}

function formatVisibilityLabel(visibleToAvatarIds: string[] | undefined): string {
  if (visibleToAvatarIds === undefined || visibleToAvatarIds.length === 0) return 'all avatars'
  return visibleToAvatarIds.join('|')
}

function firstVisibilityLabel(candidates: Array<string[] | undefined>): string {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate.length === 0) continue
    return formatVisibilityLabel(candidate)
  }
  return 'all avatars'
}
