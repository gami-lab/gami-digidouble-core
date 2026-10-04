import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import {
  AVATAR_COMPUTED_TRAIT_KEYS,
  AVATAR_COMPUTED_TRAIT_LABELS,
  MODEL_SELECTION_PROVIDER_NAMES,
  mapAvatarOverride,
} from '@gami/shared'
import type {
  AvatarComputedTraits,
  AvatarStatus,
  AvatarSummary,
  VoiceConfiguration,
} from '@gami/shared'
import { formatApiError } from '../api/error'
import { createAvatar, updateAvatar } from '../api/scenarios'
import { ModelSelectionTable } from '../model-selection/ModelSelectionTable'
import {
  EMPTY_MODEL_SELECTION,
  fromAvatarLlmOverride,
  hasPartialModelSelection,
  type ModelSelectionFormValue,
} from './model-selection-form'
import { VoiceSelect } from '../voice/VoiceSelect'

type AvatarCreateFormProps = {
  scenarioId: string
  scenarioLanguage: string | undefined
  onCancel: () => void
  onCreated: (avatar: AvatarSummary) => void
  onError: (message: string) => void
}

export function AvatarCreateForm({
  scenarioId,
  scenarioLanguage,
  onCancel,
  onCreated,
  onError,
}: AvatarCreateFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [personaPrompt, setPersonaPrompt] = useState('')
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('draft')
  const [modelOverride, setModelOverride] = useState<ModelSelectionFormValue>(EMPTY_MODEL_SELECTION)
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfiguration | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault()
    if (name.trim().length === 0 || personaPrompt.trim().length === 0) return
    setSaving(true)
    try {
      const avatar = await createAvatar(scenarioId, {
        name: name.trim(),
        personaPrompt: personaPrompt.trim(),
        status: avatarStatus,
        llmOverride: mapAvatarOverride(modelOverride),
        ...(voiceConfig !== null ? { voiceConfig } : {}),
      })
      onCreated(avatar)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to create avatar'))
      setSaving(false)
    }
  }

  return (
    <AvatarForm
      title="Add avatar"
      submitLabel={saving ? 'Creating…' : 'Create avatar'}
      name={name}
      personaPrompt={personaPrompt}
      avatarStatus={avatarStatus}
      modelOverride={modelOverride}
      saving={saving}
      idPrefix="create"
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
      onCancel={onCancel}
      onNameChange={setName}
      onPersonaPromptChange={setPersonaPrompt}
      onStatusChange={setAvatarStatus}
      onModelOverrideChange={setModelOverride}
      language={scenarioLanguage}
      voiceConfig={voiceConfig}
      onVoiceConfigChange={setVoiceConfig}
    />
  )
}

type AvatarEditFormProps = {
  avatar: AvatarSummary
  scenarioLanguage: string | undefined
  onCancel: () => void
  onSaved: (avatar: AvatarSummary) => void
  onError: (message: string) => void
}

export function AvatarEditForm({
  avatar,
  scenarioLanguage,
  onCancel,
  onSaved,
  onError,
}: AvatarEditFormProps): JSX.Element {
  const [name, setName] = useState(avatar.name)
  const [personaPrompt, setPersonaPrompt] = useState(avatar.personaPrompt)
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>(avatar.status)
  const [modelOverride, setModelOverride] = useState(fromAvatarLlmOverride(avatar.llmOverride))
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfiguration | null>(
    avatar.voiceConfig ?? null,
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault()
    if (name.trim().length === 0 || personaPrompt.trim().length === 0) return
    setSaving(true)
    try {
      const updated = await updateAvatar(avatar.avatarId, {
        name: name.trim(),
        personaPrompt: personaPrompt.trim(),
        status: avatarStatus,
        llmOverride: mapAvatarOverride(modelOverride),
        voiceConfig,
      })
      onSaved(updated)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update avatar'))
      setSaving(false)
    }
  }

  return (
    <>
      <AvatarForm
        title="Edit avatar"
        submitLabel={saving ? 'Saving…' : 'Save'}
        name={name}
        personaPrompt={personaPrompt}
        avatarStatus={avatarStatus}
        modelOverride={modelOverride}
        saving={saving}
        idPrefix="edit"
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
        onCancel={onCancel}
        onNameChange={setName}
        onPersonaPromptChange={setPersonaPrompt}
        onStatusChange={setAvatarStatus}
        onModelOverrideChange={setModelOverride}
        language={scenarioLanguage}
        voiceConfig={voiceConfig}
        onVoiceConfigChange={setVoiceConfig}
      />
      {avatar.computedTraits !== undefined ? (
        <AvatarComputedTraitsView computedTraits={avatar.computedTraits} />
      ) : null}
    </>
  )
}

type AvatarComputedTraitsViewProps = {
  computedTraits: AvatarComputedTraits
}

