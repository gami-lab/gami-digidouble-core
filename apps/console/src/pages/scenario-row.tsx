import { useState } from 'react'
import type { ComponentProps, CSSProperties, JSX } from 'react'
import { ApiError } from '../api/client'
import { updateScenario, deleteScenario } from '../api/scenarios'
import type { ScenarioStatus, ScenarioSummary } from '../api/scenarios'
import { formatApiError } from '../api/error'
import { LabeledInput } from '../components/LabeledInput'
import { buttonStyle, errorStyle, inputStyle, labelStyle } from './form-styles'

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  marginTop: '8px',
  backgroundColor: '#6b7280',
  borderColor: '#6b7280',
}

const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  marginTop: '8px',
  backgroundColor: '#b91c1c',
  borderColor: '#b91c1c',
}

type ScenarioRowProps = {
  scenario: ScenarioSummary
  isSelected: boolean
  onSelected: (scenario: ScenarioSummary) => void
  onUpdated: (scenario: ScenarioSummary) => void
  onDeleted: (scenarioId: string) => void
}

export function ScenarioRow({
  scenario,
  isSelected,
  onSelected,
  onUpdated,
  onDeleted,
}: ScenarioRowProps): JSX.Element {
  const [editMode, setEditMode] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = (): void => {
    void performDeleteScenario(scenario.scenarioId, onDeleted, setDeleteError)
  }

  if (editMode) {
    return (
      <ScenarioEditForm
        scenario={scenario}
        onSaved={(updated) => {
          onUpdated(updated)
          setEditMode(false)
        }}
        onCancel={() => {
          setEditMode(false)
        }}
      />
    )
  }

  return (
    <div
      style={{
        marginTop: '8px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '10px',
        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
      }}
    >
      <div>
        <strong>{scenario.name}</strong> · {scenario.status}
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280' }}>
        Scenario ID: {scenario.scenarioId}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          style={{ ...buttonStyle, marginTop: '8px' }}
          onClick={() => {
            onSelected(scenario)
          }}
        >
          {isSelected ? 'Selected scenario' : 'Select scenario'}
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, marginTop: '8px' }}
          onClick={() => {
            setEditMode(true)
          }}
        >
          Edit
        </button>
        <button type="button" style={dangerButtonStyle} onClick={handleDelete}>
          Delete
        </button>
      </div>
      {deleteError !== null ? <p style={errorStyle}>{deleteError}</p> : null}
    </div>
  )
}

type ScenarioEditFormProps = {
  scenario: ScenarioSummary
  onSaved: (updated: ScenarioSummary) => void
  onCancel: () => void
}

export function ScenarioEditForm({
  scenario,
  onSaved,
  onCancel,
}: ScenarioEditFormProps): JSX.Element {
  const [name, setName] = useState(scenario.name)
  const [status, setStatus] = useState<ScenarioStatus>(scenario.status)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void performUpdateScenario(
      scenario.scenarioId,
      { name, status },
      onSaved,
      setSubmitError,
      setIsSubmitting,
    )
  }

  return (
    <div
      style={{
        marginTop: '8px',
        border: '1px solid #2563eb',
        borderRadius: '8px',
        padding: '10px',
        backgroundColor: '#eff6ff',
      }}
    >
      <form onSubmit={handleSubmit}>
        <fieldset style={{ margin: 0, padding: 0, border: 'none' }} disabled={isSubmitting}>
          <LabeledInput
            id={`edit-scenario-name-${scenario.scenarioId}`}
            label="Name"
            value={name}
            onChange={setName}
            required
            style={inputStyle}
            labelStyle={labelStyle}
          />
          <label style={labelStyle} htmlFor={`edit-scenario-status-${scenario.scenarioId}`}>
            Status
          </label>
          <select
            id={`edit-scenario-status-${scenario.scenarioId}`}
            style={inputStyle}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ScenarioStatus)
            }}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              style={buttonStyle}
              disabled={isSubmitting || name.trim() === ''}
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
              Cancel
            </button>
          </div>
          {submitError !== null ? <p style={errorStyle}>{submitError}</p> : null}
        </fieldset>
      </form>
    </div>
  )
}

async function performUpdateScenario(
  scenarioId: string,
  updates: { name: string; status: ScenarioStatus },
  onSaved: (updated: ScenarioSummary) => void,
  setSubmitError: (e: string | null) => void,
  setIsSubmitting: (v: boolean) => void,
): Promise<void> {
  setSubmitError(null)
  setIsSubmitting(true)
  try {
    const updated = await updateScenario(scenarioId, updates)
    onSaved(updated)
  } catch (error) {
    setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update scenario'))
  } finally {
    setIsSubmitting(false)
  }
}

async function performDeleteScenario(
  scenarioId: string,
  onDeleted: (id: string) => void,
  setDeleteError: (e: string | null) => void,
): Promise<void> {
  if (!window.confirm('Delete scenario?')) return
  setDeleteError(null)
  try {
    await deleteScenario(scenarioId)
    onDeleted(scenarioId)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CONFLICT') {
      setDeleteError('Cannot delete: scenario has avatars or active sessions.')
    } else {
      setDeleteError(formatApiError(error, 'UNKNOWN_ERROR: Failed to delete scenario'))
    }
  }
}
