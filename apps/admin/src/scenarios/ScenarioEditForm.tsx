import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import type { ScenarioSummary } from '@gami/shared'
import { formatApiError } from '../api/error'
import { updateScenario } from '../api/scenarios'
import { ScenarioFormFields } from './ScenarioFormFields'

type ScenarioEditFormProps = {
  scenario: ScenarioSummary
  onCancel: () => void
  onSaved: (scenario: ScenarioSummary) => void
  onError: (message: string) => void
}

export function ScenarioEditForm({ scenario, onCancel, onSaved, onError }: ScenarioEditFormProps): JSX.Element {
  const [name, setName] = useState(scenario.name)
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(scenario.status)
  const [worldContext, setWorldContext] = useState(scenario.worldContext)
  const [objectives, setObjectives] = useState<string[]>(scenario.objectives)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: SyntheticEvent): Promise<void> {
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
        <ScenarioFormFields
          name={name}
          status={status}
          worldContext={worldContext}
          objectives={objectives}
          idPrefix="edit-sc"
          disabled={saving}
          onNameChange={setName}
          onStatusChange={setStatus}
          onWorldContextChange={setWorldContext}
          onObjectivesChange={setObjectives}
        />
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
