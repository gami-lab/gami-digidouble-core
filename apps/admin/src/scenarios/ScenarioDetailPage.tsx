import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { AvatarSummary, IngestionJobDto, ScenarioAvatarAvailability, ScenarioSummary } from '@gami/shared'
import { ApiError } from '../api/client'
import { formatApiError } from '../api/error'
import { deleteAvatar, getScenario, listScenarioAvatars, updateScenario } from '../api/scenarios'
import type { KnowledgeSourceDto } from '../api/knowledge'
import {
  deleteKnowledgeSource,
  getIngestionJob,
  listKnowledgeSources,
  triggerIngestion,
} from '../api/knowledge'
import { AvatarCreateForm, AvatarEditForm } from './ScenarioAvatarForms'
import { ScenarioEditForm } from './ScenarioEditForm'
import { KnowledgeSourceCreateForm, KnowledgeSourceEditForm } from './ScenarioKnowledgeSourceForms'
import { ScenarioKnowledgeChunksView } from './ScenarioKnowledgeChunksView'
import { ScenarioKnowledgeRetrievalTester } from './ScenarioKnowledgeRetrievalTester'
import { ScenarioView } from './ScenarioDetailView'
import type { IngestUiStatus } from './ScenarioDetailView'

const INGESTION_POLL_INTERVAL_MS = 1200
const INGESTION_POLL_MAX_ATTEMPTS = 30

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key))
}

async function pollIngestionJob(ingestionJobId: string): Promise<IngestionJobDto> {
  for (let attempt = 0; attempt < INGESTION_POLL_MAX_ATTEMPTS; attempt += 1) {
    const job = await getIngestionJob(ingestionJobId)
    if (job.status === 'completed' || job.status === 'failed') return job
    await sleep(INGESTION_POLL_INTERVAL_MS)
  }
  throw new ApiError('TIMEOUT', 'Ingestion is taking longer than expected. Check back shortly.')
}

function computeNextAvailability(
  current: ScenarioAvatarAvailability,
  avatarId: string,
  visible: boolean,
): ScenarioAvatarAvailability {
  const initial = current.initialAvatarIds
  const unlockable = current.unlockableAvatarIds ?? []
  const nextInitial = visible
    ? initial.includes(avatarId) ? initial : [...initial, avatarId]
    : initial.filter((id) => id !== avatarId)
  const nextUnlockable = visible
    ? unlockable.filter((id) => id !== avatarId)
    : unlockable.includes(avatarId) ? unlockable : [...unlockable, avatarId]
  return {
    initialAvatarIds: nextInitial,
    ...(nextUnlockable.length > 0 ? { unlockableAvatarIds: nextUnlockable } : {}),
  }
}

type ScenarioDetailPageProps = {
  scenarioId: string
  onBack: () => void
}

type DetailMode =
  | { kind: 'view' }
  | { kind: 'editing-scenario' }
  | { kind: 'creating-avatar' }
  | { kind: 'editing-avatar'; avatarId: string }
  | { kind: 'creating-knowledge' }
  | { kind: 'editing-knowledge'; sourceId: string }
  | { kind: 'viewing-knowledge-chunks'; sourceId: string }
  | { kind: 'testing-retrieval' }

type DetailData = {
  scenario: ScenarioSummary
  avatars: AvatarSummary[]
  knowledgeSources: KnowledgeSourceDto[]
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DetailData; mode: DetailMode; actionError: string | null }

type ReadyStateUpdates = Partial<{
  data: DetailData
  mode: DetailMode
  actionError: string | null
}>

type SetIngestStatus = (updater: (prev: Record<string, IngestUiStatus>) => Record<string, IngestUiStatus>) => void
type SetDetailState = (state: DetailState) => void
type SetDetailMode = (mode: DetailMode) => void
type SetDetailActionError = (message: string) => void
type RefreshDetailData = (updated: Partial<DetailData>) => void
type MakeReadyState = (updates: ReadyStateUpdates) => DetailState

