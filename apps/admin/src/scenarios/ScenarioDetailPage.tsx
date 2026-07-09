import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import type { AvatarSummary, ScenarioAvatarAvailability, ScenarioSummary } from '@gami/shared'
import { formatApiError } from '../api/error'
import {
  createAvatar,
  deleteAvatar,
  getScenario,
  listScenarioAvatars,
  updateAvatar,
  updateScenario,
} from '../api/scenarios'

type ScenarioDetailPageProps = {
  scenarioId: string
  onBack: () => void
}

type DetailMode =
  | { kind: 'view' }
  | { kind: 'editing-scenario' }
  | { kind: 'creating-avatar' }
  | { kind: 'editing-avatar'; avatarId: string }

type DetailData = { scenario: ScenarioSummary; avatars: AvatarSummary[] }

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DetailData; mode: DetailMode; actionError: string | null }

export function ScenarioDetailPage({ scenarioId, onBack }: ScenarioDetailPageProps): JSX.Element {
  const [state, setState] = useState<DetailState>({ status: 'loading' })

  function loadData(): void {
    setState({ status: 'loading' })
    Promise.all([getScenario(scenarioId), listScenarioAvatars(scenarioId)])
      .then(([scenario, avatars]) => {
        setState({ status: 'ready', data: { scenario, avatars }, mode: { kind: 'view' }, actionError: null })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId])

  return (
    <section className="admin-card">
      <button type="button" className="admin-link-button" onClick={onBack}>
        ← Back to scenarios
      </button>
      <DetailBody state={state} onSetState={setState} />
    </section>
  )
}

type DetailBodyProps = {
  state: DetailState
  onSetState: (s: DetailState) => void
}

function DetailBody({ state, onSetState }: DetailBodyProps): JSX.Element {
  if (state.status === 'loading') return <p>Loading scenario…</p>
  if (state.status === 'error') return <p className="admin-error">{state.message}</p>

  const { data, mode, actionError } = state

  function makeReady(
    updates: Partial<{ data: DetailData; mode: DetailMode; actionError: string | null }>,
  ): DetailState {
    return {
      status: 'ready',
      data: updates.data ?? data,
      mode: updates.mode ?? mode,
      actionError: updates.actionError !== undefined ? updates.actionError : actionError,
    }
  }

  function setMode(next: DetailMode): void {
    onSetState(makeReady({ mode: next, actionError: null }))
  }

  function setActionError(message: string): void {
    onSetState(makeReady({ actionError: message }))
  }

  function refreshData(updated: Partial<DetailData>): void {
    onSetState(makeReady({ data: { ...data, ...updated }, mode: { kind: 'view' }, actionError: null }))
  }

  if (mode.kind === 'editing-scenario') {
    return (
      <ScenarioEditForm
        scenario={data.scenario}
        onCancel={() => { setMode({ kind: 'view' }) }}
        onSaved={(scenario) => { refreshData({ scenario }) }}
        onError={setActionError}
      />
    )
  }

  if (mode.kind === 'creating-avatar') {
    return (
      <AvatarCreateForm
        scenarioId={data.scenario.scenarioId}
        onCancel={() => { setMode({ kind: 'view' }) }}
        onCreated={(avatar) => {
          refreshData({ avatars: [avatar, ...data.avatars] })
        }}
        onError={setActionError}
      />
    )
  }

  if (mode.kind === 'editing-avatar') {
    const avatar = data.avatars.find((a) => a.avatarId === mode.avatarId)
    if (avatar === undefined) {
      setMode({ kind: 'view' })
      return <p>Avatar not found.</p>
    }
    return (
      <AvatarEditForm
        avatar={avatar}
        onCancel={() => { setMode({ kind: 'view' }) }}
        onSaved={(updated) => {
          refreshData({
            avatars: data.avatars.map((a) => (a.avatarId === updated.avatarId ? updated : a)),
          })
        }}
        onError={setActionError}
      />
    )
  }

  return (
    <ScenarioView
      data={data}
      actionError={actionError}
      onEditScenario={() => { setMode({ kind: 'editing-scenario' }) }}
      onAddAvatar={() => { setMode({ kind: 'creating-avatar' }) }}
      onEditAvatar={(avatarId) => { setMode({ kind: 'editing-avatar', avatarId }) }}
      onDeleteAvatar={(avatarId) => {
        deleteAvatar(avatarId)
          .then(() => {
            onSetState(
              makeReady({
                data: { ...data, avatars: data.avatars.filter((a) => a.avatarId !== avatarId) },
                actionError: null,
              }),
            )
          })
          .catch((error: unknown) => {
            setActionError(formatApiError(error, 'UNKNOWN_ERROR: Failed to delete avatar'))
          })
      }}
      onToggleVisibility={(avatarId, visible) => {
        const current = data.scenario.avatarAvailability
        const initial = current.initialAvatarIds
        const unlockable = current.unlockableAvatarIds ?? []

        let nextInitial: string[]
        let nextUnlockable: string[]
        if (visible) {
          nextInitial = initial.includes(avatarId) ? initial : [...initial, avatarId]
          nextUnlockable = unlockable.filter((id: string) => id !== avatarId)
        } else {
          nextInitial = initial.filter((id: string) => id !== avatarId)
          nextUnlockable = unlockable.includes(avatarId) ? unlockable : [...unlockable, avatarId]
        }

        const nextAvailability: ScenarioAvatarAvailability = {
          initialAvatarIds: nextInitial,
          ...(nextUnlockable.length > 0 ? { unlockableAvatarIds: nextUnlockable } : {}),
        }

        updateScenario(data.scenario.scenarioId, { avatarAvailability: nextAvailability })
          .then((scenario) => {
            onSetState(makeReady({ data: { ...data, scenario }, actionError: null }))
          })
          .catch((error: unknown) => {
            setActionError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update visibility'))
          })
      }}
    />
  )
}

// ── Scenario view ──────────────────────────────────────────────────────────

type ScenarioViewProps = {
  data: DetailData
  actionError: string | null
  onEditScenario: () => void
  onAddAvatar: () => void
  onEditAvatar: (avatarId: string) => void
  onDeleteAvatar: (avatarId: string) => void
  onToggleVisibility: (avatarId: string, visible: boolean) => void
}

function ScenarioView({
  data,
  actionError,
  onEditScenario,
  onAddAvatar,
  onEditAvatar,
  onDeleteAvatar,
  onToggleVisibility,
}: ScenarioViewProps): JSX.Element {
  const { scenario, avatars } = data
  const initialIds = new Set(scenario.avatarAvailability.initialAvatarIds)

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
                    onChange={(e) => {
                      onToggleVisibility(avatar.avatarId, e.target.checked)
                    }}
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

// ── Scenario edit form ─────────────────────────────────────────────────────

type ScenarioEditFormProps = {
  scenario: ScenarioSummary
  onCancel: () => void
  onSaved: (scenario: ScenarioSummary) => void
  onError: (message: string) => void
}

function ScenarioEditForm({ scenario, onCancel, onSaved, onError }: ScenarioEditFormProps): JSX.Element {
  const [name, setName] = useState(scenario.name)
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(scenario.status)
  const [worldContext, setWorldContext] = useState(scenario.worldContext)
  const [objectives, setObjectives] = useState<string[]>(scenario.objectives)
  const [objectiveInput, setObjectiveInput] = useState('')
  const [saving, setSaving] = useState(false)

  function handleAddObjective(): void {
    const trimmed = objectiveInput.trim()
    if (trimmed.length === 0) return
    setObjectives((prev) => [...prev, trimmed])
    setObjectiveInput('')
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      const updated = await updateScenario(scenario.scenarioId, {
        name: name.trim(),
        status,
        worldContext: worldContext.trim(),
        objectives,
      })
      onSaved(updated)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update scenario'))
      setSaving(false)
    }
  }

  return (
    <>
      <h2>Edit scenario</h2>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="admin-form-group">
          <label htmlFor="edit-sc-name" className="admin-form-label">
            Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="edit-sc-name"
            type="text"
            className="admin-form-input"
            value={name}
            onChange={(e) => { setName(e.target.value) }}
            required
            disabled={saving}
          />
        </div>

        <div className="admin-form-group">
          <label htmlFor="edit-sc-status" className="admin-form-label">
            Status
          </label>
          <select
            id="edit-sc-status"
            className="admin-form-select"
            value={status}
            onChange={(e) => { setStatus(e.target.value as 'draft' | 'active' | 'archived') }}
            disabled={saving}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>

        <div className="admin-form-group">
          <label htmlFor="edit-sc-world-context" className="admin-form-label">
            World context
          </label>
          <textarea
            id="edit-sc-world-context"
            className="admin-form-textarea"
            rows={4}
            value={worldContext}
            onChange={(e) => { setWorldContext(e.target.value) }}
            disabled={saving}
          />
        </div>

        <div className="admin-form-group">
          <p className="admin-form-label">Objectives</p>
          {objectives.length > 0 ? (
            <ul className="admin-objectives-list">
              {objectives.map((objective, index) => (
                <li key={index} className="admin-objective-item">
                  <span>{objective}</span>
                  <button
                    type="button"
                    className="admin-remove-button"
                    onClick={() => { setObjectives((prev) => prev.filter((_, i) => i !== index)) }}
                    disabled={saving}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-muted">No objectives yet.</p>
          )}
          <div className="admin-objective-input-row">
            <input
              type="text"
              className="admin-form-input"
              placeholder="Add an objective…"
              value={objectiveInput}
              onChange={(e) => { setObjectiveInput(e.target.value) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddObjective()
                }
              }}
              disabled={saving}
            />
            <button
              type="button"
              className="admin-button admin-button-secondary"
              onClick={handleAddObjective}
              disabled={saving}
            >
              Add
            </button>
          </div>
        </div>

        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={saving || name.trim().length === 0}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}

// ── Avatar create form ─────────────────────────────────────────────────────

type AvatarCreateFormProps = {
  scenarioId: string
  onCancel: () => void
  onCreated: (avatar: AvatarSummary) => void
  onError: (message: string) => void
}

function AvatarCreateForm({ scenarioId, onCancel, onCreated, onError }: AvatarCreateFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [personaPrompt, setPersonaPrompt] = useState('')
  const [avatarStatus, setAvatarStatus] = useState<'draft' | 'active' | 'archived'>('active')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (name.trim().length === 0 || personaPrompt.trim().length === 0) return
    setSaving(true)
    try {
      const avatar = await createAvatar(scenarioId, {
        name: name.trim(),
        personaPrompt: personaPrompt.trim(),
        status: avatarStatus,
      })
      onCreated(avatar)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to create avatar'))
      setSaving(false)
    }
  }

  return (
    <>
      <h2>Add avatar</h2>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <AvatarFormFields
          name={name}
          personaPrompt={personaPrompt}
          avatarStatus={avatarStatus}
          saving={saving}
          idPrefix="create"
          onNameChange={setName}
          onPersonaPromptChange={setPersonaPrompt}
          onStatusChange={setAvatarStatus}
        />
        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={saving || name.trim().length === 0 || personaPrompt.trim().length === 0}
          >
            {saving ? 'Creating…' : 'Create avatar'}
          </button>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}

// ── Avatar edit form ───────────────────────────────────────────────────────

type AvatarEditFormProps = {
  avatar: AvatarSummary
  onCancel: () => void
  onSaved: (avatar: AvatarSummary) => void
  onError: (message: string) => void
}

function AvatarEditForm({ avatar, onCancel, onSaved, onError }: AvatarEditFormProps): JSX.Element {
  const [name, setName] = useState(avatar.name)
  const [personaPrompt, setPersonaPrompt] = useState(avatar.personaPrompt)
  const [avatarStatus, setAvatarStatus] = useState<'draft' | 'active' | 'archived'>(avatar.status)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (name.trim().length === 0 || personaPrompt.trim().length === 0) return
    setSaving(true)
    try {
      const updated = await updateAvatar(avatar.avatarId, {
        name: name.trim(),
        personaPrompt: personaPrompt.trim(),
        status: avatarStatus,
      })
      onSaved(updated)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update avatar'))
      setSaving(false)
    }
  }

  return (
    <>
      <h2>Edit avatar</h2>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <AvatarFormFields
          name={name}
          personaPrompt={personaPrompt}
          avatarStatus={avatarStatus}
          saving={saving}
          idPrefix="edit"
          onNameChange={setName}
          onPersonaPromptChange={setPersonaPrompt}
          onStatusChange={setAvatarStatus}
        />
        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={saving || name.trim().length === 0 || personaPrompt.trim().length === 0}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}

// ── Shared avatar form fields ──────────────────────────────────────────────

type AvatarFormFieldsProps = {
  name: string
  personaPrompt: string
  avatarStatus: 'draft' | 'active' | 'archived'
  saving: boolean
  idPrefix: string
  onNameChange: (value: string) => void
  onPersonaPromptChange: (value: string) => void
  onStatusChange: (value: 'draft' | 'active' | 'archived') => void
}

function AvatarFormFields({
  name,
  personaPrompt,
  avatarStatus,
  saving,
  idPrefix,
  onNameChange,
  onPersonaPromptChange,
  onStatusChange,
}: AvatarFormFieldsProps): JSX.Element {
  return (
    <>
      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-av-name`} className="admin-form-label">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${idPrefix}-av-name`}
          type="text"
          className="admin-form-input"
          value={name}
          onChange={(e) => { onNameChange(e.target.value) }}
          required
          disabled={saving}
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-av-persona`} className="admin-form-label">
          Persona prompt <span aria-hidden="true">*</span>
        </label>
        <textarea
          id={`${idPrefix}-av-persona`}
          className="admin-form-textarea"
          rows={6}
          value={personaPrompt}
          onChange={(e) => { onPersonaPromptChange(e.target.value) }}
          required
          disabled={saving}
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-av-status`} className="admin-form-label">
          Status
        </label>
        <select
          id={`${idPrefix}-av-status`}
          className="admin-form-select"
          value={avatarStatus}
          onChange={(e) => { onStatusChange(e.target.value as 'draft' | 'active' | 'archived') }}
          disabled={saving}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
      </div>
    </>
  )
}

