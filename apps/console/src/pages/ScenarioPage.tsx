import { useEffect, useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import { createScenario, listScenarios } from '../api'
import { formatApiError } from '../api/error'
import type { ScenarioStatus, ScenarioSummary } from '../api/scenarios'
import { LabeledInput } from '../components/LabeledInput'
import {
  buttonStyle,
  errorStyle,
  inputStyle,
  labelStyle,
  sectionStyle,
  successStyle,
} from './form-styles'

type ScenarioPageProps = {
  selectedScenarioId: string | null
  onScenarioSelected: (scenario: ScenarioSummary) => void
  onNext: () => void
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

export function ScenarioPage({
  selectedScenarioId,
  onScenarioSelected,
  onNext,
}: ScenarioPageProps): JSX.Element {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<ScenarioStatus>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])

  useEffect(() => {
    void loadScenarios(setScenarios, setIsLoading, setListError)
  }, [])

  const handleSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void submitScenario(
      { name, status },
      onScenarioSelected,
      setSubmitError,
      setIsSubmitting,
      () => {
        setName('')
      },
      async () => loadScenarios(setScenarios, setIsLoading, setListError),
    )
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Scenario</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>Create a new scenario or select an existing one.</p>

      <ScenarioForm
        name={name}
        status={status}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onNameChange={setName}
        onStatusChange={setStatus}
        onSubmit={handleSubmit}
      />

      <ScenarioList
        scenarios={scenarios}
        isLoading={isLoading}
        listError={listError}
        selectedScenarioId={selectedScenarioId}
        onScenarioSelected={onScenarioSelected}
      />

      {selectedScenarioId !== null ? (
        <div style={successStyle}>
          Selected scenario: {selectedScenarioId}
          <div>
            <button type="button" style={{ ...buttonStyle, marginTop: '10px' }} onClick={onNext}>
              Next → Avatar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

type ScenarioFormProps = {
  name: string
  status: ScenarioStatus
  isSubmitting: boolean
  submitError: string | null
  onNameChange: (value: string) => void
  onStatusChange: (value: ScenarioStatus) => void
  onSubmit: (event: FormSubmitEvent) => void
}

function ScenarioForm({
  name,
  status,
  isSubmitting,
  submitError,
  onNameChange,
  onStatusChange,
  onSubmit,
}: ScenarioFormProps): JSX.Element {
  return (
    <form onSubmit={onSubmit}>
      <fieldset style={{ margin: 0, padding: 0, border: 'none' }} disabled={isSubmitting}>
        <LabeledInput
          id="scenario-name"
          label="Name"
          value={name}
          onChange={onNameChange}
          required
          style={inputStyle}
          labelStyle={labelStyle}
        />

        <label style={labelStyle} htmlFor="scenario-status">
          Status
        </label>
        <select
          id="scenario-status"
          style={inputStyle}
          value={status}
          onChange={(event) => {
            onStatusChange(event.target.value as ScenarioStatus)
          }}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>

        <button type="submit" style={buttonStyle} disabled={isSubmitting || name.trim() === ''}>
          {isSubmitting ? 'Creating…' : 'Create Scenario'}
        </button>

        {submitError !== null ? <p style={errorStyle}>{submitError}</p> : null}
      </fieldset>
    </form>
  )
}

type ScenarioListProps = {
  scenarios: ScenarioSummary[]
  isLoading: boolean
  listError: string | null
  selectedScenarioId: string | null
  onScenarioSelected: (scenario: ScenarioSummary) => void
}

function ScenarioList({
  scenarios,
  isLoading,
  listError,
  selectedScenarioId,
  onScenarioSelected,
}: ScenarioListProps): JSX.Element {
  return (
    <>
      <h3>Available scenarios</h3>
      {isLoading ? <p>Loading scenarios…</p> : null}
      {listError !== null ? <p style={errorStyle}>{listError}</p> : null}
      {scenarios.length === 0 ? <p style={{ color: '#6b7280' }}>No scenarios yet.</p> : null}
      {scenarios.map((scenario) => {
        const isSelected = scenario.scenarioId === selectedScenarioId
        return (
          <div
            key={scenario.scenarioId}
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
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Scenario ID: {scenario.scenarioId}</div>
            <button
              type="button"
              style={{ ...buttonStyle, marginTop: '8px' }}
              onClick={() => {
                onScenarioSelected(scenario)
              }}
            >
              {isSelected ? 'Selected scenario' : 'Select scenario'}
            </button>
          </div>
        )
      })}
    </>
  )
}

async function submitScenario(
  values: { name: string; status: ScenarioStatus },
  onScenarioSelected: (scenario: ScenarioSummary) => void,
  setSubmitError: (value: string | null) => void,
  setIsSubmitting: (value: boolean) => void,
  onSuccess: () => void,
  onAfterSubmit: () => Promise<void>,
): Promise<void> {
  setSubmitError(null)
  setIsSubmitting(true)

  try {
    const scenario = await createScenario(values)
    onScenarioSelected(scenario)
    onSuccess()
    await onAfterSubmit()
  } catch (error) {
    setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to create scenario'))
  } finally {
    setIsSubmitting(false)
  }
}

async function loadScenarios(
  setScenarios: (value: ScenarioSummary[]) => void,
  setIsLoading: (value: boolean) => void,
  setListError: (value: string | null) => void,
): Promise<void> {
  setListError(null)
  setIsLoading(true)

  try {
    const loadedScenarios = await listScenarios()
    setScenarios(loadedScenarios)
  } catch (error) {
    setListError(formatApiError(error, 'UNKNOWN_ERROR: Failed to load scenarios'))
  } finally {
    setIsLoading(false)
  }
}
