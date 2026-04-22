import { useEffect, useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import { createAvatar, listScenarioAvatars } from '../api'
import { formatApiError } from '../api/error'
import type { AvatarSummary } from '../api/scenarios'
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
  selectedAvatarId: string | null
  onAvatarSelected: (avatar: AvatarSummary) => void
  onNext: () => void
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

type AvatarFormValues = {
  name: string
  personaPrompt: string
  tone: string
  description: string
}

export function AvatarPage({
  scenarioId,
  selectedAvatarId,
  onAvatarSelected,
  onNext,
}: AvatarPageProps): JSX.Element {
  const [values, setValues] = useState<AvatarFormValues>({
    name: '',
    personaPrompt: '',
    tone: '',
    description: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [avatars, setAvatars] = useState<AvatarSummary[]>([])

  useEffect(() => {
    void loadAvatars(scenarioId, setAvatars, setIsLoading, setListError)
  }, [scenarioId])

  const handleSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()

    void submitAvatar(
      scenarioId,
      values,
      onAvatarSelected,
      setSubmitError,
      setIsSubmitting,
      () => {
        setValues({ name: '', personaPrompt: '', tone: '', description: '' })
      },
      async () => loadAvatars(scenarioId, setAvatars, setIsLoading, setListError),
    )
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Avatar</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>Scenario: {scenarioId}</p>
      <p style={{ marginTop: 0, color: '#4b5563' }}>Create avatars or select one for testing.</p>

      <AvatarForm
        values={values}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onValuesChange={setValues}
        onSubmit={handleSubmit}
      />

      <AvatarList
        avatars={avatars}
        isLoading={isLoading}
        listError={listError}
        selectedAvatarId={selectedAvatarId}
        onAvatarSelected={onAvatarSelected}
      />

      {selectedAvatarId !== null ? (
        <div style={successStyle}>
          Selected avatar: {selectedAvatarId}
          <div>
            <button type="button" style={{ ...buttonStyle, marginTop: '10px' }} onClick={onNext}>
              Next → Session
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

type AvatarFormProps = {
  values: AvatarFormValues
  isSubmitting: boolean
  submitError: string | null
  onValuesChange: (values: AvatarFormValues) => void
  onSubmit: (event: FormSubmitEvent) => void
}

function AvatarForm({ values, isSubmitting, submitError, onValuesChange, onSubmit }: AvatarFormProps): JSX.Element {
  return (
    <form onSubmit={onSubmit}>
      <fieldset style={{ margin: 0, padding: 0, border: 'none' }} disabled={isSubmitting}>
        <LabeledInput
          id="avatar-name"
          label="Name"
          value={values.name}
          onChange={(name) => {
            onValuesChange({ ...values, name })
          }}
          required
          style={inputStyle}
          labelStyle={labelStyle}
        />

        <label style={labelStyle} htmlFor="avatar-persona-prompt">
          Persona Prompt
        </label>
        <textarea
          id="avatar-persona-prompt"
          style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
          value={values.personaPrompt}
          onChange={(event) => {
            onValuesChange({ ...values, personaPrompt: event.target.value })
          }}
          required
        />

        <LabeledInput
          id="avatar-tone"
          label="Tone (optional)"
          value={values.tone}
          onChange={(tone) => {
            onValuesChange({ ...values, tone })
          }}
          style={inputStyle}
          labelStyle={labelStyle}
        />
        <LabeledInput
          id="avatar-description"
          label="Description (optional)"
          value={values.description}
          onChange={(description) => {
            onValuesChange({ ...values, description })
          }}
          style={inputStyle}
          labelStyle={labelStyle}
        />

        <button
          type="submit"
          style={buttonStyle}
          disabled={isSubmitting || values.name.trim() === '' || values.personaPrompt.trim() === ''}
        >
          {isSubmitting ? 'Creating…' : 'Create Avatar'}
        </button>

        {submitError !== null ? <p style={errorStyle}>{submitError}</p> : null}
      </fieldset>
    </form>
  )
}

type AvatarListProps = {
  avatars: AvatarSummary[]
  isLoading: boolean
  listError: string | null
  selectedAvatarId: string | null
  onAvatarSelected: (avatar: AvatarSummary) => void
}

function AvatarList({
  avatars,
  isLoading,
  listError,
  selectedAvatarId,
  onAvatarSelected,
}: AvatarListProps): JSX.Element {
  return (
    <>
      <h3>Scenario avatars</h3>
      {isLoading ? <p>Loading avatars…</p> : null}
      {listError !== null ? <p style={errorStyle}>{listError}</p> : null}
      {avatars.length === 0 ? <p style={{ color: '#6b7280' }}>No avatars yet.</p> : null}
      {avatars.map((avatar) => {
        const isSelected = avatar.avatarId === selectedAvatarId
        return (
          <div
            key={avatar.avatarId}
            style={{
              marginTop: '8px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '10px',
              backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
            }}
          >
            <div>
              <strong>{avatar.name}</strong> · {avatar.status}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Avatar ID: {avatar.avatarId}</div>
            <button
              type="button"
              style={{ ...buttonStyle, marginTop: '8px' }}
              onClick={() => {
                onAvatarSelected(avatar)
              }}
            >
              {isSelected ? 'Selected avatar' : 'Select avatar'}
            </button>
          </div>
        )
      })}
    </>
  )
}

async function submitAvatar(
  scenarioId: string,
  values: AvatarFormValues,
  onAvatarSelected: (avatar: AvatarSummary) => void,
  setSubmitError: (value: string | null) => void,
  setIsSubmitting: (value: boolean) => void,
  onSuccess: () => void,
  onAfterSubmit: () => Promise<void>,
): Promise<void> {
  setSubmitError(null)
  setIsSubmitting(true)

  try {
    const avatar = await createAvatar(scenarioId, {
      name: values.name,
      personaPrompt: values.personaPrompt,
      ...(values.tone.trim().length > 0 ? { tone: values.tone } : {}),
      ...(values.description.trim().length > 0 ? { description: values.description } : {}),
    })

    onAvatarSelected(avatar)
    onSuccess()
    await onAfterSubmit()
  } catch (error) {
    setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to create avatar'))
  } finally {
    setIsSubmitting(false)
  }
}

async function loadAvatars(
  scenarioId: string,
  setAvatars: (value: AvatarSummary[]) => void,
  setIsLoading: (value: boolean) => void,
  setListError: (value: string | null) => void,
): Promise<void> {
  setListError(null)
  setIsLoading(true)

  try {
    const loadedAvatars = await listScenarioAvatars(scenarioId)
    setAvatars(loadedAvatars)
  } catch (error) {
    setListError(formatApiError(error, 'UNKNOWN_ERROR: Failed to load avatars'))
  } finally {
    setIsLoading(false)
  }
}
