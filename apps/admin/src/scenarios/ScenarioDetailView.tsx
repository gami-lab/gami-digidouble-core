import type { JSX } from 'react'
import type { AvatarSummary, ScenarioSummary } from '@gami/shared'
import type { KnowledgeSourceDto } from '../api/knowledge'

export type IngestUiStatus = { phase: 'running' } | { phase: 'error'; message: string }

type ScenarioViewProps = {
  scenario: ScenarioSummary
  avatars: AvatarSummary[]
  knowledgeSources: KnowledgeSourceDto[]
  actionError: string | null
  ingestStatus: Record<string, IngestUiStatus>
  onEditScenario: () => void
  onAddAvatar: () => void
  onEditAvatar: (avatarId: string) => void
  onDeleteAvatar: (avatarId: string) => void
  onToggleVisibility: (avatarId: string, visible: boolean) => void
  onAddKnowledge: () => void
  onEditKnowledge: (sourceId: string) => void
  onDeleteKnowledge: (sourceId: string) => void
  onTriggerIngestion: (sourceId: string) => void
  onViewKnowledgeChunks: (sourceId: string) => void
  onTestRetrieval: () => void
}

export function ScenarioView({
  scenario,
  avatars,
  knowledgeSources,
  actionError,
  ingestStatus,
  onEditScenario,
  onAddAvatar,
  onEditAvatar,
  onDeleteAvatar,
  onToggleVisibility,
  onAddKnowledge,
  onEditKnowledge,
  onDeleteKnowledge,
  onTriggerIngestion,
  onViewKnowledgeChunks,
  onTestRetrieval,
}: ScenarioViewProps): JSX.Element {
  const initialIds = new Set(scenario.avatarAvailability.initialAvatarIds)
  const avatarNamesById = new Map(avatars.map((avatar) => [avatar.avatarId, avatar.name] as const))

  return (
    <>
      <ScenarioSummarySection scenario={scenario} actionError={actionError} onEditScenario={onEditScenario} />
      <AvatarListSection
        avatars={avatars}
        initialIds={initialIds}
        onAddAvatar={onAddAvatar}
        onEditAvatar={onEditAvatar}
        onDeleteAvatar={onDeleteAvatar}
        onToggleVisibility={onToggleVisibility}
      />
      <KnowledgeSourceListSection
        knowledgeSources={knowledgeSources}
        avatarNamesById={avatarNamesById}
        ingestStatus={ingestStatus}
        onAddKnowledge={onAddKnowledge}
        onEditKnowledge={onEditKnowledge}
        onDeleteKnowledge={onDeleteKnowledge}
        onTriggerIngestion={onTriggerIngestion}
        onViewKnowledgeChunks={onViewKnowledgeChunks}
        onTestRetrieval={onTestRetrieval}
      />
    </>
  )
}

type ScenarioSummarySectionProps = {
  scenario: ScenarioSummary
  actionError: string | null
  onEditScenario: () => void
}

