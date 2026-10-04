import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import type { ScenarioStatus, ScenarioSummary, VoiceConfiguration } from '@gami/shared'
import { formatApiError } from '../api/error'
import { updateScenario } from '../api/scenarios'
import { ScenarioFormFields } from './ScenarioFormFields'
import {
  fromScenarioModelSelection,
  hasPartialScenarioModelSelection,
  toScenarioModelSelection,
} from './model-selection-form'

type ScenarioEditFormProps = {
  scenario: ScenarioSummary
  onCancel: () => void
  onSaved: (scenario: ScenarioSummary) => void
  onError: (message: string) => void
}

export function ScenarioEditForm({
  scenario,
  onCancel,
  onSaved,
  onError,
}: ScenarioEditFormProps): JSX.Element {
  const [name, setName] = useState(scenario.name)
  const [status, setStatus] = useState<ScenarioStatus>(scenario.status)
  const [language, setLanguage] = useState(scenario.language ?? '')
  const [worldContext, setWorldContext] = useState(scenario.worldContext)
  const [objectives, setObjectives] = useState<string[]>(scenario.objectives)
  const [modelSelectionForm, setModelSelectionForm] = useState(() =>
    fromScenarioModelSelection(scenario.modelSelection),
  )
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfiguration | null>(
    scenario.voiceConfig ?? null,
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: SyntheticEvent): Promise<void> {
    e.preventDefault()
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      const modelSelection = toScenarioModelSelection(modelSelectionForm)
      const updated = await updateScenario(scenario.scenarioId, {
        name: name.trim(),
        status,
        language,
        worldContext: worldContext.trim(),
        objectives,
        modelSelection: modelSelection ?? null,
        voiceConfig,
      })
      onSaved(updated)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update scenario'))
      setSaving(false)
    }
  }

  const hasPartialModelSelectionState = hasPartialScenarioModelSelection(modelSelectionForm)
  const submitDisabled = saving || name.trim().length === 0 || hasPartialModelSelectionState

  return (
    <>
      <h2>Edit scenario</h2>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <ScenarioFormFields
          name={name}
          status={status}
          language={language}
          worldContext={worldContext}
          objectives={objectives}
          modelSelection={modelSelectionForm}
          voiceConfig={voiceConfig}
          idPrefix="edit-sc"
          disabled={saving}
          onNameChange={setName}
          onStatusChange={setStatus}
          onLanguageChange={setLanguage}
          onWorldContextChange={setWorldContext}
          onObjectivesChange={setObjectives}
          onModelSelectionChange={setModelSelectionForm}
          onVoiceConfigChange={setVoiceConfig}
        />
        {hasPartialModelSelectionState ? (
          <p className="admin-error">
            Select both provider and model for each model setting, or leave both empty.
          </p>
        ) : null}
        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={submitDisabled}
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
