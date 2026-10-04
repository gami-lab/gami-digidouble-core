import type { JSX } from 'react'
import { getModelPresetOptions } from '@gami/shared'

export type ModelSelectionValue = {
  provider: string
  model: string
}

export type ModelSelectionRow = {
  /** DOM id prefix: selects get `${id}-provider` and `${id}-model`. */
  id: string
  label: string
  description?: string
  value: ModelSelectionValue
}

type ModelSelectionTableProps = {
  rows: ModelSelectionRow[]
  providers: readonly string[]
  disabled?: boolean
  onChange: (rowId: string, value: ModelSelectionValue) => void
}

/** Shared provider/model override editor used by global model config, scenarios, and avatars. */
export function ModelSelectionTable({
  rows,
  providers,
  disabled = false,
  onChange,
}: ModelSelectionTableProps): JSX.Element {
  return (
    <table className="admin-table admin-model-table">
      <thead>
        <tr>
          <th>Role</th>
          <th>Provider override</th>
          <th>Model override</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <ModelSelectionTableRow
            key={row.id}
            row={row}
            providers={providers}
            disabled={disabled}
            onChange={(value) => {
              onChange(row.id, value)
            }}
          />
        ))}
      </tbody>
    </table>
  )
}

type ModelSelectionTableRowProps = {
  row: ModelSelectionRow
  providers: readonly string[]
  disabled: boolean
  onChange: (value: ModelSelectionValue) => void
}

function ModelSelectionTableRow({
  row,
  providers,
  disabled,
  onChange,
}: ModelSelectionTableRowProps): JSX.Element {
  const { value } = row
  const modelOptions = getModelPresetOptions(value.provider, value.model)

  return (
    <tr>
      <td>
        {row.label}
        {row.description !== undefined ? (
          <p className="admin-muted admin-model-table-hint">{row.description}</p>
        ) : null}
      </td>
      <td>
        <select
          id={`${row.id}-provider`}
          aria-label={`${row.label} provider`}
          className="admin-form-select"
          value={value.provider}
          disabled={disabled}
          onChange={(event) => {
            onChange(selectProvider(value, event.target.value))
          }}
        >
          <option value="">inherit</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          id={`${row.id}-model`}
          aria-label={`${row.label} model`}
          className="admin-form-select"
          value={value.model}
          disabled={disabled}
          onChange={(event) => {
            onChange({ ...value, model: event.target.value })
          }}
        >
          <option value="">inherit</option>
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="admin-button admin-button-secondary"
          disabled={disabled}
          onClick={() => {
            onChange({ provider: '', model: '' })
          }}
        >
          Reset to default
        </button>
      </td>
    </tr>
  )
}

/** Changes the provider and keeps the model only if the new provider supports it. */
export function selectProvider(value: ModelSelectionValue, provider: string): ModelSelectionValue {
  // Pass no current model: the preset list always includes the current one otherwise.
  const supported = getModelPresetOptions(provider, '').some(
    (option) => option.value === value.model,
  )
  return { provider, model: supported ? value.model : '' }
}