function ScenarioSummarySection({
  scenario,
  actionError,
  onEditScenario,
}: ScenarioSummarySectionProps): JSX.Element {
  const defaultProfile = scenario.modelSelection?.defaultProfile
  const gameMasterOverride = scenario.modelSelection?.gameMasterOverride

  return (
    <>
      <div className="admin-detail-header">
        <h2>{scenario.name}</h2>
        <button type="button" className="admin-button admin-button-secondary" onClick={onEditScenario}>
          Edit
        </button>
      </div>
      <p>
        <span className="admin-status-pill">{scenario.status}</span>
      </p>
      {actionError !== null ? <p className="admin-error">{actionError}</p> : null}

      <h3>World context</h3>
      <p className="admin-muted">{scenario.worldContext.length > 0 ? scenario.worldContext : 'Not set.'}</p>

      <h3>Objectives</h3>
      {scenario.objectives.length === 0 ? (
        <p className="admin-muted">No objectives yet.</p>
      ) : (
        <ul>
          {scenario.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      )}

      <h3>Runtime models</h3>
      <p className="admin-muted">
        Scenario default: {defaultProfile === undefined ? 'Inherited from global runtime config.' : formatModelProfile(defaultProfile)}
      </p>
      <p className="admin-muted">
        Game Master override: {gameMasterOverride === undefined ? 'Inherited from scenario default or global Game Master config.' : formatModelProfile(gameMasterOverride)}
      </p>
    </>
  )
}

type AvatarListSectionProps = {
  avatars: AvatarSummary[]
  initialIds: Set<string>
  onAddAvatar: () => void
  onEditAvatar: (avatarId: string) => void
  onDeleteAvatar: (avatarId: string) => void
  onToggleVisibility: (avatarId: string, visible: boolean) => void
}

function AvatarListSection({
  avatars,
  initialIds,
  onAddAvatar,
  onEditAvatar,
  onDeleteAvatar,
  onToggleVisibility,
}: AvatarListSectionProps): JSX.Element {
  return (
    <>
      <div className="admin-section-header">
        <h3>Avatars</h3>
        <button type="button" className="admin-button admin-button-primary" onClick={onAddAvatar}>
          Add avatar
        </button>
      </div>

      {avatars.length === 0 ? (
        <p className="admin-muted">No avatars yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Model override</th>
              <th>Initially visible</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {avatars.map((avatar) => (
              <tr key={avatar.avatarId}>
                <td>{avatar.name}</td>
                <td>
                  <span className="admin-status-pill">{avatar.status}</span>
                </td>
                <td>{formatAvatarOverride(avatar.llmOverride)}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Initially visible: ${avatar.name}`}
                    checked={initialIds.has(avatar.avatarId)}
                    onChange={(event) => { onToggleVisibility(avatar.avatarId, event.target.checked) }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-button admin-button-secondary"
                    onClick={() => { onEditAvatar(avatar.avatarId) }}
                  >
                    Edit
                  </button>
                  {' '}
                  <button
                    type="button"
                    className="admin-button admin-button-danger"
                    onClick={() => { onDeleteAvatar(avatar.avatarId) }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function formatModelProfile(profile: { provider: string; model: string }): string {
  return `${profile.provider} / ${profile.model}`
}

function formatAvatarOverride(override: AvatarSummary['llmOverride']): string {
  if (override?.provider === undefined || override.model === undefined) {
    return 'Inherited'
  }

  return formatModelProfile({ provider: override.provider, model: override.model })
}

type KnowledgeSourceListSectionProps = {
  knowledgeSources: KnowledgeSourceDto[]
  avatarNamesById: Map<string, string>
  ingestStatus: Record<string, IngestUiStatus>
  onAddKnowledge: () => void
  onEditKnowledge: (sourceId: string) => void
  onDeleteKnowledge: (sourceId: string) => void
  onTriggerIngestion: (sourceId: string) => void
  onViewKnowledgeChunks: (sourceId: string) => void
  onTestRetrieval: () => void
}

function KnowledgeSourceListSection({
  knowledgeSources,
  avatarNamesById,
  ingestStatus,
  onAddKnowledge,
  onEditKnowledge,
  onDeleteKnowledge,
  onTriggerIngestion,
  onViewKnowledgeChunks,
  onTestRetrieval,
}: KnowledgeSourceListSectionProps): JSX.Element {
  return (
    <>
      <div className="admin-section-header">
        <h3>Knowledge sources</h3>
        <div>
          <button type="button" className="admin-button admin-button-secondary" onClick={onTestRetrieval}>
            Test retrieval
          </button>
          {' '}
          <button type="button" className="admin-button admin-button-primary" onClick={onAddKnowledge}>
            Add knowledge
          </button>
        </div>
      </div>

      {knowledgeSources.length === 0 ? (
        <p className="admin-muted">No knowledge sources yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Visibility</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {knowledgeSources.map((source) => (
              <KnowledgeSourceRow
                key={source.sourceId}
                source={source}
                avatarNamesById={avatarNamesById}
                ingestState={ingestStatus[source.sourceId]}
                onEditKnowledge={onEditKnowledge}
                onDeleteKnowledge={onDeleteKnowledge}
                onTriggerIngestion={onTriggerIngestion}
                onViewKnowledgeChunks={onViewKnowledgeChunks}
              />
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

type KnowledgeSourceRowProps = {
  source: KnowledgeSourceDto
  avatarNamesById: Map<string, string>
  ingestState: IngestUiStatus | undefined
  onEditKnowledge: (sourceId: string) => void
  onDeleteKnowledge: (sourceId: string) => void
  onTriggerIngestion: (sourceId: string) => void
  onViewKnowledgeChunks: (sourceId: string) => void
}

function KnowledgeSourceRow({
  source,
  avatarNamesById,
  ingestState,
  onEditKnowledge,
  onDeleteKnowledge,
  onTriggerIngestion,
  onViewKnowledgeChunks,
}: KnowledgeSourceRowProps): JSX.Element {
  const isIngesting = ingestState?.phase === 'running'
  const ingestLabel = isIngesting ? 'Ingesting…' : source.status === 'ready' ? 'Re-ingest' : 'Ingest'
  const ingestTitle =
    source.status === 'ready'
      ? 'Already ingested. Re-ingest to pick up content or metadata changes.'
      : 'Chunk, embed, and store this source so it can be retrieved at runtime.'

  return (
    <>
      <tr>
        <td>{source.name}</td>
        <td>{source.knowledgeType}</td>
        <td>{formatKnowledgeVisibility(source, avatarNamesById)}</td>
        <td>
          <span className="admin-status-pill">{source.status}</span>
        </td>
        <td>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={() => { onEditKnowledge(source.sourceId) }}
          >
            Edit
          </button>
          {' '}
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={() => { onViewKnowledgeChunks(source.sourceId) }}
          >
            View data
          </button>
          {' '}
          <button
            type="button"
            className="admin-button admin-button-secondary"
            title={ingestTitle}
            onClick={() => { onTriggerIngestion(source.sourceId) }}
            disabled={isIngesting}
          >
            {ingestLabel}
          </button>
          {' '}
          <button
            type="button"
            className="admin-button admin-button-danger"
            onClick={() => { onDeleteKnowledge(source.sourceId) }}
          >
            Delete
          </button>
        </td>
      </tr>
      {ingestState?.phase === 'error' ? (
        <tr>
          <td colSpan={5} className="admin-error">
            Ingestion failed: {ingestState.message}
          </td>
        </tr>
      ) : null}
    </>
  )
}

function formatKnowledgeVisibility(
  source: KnowledgeSourceDto,
  avatarNamesById: Map<string, string>,
): string {
  if (source.visibilityPolicy === 'none') return 'GM-only'

  if (source.visibilityPolicy === 'avatars' || (source.visibleToAvatarIds?.length ?? 0) > 0) {
    const labels = (source.visibleToAvatarIds ?? []).map(
      (avatarId) => avatarNamesById.get(avatarId) ?? avatarId,
    )

    return labels.length > 0 ? labels.join(', ') : 'Specific avatars'
  }

  return 'All avatars'
}