export function ScenarioDetailPage({ scenarioId, onBack }: ScenarioDetailPageProps): JSX.Element {
  const [state, setState] = useState<DetailState>({ status: 'loading' })
  const [ingestStatus, setIngestStatus] = useState<Record<string, IngestUiStatus>>({})

  function loadData(): void {
    setState({ status: 'loading' })
    Promise.all([getScenario(scenarioId), listScenarioAvatars(scenarioId), listKnowledgeSources(scenarioId)])
      .then(([scenario, avatars, knowledgeSources]) => {
        setState({ status: 'ready', data: { scenario, avatars, knowledgeSources }, mode: { kind: 'view' }, actionError: null })
      })
      .catch((error: unknown) => {
        setState({
          status: 'error',
          message: formatApiError(error, 'UNKNOWN_ERROR: Failed to load scenario'),
        })
      })
  }

  useEffect(() => {
    loadData()
  }, [scenarioId])

  return (
    <section className="admin-card">
      <button type="button" className="admin-link-button" onClick={onBack}>
        ← Back to scenarios
      </button>
      <DetailBody
        state={state}
        onSetState={setState}
        ingestStatus={ingestStatus}
        onSetIngestStatus={setIngestStatus}
      />
    </section>
  )
}

type DetailBodyProps = {
  state: DetailState
  onSetState: SetDetailState
  ingestStatus: Record<string, IngestUiStatus>
  onSetIngestStatus: SetIngestStatus
}

function DetailBody({ state, onSetState, ingestStatus, onSetIngestStatus }: DetailBodyProps): JSX.Element {
  if (state.status === 'loading') return <p>Loading scenario…</p>
  if (state.status === 'error') return <p className="admin-error">{state.message}</p>
  return (
    <ReadyDetailBody
      data={state.data}
      mode={state.mode}
      actionError={state.actionError}
      onSetState={onSetState}
      ingestStatus={ingestStatus}
      onSetIngestStatus={onSetIngestStatus}
    />
  )
}

type ReadyDetailBodyProps = {
  data: DetailData
  mode: DetailMode
  actionError: string | null
  onSetState: SetDetailState
  ingestStatus: Record<string, IngestUiStatus>
  onSetIngestStatus: SetIngestStatus
}

function ReadyDetailBody({
  data,
  mode,
  actionError,
  onSetState,
  ingestStatus,
  onSetIngestStatus,
}: ReadyDetailBodyProps): JSX.Element {
  const makeReady: MakeReadyState = (updates) => ({
    status: 'ready',
    data: updates.data ?? data,
    mode: updates.mode ?? mode,
    actionError: updates.actionError !== undefined ? updates.actionError : actionError,
  })

  const setMode: SetDetailMode = (next) => {
    onSetState(makeReady({ mode: next, actionError: null }))
  }
  const setActionError: SetDetailActionError = (message) => {
    onSetState(makeReady({ actionError: message }))
  }
  const refreshData: RefreshDetailData = (updated) => {
    onSetState(makeReady({ data: { ...data, ...updated }, mode: { kind: 'view' }, actionError: null }))
  }

  const modePanel = renderModePanel({ data, mode, refreshData, setMode, setActionError })
  if (modePanel !== null) return modePanel

  return (
    <ScenarioViewContainer
      data={data}
      actionError={actionError}
      onSetState={onSetState}
      makeReady={makeReady}
      setMode={setMode}
      setActionError={setActionError}
      ingestStatus={ingestStatus}
      onSetIngestStatus={onSetIngestStatus}
    />
  )
}

type RenderModePanelArgs = {
  data: DetailData
  mode: DetailMode
  refreshData: RefreshDetailData
  setMode: SetDetailMode
  setActionError: SetDetailActionError
}

