import { useState } from 'react'
import type { JSX, FormEvent } from 'react'
import { formatApiError } from '../api/error'
import { createScenario } from '../api/scenarios'

type ScenarioCreatePageProps = {
  onBack: () => void
  onCreated: (scenarioId: string) => void
}

type CreateState = { status: 'idle' } | { status: 'saving' } | { status: 'error'; message: string }

export function ScenarioCreatePage({ onBack, onCreated }: ScenarioCreatePageProps): JSX.Element {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft')
  const [worldContext, setWorldContext] = useState('')
  const [objectiveInput, setObjectiveInput] = useState('')
  const [objectives, setObjectives] = useState<string[]>([])
  const [createState, setCreateState] = useState<CreateState>({ status: 'idle' })

  function handleAddObjective(): void {
    const trimmed = objectiveInput.trim()
    if (trimmed.length === 0) return
    setObjectives((prev) => [...prev, trimmed])
    setObjectiveInput('')
  }

  function handleRemoveObjective(index: number): void {
    setObjectives((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (name.trim().length === 0) return

    setCreateState({ status: 'saving' })
    try {
      const scenario = await createScenario({
        name: name.trim(),
        status,
        objectives,
        worldContext: worldContext.trim(),
      })
      onCreated(scenario.scenarioId)
    } catch (error: unknown) {
      setCreateState({
        status: 'error',
        message: formatApiError(error, 'UNKNOWN_ERROR: Failed to create scenario'),
      })
    }
  }

  const isSaving = createState.status === 'saving'

  return (
    <section className="admin-card">
      <button type="button" className="admin-link-button" onClick={onBack}>
        ← Back to scenarios
      </button>
      <h2>Create scenario</h2>
      {createState.status === 'error' ? (
        <p className="admin-error">{createState.message}</p>
      ) : null}
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="admin-form-group">
          <label htmlFor="sc-name" className="admin-form-label">
            Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="sc-name"
            type="text"
            className="admin-form-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
            }}
            required
            disabled={isSaving}
          />
        </div>

        <div className="admin-form-group">
          <label htmlFor="sc-status" className="admin-form-label">
            Status
          </label>
          <select
            id="sc-status"
            className="admin-form-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as 'draft' | 'active' | 'archived')
            }}
            disabled={isSaving}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>

        <div className="admin-form-group">
          <label htmlFor="sc-world-context" className="admin-form-label">
            World context
          </label>
          <textarea
            id="sc-world-context"
            className="admin-form-textarea"
            rows={4}
            value={worldContext}
            onChange={(e) => {
              setWorldContext(e.target.value)
            }}
            disabled={isSaving}
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
                    onClick={() => {
                      handleRemoveObjective(index)
                    }}
                    disabled={isSaving}
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
              onChange={(e) => {
                setObjectiveInput(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddObjective()
                }
              }}
              disabled={isSaving}
            />
            <button
              type="button"
              className="admin-button admin-button-secondary"
              onClick={handleAddObjective}
              disabled={isSaving}
            >
              Add
            </button>
          </div>
        </div>

        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={isSaving || name.trim().length === 0}
          >
            {isSaving ? 'Creating…' : 'Create scenario'}
          </button>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={onBack}
            disabled={isSaving}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  )
}