function AvatarComputedTraitsView({ computedTraits }: AvatarComputedTraitsViewProps): JSX.Element {
  return (
    <div className="admin-form-group">
      <h3>Computed traits</h3>
      <p className="admin-muted">Read-only. Generated by trait preparation, not editable here.</p>
      {AVATAR_COMPUTED_TRAIT_KEYS.map((key) => {
        const values = computedTraits[key]
        return (
          <div key={key}>
            <strong>{AVATAR_COMPUTED_TRAIT_LABELS[key]}</strong>
            {values.length === 0 ? (
              <p className="admin-muted">None.</p>
            ) : (
              <ul>
                {values.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

type AvatarFormProps = {
  title: string
  submitLabel: string
  name: string
  personaPrompt: string
  avatarStatus: AvatarStatus
  modelOverride: ModelSelectionFormValue
  saving: boolean
  idPrefix: string
  onSubmit: (event: SyntheticEvent) => void
  onCancel: () => void
  onNameChange: (value: string) => void
  onPersonaPromptChange: (value: string) => void
  onStatusChange: (value: AvatarStatus) => void
  onModelOverrideChange: (value: ModelSelectionFormValue) => void
  language: string | undefined
  voiceConfig: VoiceConfiguration | null
  onVoiceConfigChange: (value: VoiceConfiguration | null) => void
}

function AvatarForm({
  title,
  submitLabel,
  name,
  personaPrompt,
  avatarStatus,
  modelOverride,
  saving,
  idPrefix,
  onSubmit,
  onCancel,
  onNameChange,
  onPersonaPromptChange,
  onStatusChange,
  onModelOverrideChange,
  language,
  voiceConfig,
  onVoiceConfigChange,
}: AvatarFormProps): JSX.Element {
  const hasPartialModelOverride = hasPartialModelSelection(modelOverride)
  const submitDisabled =
    saving ||
    name.trim().length === 0 ||
    personaPrompt.trim().length === 0 ||
    hasPartialModelOverride

  return (
    <>
      <h2>{title}</h2>
      <form onSubmit={onSubmit}>
        <AvatarFormFields
          name={name}
          personaPrompt={personaPrompt}
          avatarStatus={avatarStatus}
          modelOverride={modelOverride}
          saving={saving}
          idPrefix={idPrefix}
          onNameChange={onNameChange}
          onPersonaPromptChange={onPersonaPromptChange}
          onStatusChange={onStatusChange}
          onModelOverrideChange={onModelOverrideChange}
          language={language}
          voiceConfig={voiceConfig}
          onVoiceConfigChange={onVoiceConfigChange}
        />
        {hasPartialModelOverride ? (
          <p className="admin-error">
            Select both provider and model for the avatar override, or leave both empty.
          </p>
        ) : null}
        <div className="admin-form-actions">
          <button
            type="submit"
            className="admin-button admin-button-primary"
            disabled={submitDisabled}
          >
            {submitLabel}
          </button>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}

type AvatarFormFieldsProps = {
  name: string
  personaPrompt: string
  avatarStatus: AvatarStatus
  modelOverride: ModelSelectionFormValue
  saving: boolean
  idPrefix: string
  onNameChange: (value: string) => void
  onPersonaPromptChange: (value: string) => void
  onStatusChange: (value: AvatarStatus) => void
  onModelOverrideChange: (value: ModelSelectionFormValue) => void
  language: string | undefined
  voiceConfig: VoiceConfiguration | null
  onVoiceConfigChange: (value: VoiceConfiguration | null) => void
}

function AvatarFormFields({
  name,
  personaPrompt,
  avatarStatus,
  modelOverride,
  saving,
  idPrefix,
  onNameChange,
  onPersonaPromptChange,
  onStatusChange,
  onModelOverrideChange,
  language,
  voiceConfig,
  onVoiceConfigChange,
}: AvatarFormFieldsProps): JSX.Element {
  return (
    <>
      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-av-name`} className="admin-form-label">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${idPrefix}-av-name`}
          type="text"
          className="admin-form-input"
          value={name}
          onChange={(event) => {
            onNameChange(event.target.value)
          }}
          required
          disabled={saving}
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-av-persona`} className="admin-form-label">
          Persona prompt <span aria-hidden="true">*</span>
        </label>
        <textarea
          id={`${idPrefix}-av-persona`}
          className="admin-form-textarea"
          rows={6}
          value={personaPrompt}
          onChange={(event) => {
            onPersonaPromptChange(event.target.value)
          }}
          required
          disabled={saving}
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-av-status`} className="admin-form-label">
          Status
        </label>
        <select
          id={`${idPrefix}-av-status`}
          className="admin-form-select"
          value={avatarStatus}
          onChange={(event) => {
            onStatusChange(event.target.value as AvatarStatus)
          }}
          disabled={saving}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
      </div>

      <div className="admin-form-group">
        <p className="admin-form-label">Runtime model</p>
        <ModelSelectionTable
          providers={MODEL_SELECTION_PROVIDER_NAMES}
          disabled={saving}
          rows={[
            {
              id: `${idPrefix}-avatar-model`,
              label: 'Avatar model override',
              description: 'Leave on inherit to use the scenario default or global avatar runtime config.',
              value: modelOverride,
            },
          ]}
          onChange={(_rowId, value) => {
            onModelOverrideChange(value)
          }}
        />
      </div>
      <VoiceSelect
        id={`${idPrefix}-av-voice`}
        label="Avatar voice"
        language={language}
        defaultHint="scenario voice"
        value={voiceConfig}
        disabled={saving}
        onChange={onVoiceConfigChange}
      />
    </>
  )
}
