import type { JSX } from 'react'
import { ModelSelectionFields } from './ModelSelectionFields'
import { ObjectivesEditor } from './ObjectivesEditor'
import type { ModelSelectionFormValue } from './model-selection-form'

type ScenarioFormFieldsProps = {
  name: string
  status: 'draft' | 'active' | 'archived'
  worldContext: string
  objectives: string[]
  defaultModelSelection: ModelSelectionFormValue
  gameMasterModelSelection: ModelSelectionFormValue
  idPrefix: string
  disabled: boolean
  onNameChange: (value: string) => void
  onStatusChange: (value: 'draft' | 'active' | 'archived') => void
  onWorldContextChange: (value: string) => void
  onObjectivesChange: (objectives: string[]) => void
  onDefaultModelSelectionChange: (value: ModelSelectionFormValue) => void
  onGameMasterModelSelectionChange: (value: ModelSelectionFormValue) => void
}

export function ScenarioFormFields({
  name,
  status,
  worldContext,
  objectives,
  defaultModelSelection,
  gameMasterModelSelection,
  idPrefix,
  disabled,
  onNameChange,
  onStatusChange,
  onWorldContextChange,
  onObjectivesChange,
  onDefaultModelSelectionChange,
  onGameMasterModelSelectionChange,
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
          onChange={(e) => { onNameChange(e.target.value) }}
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
          onChange={(e) => { onStatusChange(e.target.value as 'draft' | 'active' | 'archived') }}
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
          onChange={(e) => { onWorldContextChange(e.target.value) }}
          disabled={disabled}
        />
      </div>

      <ObjectivesEditor
        objectives={objectives}
        disabled={disabled}
        onChange={onObjectivesChange}
      />

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
    </>
  )
}
