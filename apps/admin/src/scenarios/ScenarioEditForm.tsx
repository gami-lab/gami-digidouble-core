import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import type { ScenarioStatus, ScenarioSummary } from '@gami/shared'
import { formatApiError } from '../api/error'
import { updateScenario } from '../api/scenarios'
import { ScenarioFormFields } from './ScenarioFormFields'
import {
  fromScenarioModelSelection,
  hasPartialModelSelection,
  toScenarioModelSelection,
} from './model-selection-form'
import { toVoiceConfiguration } from './voice-config-form'

type ScenarioEditFormProps = {
  scenario: ScenarioSummary
  onCancel: () => void
  onSaved: (scenario: ScenarioSummary) => void
  onError: (message: string) => void
}

// eslint-disable-next-line complexity, max-lines-per-function
export function ScenarioEditForm({
  scenario,
  onCancel,
  onSaved,
  onError,
}: ScenarioEditFormProps): JSX.Element {
  const initialModelSelection = fromScenarioModelSelection(scenario.modelSelection)
  const [name, setName] = useState(scenario.name)
  const [status, setStatus] = useState<ScenarioStatus>(scenario.status)
  const [language, setLanguage] = useState(
    scenario.language ?? scenario.voiceConfig?.language?.split('-')[0] ?? 'en',
  )
  const [worldContext, setWorldContext] = useState(scenario.worldContext)
  const [objectives, setObjectives] = useState<string[]>(scenario.objectives)
  const [defaultModelSelection, setDefaultModelSelection] = useState(
    initialModelSelection.defaultProfile,
  )
  const [gameMasterModelSelection, setGameMasterModelSelection] = useState(
    initialModelSelection.gameMasterOverride,
  )
  const [voiceKey, setVoiceKey] = useState(scenario.voiceConfig?.voiceKey ?? '')
  const [voiceLanguage, setVoiceLanguage] = useState(scenario.voiceConfig?.language ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: SyntheticEvent): Promise<void> {
    e.preventDefault()
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      const modelSelection = toScenarioModelSelection({
        defaultProfile: defaultModelSelection,
        gameMasterOverride: gameMasterModelSelection,
      })
      const voiceConfig = toVoiceConfiguration(voiceKey, voiceLanguage)
      const updated = await updateScenario(scenario.scenarioId, {
        name: name.trim(),
        status,
        language,
        worldContext: worldContext.trim(),
        objectives,
        modelSelection: modelSelection ?? null,
        voiceConfig: voiceConfig ?? null,
      })
      onSaved(updated)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update scenario'))
      setSaving(false)
    }
  }

  const hasPartialModelSelectionState =
    hasPartialModelSelection(defaultModelSelection) ||
    hasPartialModelSelection(gameMasterModelSelection)
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
          defaultModelSelection={defaultModelSelection}
          gameMasterModelSelection={gameMasterModelSelection}
          voiceKey={voiceKey}
          voiceLanguage={voiceLanguage}
          idPrefix="edit-sc"
          disabled={saving}
          onNameChange={setName}
          onStatusChange={setStatus}
          onLanguageChange={setLanguage}
          onWorldContextChange={setWorldContext}
          onObjectivesChange={setObjectives}
          onDefaultModelSelectionChange={setDefaultModelSelection}
          onGameMasterModelSelectionChange={setGameMasterModelSelection}
          onVoiceKeyChange={setVoiceKey}
          onVoiceLanguageChange={setVoiceLanguage}
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
