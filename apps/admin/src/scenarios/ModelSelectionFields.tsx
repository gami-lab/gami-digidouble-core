import type { JSX } from 'react'
import {
  MODEL_SELECTION_PROVIDER_NAMES,
  getModelPresetOptions,
} from '@gami/shared'
import type { ModelSelectionFormValue } from './model-selection-form'

type ModelSelectionFieldsProps = {
  idPrefix: string
  label: string
  value: ModelSelectionFormValue
  disabled: boolean
  helperText?: string
  onChange: (value: ModelSelectionFormValue) => void
}

export function ModelSelectionFields({
  idPrefix,
  label,
  value,
  disabled,
  helperText,
  onChange,
}: ModelSelectionFieldsProps): JSX.Element {
  const modelOptions = getModelPresetOptions(value.provider, value.model)

  return (
    <div className="admin-form-group">
      <p className="admin-form-label">{label}</p>
      {helperText !== undefined ? <p className="admin-muted">{helperText}</p> : null}

      <label htmlFor={`${idPrefix}-provider`} className="admin-form-label">
        Provider
      </label>
      <select
        id={`${idPrefix}-provider`}
        className="admin-form-select"
        value={value.provider}
        onChange={(event) => {
          const provider = event.target.value
          const nextModelOptions = getModelPresetOptions(provider, value.model)
          const model = nextModelOptions.some((option) => option.value === value.model)
            ? value.model
            : ''
          onChange({ provider, model })
        }}
        disabled={disabled}
      >
        <option value="">inherit</option>
        {MODEL_SELECTION_PROVIDER_NAMES.map((provider) => (
          <option key={provider} value={provider}>
            {provider}
          </option>
        ))}
      </select>

      <label htmlFor={`${idPrefix}-model`} className="admin-form-label">
        Model
      </label>
      <select
        id={`${idPrefix}-model`}
        className="admin-form-select"
        value={value.model}
        onChange={(event) => {
          onChange({ ...value, model: event.target.value })
        }}
        disabled={disabled}
      >
        <option value="">inherit</option>
        {modelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
