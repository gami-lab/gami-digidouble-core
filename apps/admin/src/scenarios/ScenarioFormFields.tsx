import type { JSX } from 'react'
import { MODEL_SELECTION_PROVIDER_NAMES, SCENARIO_MODEL_SLOTS, type ScenarioStatus } from '@gami/shared'
import { ModelSelectionTable } from '../model-selection/ModelSelectionTable'
import { ObjectivesEditor } from './ObjectivesEditor'
import {
  SCENARIO_MODEL_SLOT_FIELDS,
  type ScenarioModelSelectionFormValue,
} from './model-selection-form'

type ScenarioFormFieldsProps = {
  name: string
  status: ScenarioStatus
  language: string
  worldContext: string
  objectives: string[]
  modelSelection: ScenarioModelSelectionFormValue
  voiceKey: string
  idPrefix: string
  disabled: boolean
  onNameChange: (value: string) => void
  onStatusChange: (value: ScenarioStatus) => void
  onLanguageChange: (value: string) => void
  onWorldContextChange: (value: string) => void
  onObjectivesChange: (objectives: string[]) => void
  onModelSelectionChange: (value: ScenarioModelSelectionFormValue) => void
  onVoiceKeyChange: (value: string) => void
}

// eslint-disable-next-line max-lines-per-function
export function ScenarioFormFields({
  name,
  status,
  language,
  worldContext,
  objectives,
  modelSelection,
  voiceKey,
  idPrefix,
  disabled,
  onNameChange,
  onStatusChange,
  onLanguageChange,
  onWorldContextChange,
  onObjectivesChange,
  onModelSelectionChange,
  onVoiceKeyChange,
}: ScenarioFormFieldsProps): JSX.Element {
  return (
    <>
      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-language`} className="admin-form-label">
          Scenario language <span aria-hidden="true">*</span>
        </label>
        <select
          id={`${idPrefix}-language`}
          className="admin-form-select"
          value={language}
          onChange={(e) => {
            onLanguageChange(e.target.value)
          }}
          disabled={disabled}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-name`} className="admin-form-label">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          className="admin-form-input"
          value={name}
          onChange={(e) => {
            onNameChange(e.target.value)
          }}
          required
          disabled={disabled}
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-status`} className="admin-form-label">
          Status
        </label>
        <select
          id={`${idPrefix}-status`}
          className="admin-form-select"
          value={status}
          onChange={(e) => {
            onStatusChange(e.target.value as ScenarioStatus)
          }}
          disabled={disabled}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-world-context`} className="admin-form-label">
          World context
        </label>
        <textarea
          id={`${idPrefix}-world-context`}
          className="admin-form-textarea"
          rows={4}
          value={worldContext}
          onChange={(e) => {
            onWorldContextChange(e.target.value)
          }}
          disabled={disabled}
        />
      </div>

      <ObjectivesEditor objectives={objectives} disabled={disabled} onChange={onObjectivesChange} />

      <div className="admin-form-group">
        <p className="admin-form-label">Runtime models</p>
        <p className="admin-muted">
          Leave a row on inherit to use the scenario default, then the global model config.
        </p>
        <ModelSelectionTable
          providers={MODEL_SELECTION_PROVIDER_NAMES}
          disabled={disabled}
          rows={SCENARIO_MODEL_SLOTS.map((slot) => ({
            id: `${idPrefix}-${SCENARIO_MODEL_SLOT_FIELDS[slot].idSuffix}`,
            label: SCENARIO_MODEL_SLOT_FIELDS[slot].label,
            description: SCENARIO_MODEL_SLOT_FIELDS[slot].helperText,
            value: modelSelection[slot],
          }))}
          onChange={(rowId, value) => {
            const slot = SCENARIO_MODEL_SLOTS.find(
              (key) => `${idPrefix}-${SCENARIO_MODEL_SLOT_FIELDS[key].idSuffix}` === rowId,
            )
            if (slot === undefined) return
            onModelSelectionChange({ ...modelSelection, [slot]: value })
          }}
        />
      </div>
      <VoiceConfigurationFields
        idPrefix={idPrefix}
        voiceKey={voiceKey}
        disabled={disabled}
        onVoiceKeyChange={onVoiceKeyChange}
      />
    </>
  )
}

type VoiceConfigurationFieldsProps = {
  idPrefix: string
  voiceKey: string
  disabled: boolean
  onVoiceKeyChange: (value: string) => void
}

function VoiceConfigurationFields({
  idPrefix,
  voiceKey,
  disabled,
  onVoiceKeyChange,
}: VoiceConfigurationFieldsProps): JSX.Element {
  return (
    <>
      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-voice-key`} className="admin-form-label">
          Scenario default voice key
        </label>
        <input
          id={`${idPrefix}-voice-key`}
          type="text"
          className="admin-form-input"
          value={voiceKey}
          onChange={(e) => {
            onVoiceKeyChange(e.target.value)
          }}
          disabled={disabled}
          placeholder="Optional logical voice key"
        />
      </div>
    </>
  )
}
