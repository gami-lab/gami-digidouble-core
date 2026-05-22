import { useEffect, useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import { createAvatar, listScenarioAvatars } from '../api'
import { getModelPresetOptions } from '../api/model-presets'
import { PROVIDER_OPTIONS } from '../api/provider-options'
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
import { AvatarRow } from './avatar-row'

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
  llmProviderOverride: string
  llmModelOverride: string
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
    llmProviderOverride: '',
    llmModelOverride: '',
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
        setValues({
          name: '',
          personaPrompt: '',
          tone: '',
          description: '',
          llmProviderOverride: '',
          llmModelOverride: '',
        })
      },
      async () => loadAvatars(scenarioId, setAvatars, setIsLoading, setListError),
    )
  }

  const handleAvatarUpdated = (updated: AvatarSummary): void => {
    setAvatars((prev) => prev.map((a) => (a.avatarId === updated.avatarId ? updated : a)))
  }

  const handleAvatarDeleted = (avatarId: string): void => {
    setAvatars((prev) => prev.filter((a) => a.avatarId !== avatarId))
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
        onAvatarUpdated={handleAvatarUpdated}
        onAvatarDeleted={handleAvatarDeleted}
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
  const [isOverrideExpanded, setIsOverrideExpanded] = useState(false)

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
        <ModelOverrideFields
          values={values}
          isOverrideExpanded={isOverrideExpanded}
          setIsOverrideExpanded={setIsOverrideExpanded}
          onValuesChange={onValuesChange}
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

type ModelOverrideFieldsProps = {
  values: AvatarFormValues
  isOverrideExpanded: boolean
  setIsOverrideExpanded: (isOpen: boolean) => void
  onValuesChange: (values: AvatarFormValues) => void
}

function ModelOverrideFields({
  values,
  isOverrideExpanded,
  setIsOverrideExpanded,
  onValuesChange,
}: ModelOverrideFieldsProps): JSX.Element {
  const modelOptions = getModelPresetOptions(values.llmProviderOverride, values.llmModelOverride)

  return (
    <details
      open={isOverrideExpanded}
      onToggle={(event) => {
        setIsOverrideExpanded(event.currentTarget.open)
      }}
      style={{ marginTop: '8px' }}
    >
      <summary style={{ cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
        Model Override (optional)
      </summary>
      <label style={labelStyle} htmlFor="avatar-llm-provider-override">
        Provider override
      </label>
      <select
        id="avatar-llm-provider-override"
        style={inputStyle}
        value={values.llmProviderOverride}
        onChange={(event) => {
          const llmProviderOverride = event.target.value
          const nextModelOptions = getModelPresetOptions(llmProviderOverride, values.llmModelOverride)
          const llmModelOverride =
            nextModelOptions.some((option) => option.value === values.llmModelOverride)
              ? values.llmModelOverride
              : ''
          onValuesChange({ ...values, llmProviderOverride, llmModelOverride })
        }}
      >
        <option value="">inherit</option>
        {PROVIDER_OPTIONS.map((provider) => (
          <option key={provider} value={provider}>
            {provider}
          </option>
        ))}
      </select>
      <label style={labelStyle} htmlFor="avatar-llm-model-override">
        Model override
      </label>
      <select
        id="avatar-llm-model-override"
        style={inputStyle}
        value={values.llmModelOverride}
        onChange={(event) => {
          onValuesChange({ ...values, llmModelOverride: event.target.value })
        }}
      >
        <option value="">inherit</option>
        {modelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </details>
  )
}

type AvatarListProps = {
  avatars: AvatarSummary[]
  isLoading: boolean
  listError: string | null
  selectedAvatarId: string | null
  onAvatarSelected: (avatar: AvatarSummary) => void
  onAvatarUpdated: (avatar: AvatarSummary) => void
  onAvatarDeleted: (avatarId: string) => void
}

function AvatarList({
  avatars,
  isLoading,
  listError,
  selectedAvatarId,
  onAvatarSelected,
  onAvatarUpdated,
  onAvatarDeleted,
}: AvatarListProps): JSX.Element {
  return (
    <>
      <h3>Scenario avatars</h3>
      {isLoading ? <p>Loading avatars…</p> : null}
      {listError !== null ? <p style={errorStyle}>{listError}</p> : null}
      {avatars.length === 0 ? <p style={{ color: '#6b7280' }}>No avatars yet.</p> : null}
      {avatars.map((avatar) => (
        <AvatarRow
          key={avatar.avatarId}
          avatar={avatar}
          isSelected={avatar.avatarId === selectedAvatarId}
          onSelected={onAvatarSelected}
          onUpdated={onAvatarUpdated}
          onDeleted={onAvatarDeleted}
        />
      ))}
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
      ...(() => {
        const provider = values.llmProviderOverride.trim()
        const model = values.llmModelOverride.trim()
        if (provider.length === 0 && model.length === 0) return { llmOverride: null }
        return {
          llmOverride: {
            ...(provider.length > 0 ? { provider } : {}),
            ...(model.length > 0 ? { model } : {}),
          },
        }
      })(),
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
