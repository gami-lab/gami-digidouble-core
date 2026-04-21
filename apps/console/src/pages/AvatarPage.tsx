import { useState } from 'react'
import type { CSSProperties, ComponentProps, JSX } from 'react'
import { ApiError, createAvatar } from '../api'

type AvatarPageProps = {
  scenarioId: string
  onAvatarCreated: (avatarId: string) => void
  onNext: () => void
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

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

  return 'UNKNOWN_ERROR: Failed to create avatar'
}

function LabeledInput(props: {
  id: string
  label: string
  value: string
  onChange: (nextValue: string) => void
  required?: boolean
}): JSX.Element {
  const { id, label, value, onChange, required = false } = props

  return (
    <>
      <label style={labelStyle} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        style={inputStyle}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        required={required}
      />
    </>
  )
}

export function AvatarPage({ scenarioId, onAvatarCreated, onNext }: AvatarPageProps): JSX.Element {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [personaPrompt, setPersonaPrompt] = useState('')
  const [tone, setTone] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdAvatarId, setCreatedAvatarId] = useState<string | null>(null)

  const isFormDisabled = createdAvatarId !== null

  const submitAvatar = async (): Promise<void> => {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const avatar = await createAvatar(scenarioId, {
        name,
        slug,
        personaPrompt,
        ...(tone.trim().length > 0 ? { tone } : {}),
        ...(description.trim().length > 0 ? { description } : {}),
      })

      setCreatedAvatarId(avatar.avatarId)
      onAvatarCreated(avatar.avatarId)
    } catch (error) {
      setSubmitError(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void submitAvatar()
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Create Avatar</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>Scenario: {scenarioId}</p>

      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={isFormDisabled}
          style={{ margin: 0, padding: 0, border: 'none', opacity: isFormDisabled ? 0.6 : 1 }}
        >
          <LabeledInput id="avatar-name" label="Name" value={name} onChange={setName} required />
          <LabeledInput id="avatar-slug" label="Slug" value={slug} onChange={setSlug} required />

          <label style={labelStyle} htmlFor="avatar-persona-prompt">
            Persona Prompt
          </label>
          <textarea
            id="avatar-persona-prompt"
            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
            value={personaPrompt}
            onChange={(event) => {
              setPersonaPrompt(event.target.value)
            }}
            required
          />

          <LabeledInput id="avatar-tone" label="Tone (optional)" value={tone} onChange={setTone} />
          <LabeledInput
            id="avatar-description"
            label="Description (optional)"
            value={description}
            onChange={setDescription}
          />

          <button type="submit" style={buttonStyle} disabled={isSubmitting || isFormDisabled}>
            {isSubmitting ? 'Creating…' : 'Create Avatar'}
          </button>

          {submitError !== null && <p style={errorStyle}>{submitError}</p>}
        </fieldset>
      </form>

      {createdAvatarId !== null && (
        <>
          <div style={successStyle}>Avatar created: {createdAvatarId}</div>
          <button type="button" style={buttonStyle} onClick={onNext}>
            Next →
          </button>
        </>
      )}
    </section>
  )
}
