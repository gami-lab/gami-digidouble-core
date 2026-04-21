import { useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import { createScenario } from '../api'
import { formatApiError } from '../api/error'
import type { ScenarioStatus } from '../api/scenarios'
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
  onScenarioCreated: (scenarioId: string) => void
  onNext: () => void
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

export function ScenarioPage({ onScenarioCreated, onNext }: ScenarioPageProps): JSX.Element {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<ScenarioStatus>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdScenarioId, setCreatedScenarioId] = useState<string | null>(null)

  const isFormDisabled = createdScenarioId !== null

  const submitScenario = async (): Promise<void> => {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const scenario = await createScenario({ name, status })
      setCreatedScenarioId(scenario.scenarioId)
      onScenarioCreated(scenario.scenarioId)
    } catch (error) {
      setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to create scenario'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void submitScenario()
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Create Scenario</h2>

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={isFormDisabled}
          style={{ margin: 0, padding: 0, border: 'none', opacity: isFormDisabled ? 0.6 : 1 }}
        >
          <LabeledInput
            id="scenario-name"
            label="Name"
            value={name}
            onChange={setName}
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
              setStatus(event.target.value as ScenarioStatus)
            }}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>

          <button type="submit" style={buttonStyle} disabled={isSubmitting || isFormDisabled}>
            {isSubmitting ? 'Creating…' : 'Create Scenario'}
          </button>

          {submitError !== null && <p style={errorStyle}>{submitError}</p>}
        </fieldset>
      </form>

      {createdScenarioId !== null && (
        <>
          <div style={successStyle}>Scenario created: {createdScenarioId}</div>
          <button type="button" style={buttonStyle} onClick={onNext}>
            Next →
          </button>
        </>
      )}
    </section>
  )
}
