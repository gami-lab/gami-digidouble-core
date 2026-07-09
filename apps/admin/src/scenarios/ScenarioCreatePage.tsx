import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import type { ScenarioStatus } from '@gami/shared'
import { formatApiError } from '../api/error'
import { createScenario } from '../api/scenarios'
import { ScenarioFormFields } from './ScenarioFormFields'
import {
  EMPTY_MODEL_SELECTION,
  hasPartialModelSelection,
  toScenarioModelSelection,
} from './model-selection-form'

type ScenarioCreatePageProps = {
  onBack: () => void
  onCreated: (scenarioId: string) => void
}

type CreateState = { status: 'idle' } | { status: 'saving' } | { status: 'error'; message: string }

export function ScenarioCreatePage({ onBack, onCreated }: ScenarioCreatePageProps): JSX.Element {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<ScenarioStatus>('draft')
  const [worldContext, setWorldContext] = useState('')
  const [objectives, setObjectives] = useState<string[]>([])
  const [defaultModelSelection, setDefaultModelSelection] = useState(EMPTY_MODEL_SELECTION)
  const [gameMasterModelSelection, setGameMasterModelSelection] = useState(EMPTY_MODEL_SELECTION)
  const [createState, setCreateState] = useState<CreateState>({ status: 'idle' })

  async function handleSubmit(e: SyntheticEvent): Promise<void> {
    e.preventDefault()
    if (name.trim().length === 0) return
    setCreateState({ status: 'saving' })
    try {
      const modelSelection = toScenarioModelSelection({
        defaultProfile: defaultModelSelection,
        gameMasterOverride: gameMasterModelSelection,
      })
      const scenario = await createScenario({
        name: name.trim(),
        status,
        objectives,
        worldContext: worldContext.trim(),
        ...(modelSelection !== undefined ? { modelSelection } : {}),
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
  const hasPartialModelSelectionState =
    hasPartialModelSelection(defaultModelSelection) || hasPartialModelSelection(gameMasterModelSelection)
  const submitDisabled = isSaving || name.trim().length === 0 || hasPartialModelSelectionState

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
          defaultModelSelection={defaultModelSelection}
          gameMasterModelSelection={gameMasterModelSelection}
          idPrefix="sc"
          disabled={isSaving}
          onNameChange={setName}
          onStatusChange={setStatus}
          onWorldContextChange={setWorldContext}
          onObjectivesChange={setObjectives}
          onDefaultModelSelectionChange={setDefaultModelSelection}
          onGameMasterModelSelectionChange={setGameMasterModelSelection}
        />
        {hasPartialModelSelectionState ? (
          <p className="admin-error">Select both provider and model for each model setting, or leave both empty.</p>
        ) : null}
        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={submitDisabled}
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
