import type { JSX } from 'react'
import { ObjectivesEditor } from './ObjectivesEditor'

type ScenarioFormFieldsProps = {
  name: string
  status: 'draft' | 'active' | 'archived'
  worldContext: string
  objectives: string[]
  idPrefix: string
  disabled: boolean
  onNameChange: (value: string) => void
  onStatusChange: (value: 'draft' | 'active' | 'archived') => void
  onWorldContextChange: (value: string) => void
  onObjectivesChange: (objectives: string[]) => void
}

export function ScenarioFormFields({
  name,
  status,
  worldContext,
  objectives,
  idPrefix,
  disabled,
  onNameChange,
  onStatusChange,
  onWorldContextChange,
  onObjectivesChange,
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
    </>
  )
}
