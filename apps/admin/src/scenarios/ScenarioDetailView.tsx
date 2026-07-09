import type { JSX } from 'react'
import type { AvatarSummary, ScenarioSummary } from '@gami/shared'
import type { KnowledgeSourceDto } from '../api/knowledge'

type ScenarioViewProps = {
  scenario: ScenarioSummary
  avatars: AvatarSummary[]
  knowledgeSources: KnowledgeSourceDto[]
  actionError: string | null
  onEditScenario: () => void
  onAddAvatar: () => void
  onEditAvatar: (avatarId: string) => void
  onDeleteAvatar: (avatarId: string) => void
  onToggleVisibility: (avatarId: string, visible: boolean) => void
  onAddKnowledge: () => void
  onEditKnowledge: (sourceId: string) => void
  onDeleteKnowledge: (sourceId: string) => void
  onTriggerIngestion: (sourceId: string) => void
}

export function ScenarioView({
  scenario,
  avatars,
  knowledgeSources,
  actionError,
  onEditScenario,
  onAddAvatar,
  onEditAvatar,
  onDeleteAvatar,
  onToggleVisibility,
  onAddKnowledge,
  onEditKnowledge,
  onDeleteKnowledge,
  onTriggerIngestion,
}: ScenarioViewProps): JSX.Element {
  const initialIds = new Set(scenario.avatarAvailability.initialAvatarIds)

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
        onAddKnowledge={onAddKnowledge}
        onEditKnowledge={onEditKnowledge}
        onDeleteKnowledge={onDeleteKnowledge}
        onTriggerIngestion={onTriggerIngestion}
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

type KnowledgeSourceListSectionProps = {
  knowledgeSources: KnowledgeSourceDto[]
  onAddKnowledge: () => void
  onEditKnowledge: (sourceId: string) => void
  onDeleteKnowledge: (sourceId: string) => void
  onTriggerIngestion: (sourceId: string) => void
}

function KnowledgeSourceListSection({
  knowledgeSources,
  onAddKnowledge,
  onEditKnowledge,
  onDeleteKnowledge,
  onTriggerIngestion,
}: KnowledgeSourceListSectionProps): JSX.Element {
  return (
    <>
      <div className="admin-section-header">
        <h3>Knowledge sources</h3>
        <button type="button" className="admin-button admin-button-primary" onClick={onAddKnowledge}>
          Add knowledge
        </button>
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
              <tr key={source.sourceId}>
                <td>{source.name}</td>
                <td>{source.knowledgeType}</td>
                <td>{source.visibilityPolicy ?? 'all'}</td>
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
                    onClick={() => { onTriggerIngestion(source.sourceId) }}
                    disabled={source.status === 'pending'}
                  >
                    Ingest
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
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
