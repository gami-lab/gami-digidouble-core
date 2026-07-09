/* eslint-disable max-lines, max-lines-per-function */
import { useEffect, useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import type { ModelSelectionProviderName } from '@gami/shared'
import {
  createAvatar,
  createScenario,
  listScenarioAvatars,
  listScenarios,
  updateScenario,
} from '../api'
import { PROVIDER_OPTIONS } from '../api/provider-options'
import { formatApiError } from '../api/error'
import type {
  AvatarSummary,
  CreateScenarioParams,
  ScenarioStatus,
  ScenarioSummary,
} from '../api/scenarios'
import { LabeledInput } from '../components/LabeledInput'
import {
  buttonStyle,
  errorStyle,
  inputStyle,
  labelStyle,
  sectionStyle,
  successStyle,
} from './form-styles'
import { ScenarioRow } from './scenario-row'
import { AvatarRow } from './avatar-row'

type ScenarioPageProps = {
  selectedScenarioId: string | null
  onScenarioSelected: (scenario: ScenarioSummary) => void
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

export function ScenarioPage({
  selectedScenarioId,
  onScenarioSelected,
  onNext,
}: ScenarioPageProps): JSX.Element {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<ScenarioStatus>('active')
  const [worldContext, setWorldContext] = useState('')
  const [objectivesText, setObjectivesText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const avatarSection = useAvatarSection(selectedScenarioId)
  const selectedScenario =
    scenarios.find((scenario) => scenario.scenarioId === selectedScenarioId) ?? null

  useEffect(() => {
    void loadScenarios(setScenarios, setIsLoading, setListError)
  }, [])

  const handleScenarioUpdated = (updated: ScenarioSummary): void => {
    setScenarios((prev) => prev.map((s) => (s.scenarioId === updated.scenarioId ? updated : s)))
  }

  const handleSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    const objectives = parseObjectives(objectivesText)
    void submitScenario(
      {
        name,
        status,
        ...(worldContext.trim().length > 0 ? { worldContext: worldContext.trim() } : {}),
        ...(objectives.length > 0 ? { objectives } : {}),
      },
      onScenarioSelected,
      setSubmitError,
      setIsSubmitting,
      () => {
        setName('')
        setWorldContext('')
        setObjectivesText('')
      },
      async () => loadScenarios(setScenarios, setIsLoading, setListError),
    )
  }

  const handleScenarioDeleted = (scenarioId: string): void => {
    setScenarios((prev) => prev.filter((s) => s.scenarioId !== scenarioId))
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Scenario</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Create a new scenario or select an existing one.
      </p>

      <ScenarioForm
        name={name}
        status={status}
        worldContext={worldContext}
        objectivesText={objectivesText}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onNameChange={setName}
        onStatusChange={setStatus}
        onWorldContextChange={setWorldContext}
        onObjectivesTextChange={setObjectivesText}
        onSubmit={handleSubmit}
      />

      <ScenarioList
        scenarios={scenarios}
        isLoading={isLoading}
        listError={listError}
        selectedScenarioId={selectedScenarioId}
        onScenarioSelected={onScenarioSelected}
        onScenarioUpdated={handleScenarioUpdated}
        onScenarioDeleted={handleScenarioDeleted}
      />

      {selectedScenarioId !== null ? (
        <>
          <div style={successStyle}>✓ Selected scenario: {selectedScenarioId}</div>
          <AvatarSection {...avatarSection} />
          {selectedScenario !== null ? (
            <ScenarioAvatarAvailabilityEditor
              scenario={selectedScenario}
              avatars={avatarSection.avatars}
              onScenarioUpdated={handleScenarioUpdated}
            />
          ) : null}
          <div style={{ marginTop: '20px' }}>
            <button type="button" style={buttonStyle} onClick={onNext}>
              Next → Session
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

function parseObjectives(objectivesText: string): string[] {
  return objectivesText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function useAvatarSection(selectedScenarioId: string | null): AvatarSectionProps {
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
    if (selectedScenarioId === null) {
      setAvatars([])
      return
    }
    void loadAvatars(selectedScenarioId, setAvatars, setIsLoading, setListError)
  }, [selectedScenarioId])

  const onSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    if (selectedScenarioId === null) return
    void submitAvatar(
      selectedScenarioId,
      values,
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
      async () => loadAvatars(selectedScenarioId, setAvatars, setIsLoading, setListError),
    )
  }

  const onAvatarUpdated = (updated: AvatarSummary): void => {
    setAvatars((prev) => prev.map((a) => (a.avatarId === updated.avatarId ? updated : a)))
  }

  const onAvatarDeleted = (avatarId: string): void => {
    setAvatars((prev) => prev.filter((a) => a.avatarId !== avatarId))
  }

  return {
    values,
    isSubmitting,
    submitError,
    avatars,
    isLoading,
    listError,
    onValuesChange: setValues,
    onSubmit,
    onAvatarUpdated,
    onAvatarDeleted,
  }
}

type ScenarioFormProps = {
  name: string
  status: ScenarioStatus
  worldContext: string
  objectivesText: string
  isSubmitting: boolean
  submitError: string | null
  onNameChange: (value: string) => void
  onStatusChange: (value: ScenarioStatus) => void
  onWorldContextChange: (value: string) => void
  onObjectivesTextChange: (value: string) => void
  onSubmit: (event: FormSubmitEvent) => void
}

function ScenarioForm({
  name,
  status,
  worldContext,
  objectivesText,
  isSubmitting,
  submitError,
  onNameChange,
  onStatusChange,
  onWorldContextChange,
  onObjectivesTextChange,
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

        <label style={labelStyle} htmlFor="scenario-world-context">
          World context (optional)
        </label>
        <textarea
          id="scenario-world-context"
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          value={worldContext}
          onChange={(event) => {
            onWorldContextChange(event.target.value)
          }}
          placeholder="The experience the user is stepping into…"
        />

        <label style={labelStyle} htmlFor="scenario-objectives">
          Objectives (optional, one per line)
        </label>
        <textarea
          id="scenario-objectives"
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          value={objectivesText}
          onChange={(event) => {
            onObjectivesTextChange(event.target.value)
          }}
          placeholder={'Introduce AI concepts progressively.\nUnlock specialists when relevant.'}
        />

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
  onScenarioUpdated: (scenario: ScenarioSummary) => void
  onScenarioDeleted: (scenarioId: string) => void
}

function ScenarioList({
  scenarios,
  isLoading,
  listError,
  selectedScenarioId,
  onScenarioSelected,
  onScenarioUpdated,
  onScenarioDeleted,
}: ScenarioListProps): JSX.Element {
  return (
    <>
      <h3>Available scenarios</h3>
      {isLoading ? <p>Loading scenarios…</p> : null}
      {listError !== null ? <p style={errorStyle}>{listError}</p> : null}
      {scenarios.length === 0 ? <p style={{ color: '#6b7280' }}>No scenarios yet.</p> : null}
      {scenarios.map((scenario) => (
        <ScenarioRow
          key={scenario.scenarioId}
          scenario={scenario}
          isSelected={scenario.scenarioId === selectedScenarioId}
          onSelected={onScenarioSelected}
          onUpdated={onScenarioUpdated}
          onDeleted={onScenarioDeleted}
        />
      ))}
    </>
  )
}

async function submitScenario(
  values: CreateScenarioParams,
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

// ─── Avatar management ────────────────────────────────────────────────────────

type AvatarSectionProps = {
  values: AvatarFormValues
  isSubmitting: boolean
  submitError: string | null
  avatars: AvatarSummary[]
  isLoading: boolean
  listError: string | null
  onValuesChange: (values: AvatarFormValues) => void
  onSubmit: (event: FormSubmitEvent) => void
  onAvatarUpdated: (avatar: AvatarSummary) => void
  onAvatarDeleted: (avatarId: string) => void
}

function AvatarSection({
  values,
  isSubmitting,
  submitError,
  avatars,
  isLoading,
  listError,
  onValuesChange,
  onSubmit,
  onAvatarUpdated,
  onAvatarDeleted,
}: AvatarSectionProps): JSX.Element {
  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ marginTop: 0 }}>Avatars</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Add avatars to this scenario before starting a session.
      </p>
      <AvatarForm
        values={values}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onValuesChange={onValuesChange}
        onSubmit={onSubmit}
      />
      <AvatarList
        avatars={avatars}
        isLoading={isLoading}
        listError={listError}
        onAvatarUpdated={onAvatarUpdated}
        onAvatarDeleted={onAvatarDeleted}
      />
    </div>
  )
}

type AvatarFormProps = {
  values: AvatarFormValues
  isSubmitting: boolean
  submitError: string | null
  onValuesChange: (values: AvatarFormValues) => void
  onSubmit: (event: FormSubmitEvent) => void
}

function AvatarForm({
  values,
  isSubmitting,
  submitError,
  onValuesChange,
  onSubmit,
}: AvatarFormProps): JSX.Element {
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
          style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
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
              onValuesChange({ ...values, llmProviderOverride: event.target.value })
            }}
          >
            <option value="">inherit</option>
            {PROVIDER_OPTIONS.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <LabeledInput
            id="avatar-llm-model-override"
            label="Model override"
            value={values.llmModelOverride}
            onChange={(llmModelOverride) => {
              onValuesChange({ ...values, llmModelOverride })
            }}
            style={inputStyle}
            labelStyle={labelStyle}
          />
        </details>

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
  onAvatarUpdated: (avatar: AvatarSummary) => void
  onAvatarDeleted: (avatarId: string) => void
}

function AvatarList({ avatars, isLoading, listError, onAvatarUpdated, onAvatarDeleted }: AvatarListProps): JSX.Element {
  return (
    <>
      <h4 style={{ marginTop: '16px', marginBottom: '4px' }}>Scenario avatars</h4>
      {isLoading ? <p>Loading avatars…</p> : null}
      {listError !== null ? <p style={errorStyle}>{listError}</p> : null}
      {!isLoading && avatars.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No avatars yet.</p>
      ) : null}
      {avatars.map((avatar) => (
        <AvatarRow
          key={avatar.avatarId}
          avatar={avatar}
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
  setSubmitError: (value: string | null) => void,
  setIsSubmitting: (value: boolean) => void,
  onSuccess: () => void,
  onAfterSubmit: () => Promise<void>,
): Promise<void> {
  setSubmitError(null)
  setIsSubmitting(true)

  try {
    await createAvatar(scenarioId, {
      name: values.name,
      personaPrompt: values.personaPrompt,
      ...(values.tone.trim().length > 0 ? { tone: values.tone } : {}),
      ...(values.description.trim().length > 0 ? { description: values.description } : {}),
      ...buildAvatarOverride(values.llmProviderOverride, values.llmModelOverride),
    })
    onSuccess()
    await onAfterSubmit()
  } catch (error) {
    setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to create avatar'))
  } finally {
    setIsSubmitting(false)
  }
}

function buildAvatarOverride(providerValue: string, modelValue: string): {
  llmOverride: { provider?: ModelSelectionProviderName; model?: string } | null
} {
  const provider = providerValue.trim()
  const model = modelValue.trim()
  if (provider.length === 0 && model.length === 0) {
    return { llmOverride: null }
  }

  return {
    llmOverride: {
      ...(provider.length > 0 ? { provider: provider as ModelSelectionProviderName } : {}),
      ...(model.length > 0 ? { model } : {}),
    },
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
    setAvatars(await listScenarioAvatars(scenarioId))
  } catch (error) {
    setListError(formatApiError(error, 'UNKNOWN_ERROR: Failed to load avatars'))
  } finally {
    setIsLoading(false)
  }
}

// ─── Avatar availability ──────────────────────────────────────────────────────

type AvailabilityChoice = 'none' | 'initial' | 'unlockable'

type ScenarioAvatarAvailabilityEditorProps = {
  scenario: ScenarioSummary
  avatars: AvatarSummary[]
  onScenarioUpdated: (scenario: ScenarioSummary) => void
}

function ScenarioAvatarAvailabilityEditor({
  scenario,
  avatars,
  onScenarioUpdated,
}: ScenarioAvatarAvailabilityEditorProps): JSX.Element | null {
  const [choices, setChoices] = useState<Record<string, AvailabilityChoice>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const initialAvatarIds = new Set(scenario.avatarAvailability.initialAvatarIds)
    const unlockableAvatarIds = new Set(scenario.avatarAvailability.unlockableAvatarIds ?? [])
    setChoices(
      Object.fromEntries(
        avatars.map((avatar) => [
          avatar.avatarId,
          initialAvatarIds.has(avatar.avatarId)
            ? 'initial'
            : unlockableAvatarIds.has(avatar.avatarId)
              ? 'unlockable'
              : 'none',
        ]),
      ),
    )
  }, [scenario.scenarioId, scenario.avatarAvailability, avatars])

  if (avatars.length === 0) return null

  const handleSave = (): void => {
    const initialAvatarIds = avatars
      .filter((avatar) => choices[avatar.avatarId] === 'initial')
      .map((avatar) => avatar.avatarId)
    const unlockableAvatarIds = avatars
      .filter((avatar) => choices[avatar.avatarId] === 'unlockable')
      .map((avatar) => avatar.avatarId)

    setSaveError(null)
    setIsSaving(true)
    updateScenario(scenario.scenarioId, {
      avatarAvailability: { initialAvatarIds, unlockableAvatarIds },
    })
      .then(onScenarioUpdated)
      .catch((error: unknown) => {
        setSaveError(formatApiError(error, 'UNKNOWN_ERROR: Failed to save avatar availability'))
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ marginBottom: '4px' }}>Avatar availability</h4>
      <p style={{ marginTop: 0, color: '#6b7280', fontSize: '13px' }}>
        Choose which avatars are available from the start versus unlockable during the session.
      </p>
      {avatars.map((avatar) => (
        <div key={avatar.avatarId} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
          <span style={{ flex: 1 }}>{avatar.name}</span>
          {(['none', 'initial', 'unlockable'] as const).map((choice) => (
            <label key={choice} style={{ fontSize: '13px', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="radio"
                name={`availability-${avatar.avatarId}`}
                checked={(choices[avatar.avatarId] ?? 'none') === choice}
                onChange={() => {
                  setChoices((prev) => ({ ...prev, [avatar.avatarId]: choice }))
                }}
              />
              {choice}
            </label>
          ))}
        </div>
      ))}
      <button type="button" style={buttonStyle} disabled={isSaving} onClick={handleSave}>
        {isSaving ? 'Saving…' : 'Save availability'}
      </button>
      {saveError !== null ? <p style={errorStyle}>{saveError}</p> : null}
    </div>
  )
}