function renderModePanel({
  data,
  mode,
  refreshData,
  setMode,
  setActionError,
}: RenderModePanelArgs): JSX.Element | null {
  switch (mode.kind) {
    case 'editing-scenario':
      return (
        <ScenarioEditForm
          scenario={data.scenario}
          onCancel={() => { setMode({ kind: 'view' }) }}
          onSaved={(scenario) => { refreshData({ scenario }) }}
          onError={setActionError}
        />
      )
    case 'creating-avatar':
      return (
        <AvatarCreateForm
          scenarioId={data.scenario.scenarioId}
          onCancel={() => { setMode({ kind: 'view' }) }}
          onCreated={(avatar) => { refreshData({ avatars: [avatar, ...data.avatars] }) }}
          onError={setActionError}
        />
      )
    case 'editing-avatar':
      return renderAvatarEditMode(data, mode.avatarId, refreshData, setMode, setActionError)
    case 'creating-knowledge':
      return (
        <KnowledgeSourceCreateForm
          scenarioId={data.scenario.scenarioId}
          avatars={data.avatars}
          onCancel={() => { setMode({ kind: 'view' }) }}
          onCreated={(source) => { refreshData({ knowledgeSources: [source, ...data.knowledgeSources] }) }}
          onError={setActionError}
        />
      )
    case 'editing-knowledge':
      return renderKnowledgeEditMode(data, mode.sourceId, refreshData, setMode, setActionError)
    case 'viewing-knowledge-chunks':
      return renderKnowledgeChunksMode(data, mode.sourceId, setMode)
    case 'testing-retrieval':
      return (
        <ScenarioKnowledgeRetrievalTester
          scenarioId={data.scenario.scenarioId}
          avatars={data.avatars}
          knowledgeSources={data.knowledgeSources}
          onClose={() => { setMode({ kind: 'view' }) }}
        />
      )
    case 'view':
      return null
  }
}

function renderKnowledgeChunksMode(
  data: DetailData,
  sourceId: string,
  setMode: SetDetailMode,
): JSX.Element {
  const source = data.knowledgeSources.find((item) => item.sourceId === sourceId)
  if (source === undefined) {
    setMode({ kind: 'view' })
    return <p>Knowledge source not found.</p>
  }

  return <ScenarioKnowledgeChunksView source={source} onClose={() => { setMode({ kind: 'view' }) }} />
}

function renderAvatarEditMode(
  data: DetailData,
  avatarId: string,
  refreshData: RefreshDetailData,
  setMode: SetDetailMode,
  setActionError: SetDetailActionError,
): JSX.Element {
  const avatar = data.avatars.find((item) => item.avatarId === avatarId)
  if (avatar === undefined) {
    setMode({ kind: 'view' })
    return <p>Avatar not found.</p>
  }

  return (
    <AvatarEditForm
      avatar={avatar}
      onCancel={() => { setMode({ kind: 'view' }) }}
      onSaved={(updated) => {
        refreshData({ avatars: data.avatars.map((item) => (item.avatarId === updated.avatarId ? updated : item)) })
      }}
      onError={setActionError}
    />
  )
}

function renderKnowledgeEditMode(
  data: DetailData,
  sourceId: string,
  refreshData: RefreshDetailData,
  setMode: SetDetailMode,
  setActionError: SetDetailActionError,
): JSX.Element {
  const source = data.knowledgeSources.find((item) => item.sourceId === sourceId)
  if (source === undefined) {
    setMode({ kind: 'view' })
    return <p>Knowledge source not found.</p>
  }

  return (
    <KnowledgeSourceEditForm
      source={source}
      avatars={data.avatars}
      onCancel={() => { setMode({ kind: 'view' }) }}
      onSaved={(updated) => {
        refreshData({
          knowledgeSources: data.knowledgeSources.map((item) => (item.sourceId === updated.sourceId ? updated : item)),
        })
      }}
      onError={setActionError}
    />
  )
}

type ScenarioViewContainerProps = {
  data: DetailData
  actionError: string | null
  onSetState: SetDetailState
  makeReady: MakeReadyState
  setMode: SetDetailMode
  setActionError: SetDetailActionError
  ingestStatus: Record<string, IngestUiStatus>
  onSetIngestStatus: SetIngestStatus
}

