import { useMemo, useState } from 'react'
import type { CSSProperties, ComponentProps, JSX } from 'react'
import { ApiError, createScenario } from '../api'
import type { ScenarioStatus } from '../api/scenarios'

type ScenarioPageProps = {
  onScenarioCreated: (scenarioId: string) => void
  onNext: () => void
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

const slugPattern = /^[a-z0-9-]+$/

const sectionStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '12px',
  padding: '20px',
  backgroundColor: '#ffffff',
}

const labelStyle: CSSProperties = {
  display: 'block',
  marginTop: '12px',
  marginBottom: '6px',
  fontWeight: 600,
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
}

const successStyle: CSSProperties = {
  marginTop: '12px',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #16a34a',
  color: '#166534',
  backgroundColor: '#ecfdf5',
}

const errorStyle: CSSProperties = {
  marginTop: '8px',
  color: '#b91c1c',
  fontSize: '14px',
}

const buttonStyle: CSSProperties = {
  marginTop: '16px',
  padding: '10px 14px',
  border: '1px solid #1f2937',
  borderRadius: '8px',
  backgroundColor: '#1f2937',
  color: '#ffffff',
  cursor: 'pointer',
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return `${error.code}: ${error.message}`
  }

  return 'UNKNOWN_ERROR: Failed to create scenario'
}

function LabeledInput(props: {
  id: string
  label: string
  required?: boolean
  value: string
  onChange: (nextValue: string) => void
  invalid?: boolean
}): JSX.Element {
  const { id, label, required = false, value, onChange, invalid = false } = props

  return (
    <>
      <label style={labelStyle} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        style={{ ...inputStyle, borderColor: invalid ? '#b91c1c' : '#d1d5db' }}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        required={required}
      />
    </>
  )
}

export function ScenarioPage({ onScenarioCreated, onNext }: ScenarioPageProps): JSX.Element {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<ScenarioStatus>('active')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdScenarioId, setCreatedScenarioId] = useState<string | null>(null)

  const isSlugInvalid = useMemo(() => slug.length > 0 && !slugPattern.test(slug), [slug])
  const isFormDisabled = createdScenarioId !== null

  const submitScenario = async (): Promise<void> => {
    if (isSlugInvalid) {
      setSubmitError('VALIDATION_ERROR: Slug must use lowercase letters, digits, and hyphens only')
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const scenario = await createScenario({ name, slug, status })
      setCreatedScenarioId(scenario.scenarioId)
      onScenarioCreated(scenario.scenarioId)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
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
          />

          <LabeledInput
            id="scenario-slug"
            label="Slug"
            value={slug}
            onChange={setSlug}
            required
            invalid={isSlugInvalid}
          />
          {isSlugInvalid && (
            <p style={errorStyle}>Slug must use lowercase letters, digits, and hyphens only.</p>
          )}

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
