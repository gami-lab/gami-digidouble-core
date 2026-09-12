import type { JSX } from 'react'
import type { ScenarioStatus } from '@gami/shared'
import { ModelSelectionFields } from './ModelSelectionFields'
import { ObjectivesEditor } from './ObjectivesEditor'
import type { ModelSelectionFormValue } from './model-selection-form'

type ScenarioFormFieldsProps = {
  name: string
  status: ScenarioStatus
  worldContext: string
  objectives: string[]
  defaultModelSelection: ModelSelectionFormValue
  gameMasterModelSelection: ModelSelectionFormValue
  voiceKey: string
  voiceLanguage: string
  idPrefix: string
  disabled: boolean
  onNameChange: (value: string) => void
  onStatusChange: (value: ScenarioStatus) => void
  onWorldContextChange: (value: string) => void
  onObjectivesChange: (objectives: string[]) => void
  onDefaultModelSelectionChange: (value: ModelSelectionFormValue) => void
  onGameMasterModelSelectionChange: (value: ModelSelectionFormValue) => void
  onVoiceKeyChange: (value: string) => void
  onVoiceLanguageChange: (value: string) => void
}

export function ScenarioFormFields({
  name,
  status,
  worldContext,
  objectives,
  defaultModelSelection,
  gameMasterModelSelection,
  voiceKey,
  voiceLanguage,
  idPrefix,
  disabled,
  onNameChange,
  onStatusChange,
  onWorldContextChange,
  onObjectivesChange,
  onDefaultModelSelectionChange,
  onGameMasterModelSelectionChange,
  onVoiceKeyChange,
  onVoiceLanguageChange,
}: ScenarioFormFieldsProps): JSX.Element {
  return (
    <>
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

      <ModelSelectionFields
        idPrefix={`${idPrefix}-default-model`}
        label="Scenario default model"
        value={defaultModelSelection}
        disabled={disabled}
        helperText="Used for avatar turns unless the avatar has its own override."
        onChange={onDefaultModelSelectionChange}
      />
      <ModelSelectionFields
        idPrefix={`${idPrefix}-gm-model`}
        label="Game Master override"
        value={gameMasterModelSelection}
        disabled={disabled}
        helperText="Used for Game Master turns. Leave empty to inherit the scenario default or global runtime config."
        onChange={onGameMasterModelSelectionChange}
      />
      <VoiceConfigurationFields
        idPrefix={idPrefix}
        voiceKey={voiceKey}
        voiceLanguage={voiceLanguage}
        disabled={disabled}
        onVoiceKeyChange={onVoiceKeyChange}
        onVoiceLanguageChange={onVoiceLanguageChange}
      />
    </>
  )
}

type VoiceConfigurationFieldsProps = {
  idPrefix: string
  voiceKey: string
  voiceLanguage: string
  disabled: boolean
  onVoiceKeyChange: (value: string) => void
  onVoiceLanguageChange: (value: string) => void
}

function VoiceConfigurationFields({
  idPrefix,
  voiceKey,
  voiceLanguage,
  disabled,
  onVoiceKeyChange,
  onVoiceLanguageChange,
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
      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-voice-language`} className="admin-form-label">
          Voice language
        </label>
        <input
          id={`${idPrefix}-voice-language`}
          type="text"
          className="admin-form-input"
          value={voiceLanguage}
          onChange={(e) => {
            onVoiceLanguageChange(e.target.value)
          }}
          disabled={disabled}
          placeholder="Optional language tag, e.g. en-US"
        />
      </div>
    </>
  )
}
