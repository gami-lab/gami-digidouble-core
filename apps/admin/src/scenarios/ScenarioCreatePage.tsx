import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import { formatApiError } from '../api/error'
import { createScenario } from '../api/scenarios'
import { ScenarioFormFields } from './ScenarioFormFields'

type ScenarioCreatePageProps = {
  onBack: () => void
  onCreated: (scenarioId: string) => void
}

type CreateState = { status: 'idle' } | { status: 'saving' } | { status: 'error'; message: string }

export function ScenarioCreatePage({ onBack, onCreated }: ScenarioCreatePageProps): JSX.Element {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft')
  const [worldContext, setWorldContext] = useState('')
  const [objectives, setObjectives] = useState<string[]>([])
  const [createState, setCreateState] = useState<CreateState>({ status: 'idle' })

  async function handleSubmit(e: SyntheticEvent): Promise<void> {
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
        <ScenarioFormFields
          name={name}
          status={status}
          worldContext={worldContext}
          objectives={objectives}
          idPrefix="sc"
          disabled={isSaving}
          onNameChange={setName}
          onStatusChange={setStatus}
          onWorldContextChange={setWorldContext}
          onObjectivesChange={setObjectives}
        />
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
