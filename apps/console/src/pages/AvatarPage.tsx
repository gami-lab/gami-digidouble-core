import { useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import { createAvatar } from '../api'
import { formatApiError } from '../api/error'
import { LabeledInput } from '../components/LabeledInput'
import {
  buttonStyle,
  errorStyle,
  inputStyle,
  labelStyle,
  sectionStyle,
  successStyle,
} from './form-styles'

type AvatarPageProps = {
  scenarioId: string
  onAvatarCreated: (avatarId: string) => void
  onNext: () => void
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

type PersonaPromptFieldProps = {
  value: string
  onChange: (nextValue: string) => void
}

function PersonaPromptField({ value, onChange }: PersonaPromptFieldProps): JSX.Element {
  return (
    <>
      <label style={labelStyle} htmlFor="avatar-persona-prompt">
        Persona Prompt
      </label>
      <textarea
        id="avatar-persona-prompt"
        style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        required
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
      setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to create avatar'))
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
          <LabeledInput
            id="avatar-name"
            label="Name"
            value={name}
            onChange={setName}
            required
            style={inputStyle}
            labelStyle={labelStyle}
          />
          <LabeledInput
            id="avatar-slug"
            label="Slug"
            value={slug}
            onChange={setSlug}
            required
            style={inputStyle}
            labelStyle={labelStyle}
          />

          <PersonaPromptField value={personaPrompt} onChange={setPersonaPrompt} />

          <LabeledInput
            id="avatar-tone"
            label="Tone (optional)"
            value={tone}
            onChange={setTone}
            style={inputStyle}
            labelStyle={labelStyle}
          />
          <LabeledInput
            id="avatar-description"
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            style={inputStyle}
            labelStyle={labelStyle}
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
