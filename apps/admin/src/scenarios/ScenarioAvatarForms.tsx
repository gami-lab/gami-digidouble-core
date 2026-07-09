import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import type { AvatarSummary } from '@gami/shared'
import { formatApiError } from '../api/error'
import { createAvatar, updateAvatar } from '../api/scenarios'
import { ModelSelectionFields } from './ModelSelectionFields'
import {
  EMPTY_MODEL_SELECTION,
  fromAvatarLlmOverride,
  hasPartialModelSelection,
  toAvatarLlmOverride,
  type ModelSelectionFormValue,
} from './model-selection-form'

type AvatarCreateFormProps = {
  scenarioId: string
  onCancel: () => void
  onCreated: (avatar: AvatarSummary) => void
  onError: (message: string) => void
}

export function AvatarCreateForm({
  scenarioId,
  onCancel,
  onCreated,
  onError,
}: AvatarCreateFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [personaPrompt, setPersonaPrompt] = useState('')
  const [avatarStatus, setAvatarStatus] = useState<'draft' | 'active' | 'archived'>('active')
  const [modelOverride, setModelOverride] = useState<ModelSelectionFormValue>(EMPTY_MODEL_SELECTION)
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
        llmOverride: toAvatarLlmOverride(modelOverride),
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
      onSubmit={(event) => { void handleSubmit(event) }}
      onCancel={onCancel}
      onNameChange={setName}
      onPersonaPromptChange={setPersonaPrompt}
      onStatusChange={setAvatarStatus}
      onModelOverrideChange={setModelOverride}
    />
  )
}

type AvatarEditFormProps = {
  avatar: AvatarSummary
  onCancel: () => void
  onSaved: (avatar: AvatarSummary) => void
  onError: (message: string) => void
}

export function AvatarEditForm({ avatar, onCancel, onSaved, onError }: AvatarEditFormProps): JSX.Element {
  const [name, setName] = useState(avatar.name)
  const [personaPrompt, setPersonaPrompt] = useState(avatar.personaPrompt)
  const [avatarStatus, setAvatarStatus] = useState<'draft' | 'active' | 'archived'>(avatar.status)
  const [modelOverride, setModelOverride] = useState(fromAvatarLlmOverride(avatar.llmOverride))
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
        llmOverride: toAvatarLlmOverride(modelOverride),
      })
      onSaved(updated)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update avatar'))
      setSaving(false)
    }
  }

  return (
    <AvatarForm
      title="Edit avatar"
      submitLabel={saving ? 'Saving…' : 'Save'}
      name={name}
      personaPrompt={personaPrompt}
      avatarStatus={avatarStatus}
      modelOverride={modelOverride}
      saving={saving}
      idPrefix="edit"
      onSubmit={(event) => { void handleSubmit(event) }}
      onCancel={onCancel}
      onNameChange={setName}
      onPersonaPromptChange={setPersonaPrompt}
      onStatusChange={setAvatarStatus}
      onModelOverrideChange={setModelOverride}
    />
  )
}

type AvatarFormProps = {
  title: string
  submitLabel: string
  name: string
  personaPrompt: string
  avatarStatus: 'draft' | 'active' | 'archived'
  modelOverride: ModelSelectionFormValue
  saving: boolean
  idPrefix: string
  onSubmit: (event: SyntheticEvent) => void
  onCancel: () => void
  onNameChange: (value: string) => void
  onPersonaPromptChange: (value: string) => void
  onStatusChange: (value: 'draft' | 'active' | 'archived') => void
  onModelOverrideChange: (value: ModelSelectionFormValue) => void
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
}: AvatarFormProps): JSX.Element {
  const hasPartialModelOverride = hasPartialModelSelection(modelOverride)
  const submitDisabled =
    saving || name.trim().length === 0 || personaPrompt.trim().length === 0 || hasPartialModelOverride

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
        />
        {hasPartialModelOverride ? (
          <p className="admin-error">Select both provider and model for the avatar override, or leave both empty.</p>
        ) : null}
        <div className="admin-form-actions">
          <button type="submit" className="admin-button admin-button-primary" disabled={submitDisabled}>
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
  avatarStatus: 'draft' | 'active' | 'archived'
  modelOverride: ModelSelectionFormValue
  saving: boolean
  idPrefix: string
  onNameChange: (value: string) => void
  onPersonaPromptChange: (value: string) => void
  onStatusChange: (value: 'draft' | 'active' | 'archived') => void
  onModelOverrideChange: (value: ModelSelectionFormValue) => void
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
          onChange={(event) => { onNameChange(event.target.value) }}
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
          onChange={(event) => { onPersonaPromptChange(event.target.value) }}
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
          onChange={(event) => { onStatusChange(event.target.value as 'draft' | 'active' | 'archived') }}
          disabled={saving}
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="archived">archived</option>
        </select>
      </div>

      <ModelSelectionFields
        idPrefix={`${idPrefix}-avatar-model`}
        label="Avatar model override"
        value={modelOverride}
        disabled={saving}
        helperText="Leave empty to inherit the scenario default or global avatar runtime config."
        onChange={onModelOverrideChange}
      />
    </>
  )
}