function ScenarioViewContainer({
  data,
  actionError,
  onSetState,
  makeReady,
  setMode,
  setActionError,
  ingestStatus,
  onSetIngestStatus,
}: ScenarioViewContainerProps): JSX.Element {
  async function handleDeleteAvatar(avatarId: string): Promise<void> {
    try {
      await deleteAvatar(avatarId)
      onSetState(makeReady({ data: { ...data, avatars: data.avatars.filter((avatar) => avatar.avatarId !== avatarId) }, actionError: null }))
    } catch (error: unknown) {
      setActionError(formatApiError(error, 'UNKNOWN_ERROR: Failed to delete avatar'))
    }
  }

  async function handleToggleVisibility(avatarId: string, visible: boolean): Promise<void> {
    try {
      const avatarAvailability = computeNextAvailability(data.scenario.avatarAvailability, avatarId, visible)
      const scenario = await updateScenario(data.scenario.scenarioId, { avatarAvailability })
      onSetState(makeReady({ data: { ...data, scenario }, actionError: null }))
    } catch (error: unknown) {
      setActionError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update visibility'))
    }
  }

  async function handleDeleteKnowledge(sourceId: string): Promise<void> {
    try {
      await deleteKnowledgeSource(sourceId)
      onSetState(makeReady({
        data: { ...data, knowledgeSources: data.knowledgeSources.filter((source) => source.sourceId !== sourceId) },
        actionError: null,
      }))
    } catch (error: unknown) {
      setActionError(formatApiError(error, 'UNKNOWN_ERROR: Failed to delete knowledge source'))
    }
  }

  async function handleTriggerIngestion(sourceId: string): Promise<void> {
    onSetIngestStatus((prev) => ({ ...prev, [sourceId]: { phase: 'running' } }))
    try {
      const job = await triggerIngestion(sourceId)
      const finalJob = await pollIngestionJob(job.ingestionJobId)
      const refreshedSources = await listKnowledgeSources(data.scenario.scenarioId)
      onSetState(makeReady({ data: { ...data, knowledgeSources: refreshedSources }, actionError: null }))
      onSetIngestStatus((prev) => {
        if (finalJob.status === 'failed') {
          return { ...prev, [sourceId]: { phase: 'error', message: finalJob.errorMessage ?? 'Ingestion failed.' } }
        }
        return withoutKey(prev, sourceId)
      })
    } catch (error: unknown) {
      onSetIngestStatus((prev) => ({
        ...prev,
        [sourceId]: { phase: 'error', message: formatApiError(error, 'Failed to trigger ingestion.') },
      }))
    }
  }

  return (
    <ScenarioView
      scenario={data.scenario}
      avatars={data.avatars}
      knowledgeSources={data.knowledgeSources}
      actionError={actionError}
      ingestStatus={ingestStatus}
      onEditScenario={() => { setMode({ kind: 'editing-scenario' }) }}
      onAddAvatar={() => { setMode({ kind: 'creating-avatar' }) }}
      onEditAvatar={(avatarId) => { setMode({ kind: 'editing-avatar', avatarId }) }}
      onDeleteAvatar={(avatarId) => { void handleDeleteAvatar(avatarId) }}
      onToggleVisibility={(avatarId, visible) => { void handleToggleVisibility(avatarId, visible) }}
      onAddKnowledge={() => { setMode({ kind: 'creating-knowledge' }) }}
      onEditKnowledge={(sourceId) => { setMode({ kind: 'editing-knowledge', sourceId }) }}
      onDeleteKnowledge={(sourceId) => { void handleDeleteKnowledge(sourceId) }}
      onTriggerIngestion={(sourceId) => { void handleTriggerIngestion(sourceId) }}
      onViewKnowledgeChunks={(sourceId) => { setMode({ kind: 'viewing-knowledge-chunks', sourceId }) }}
      onTestRetrieval={() => { setMode({ kind: 'testing-retrieval' }) }}
    />
  )
}
