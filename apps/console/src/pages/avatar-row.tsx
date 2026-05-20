/* eslint-disable max-lines-per-function, complexity */
import { useState } from 'react'
import type { ComponentProps, CSSProperties, JSX } from 'react'
import { ApiError } from '../api/client'
import { PROVIDER_OPTIONS } from '../api/provider-options'
import { updateAvatar, deleteAvatar } from '../api/scenarios'
import type { AvatarSummary } from '../api/scenarios'
import { formatApiError } from '../api/error'
import { LabeledInput } from '../components/LabeledInput'
import { buttonStyle, errorStyle, inputStyle, labelStyle } from './form-styles'

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

const rowStyle = (selected: boolean): CSSProperties => ({
  marginTop: '8px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  padding: '10px',
  backgroundColor: selected ? '#eff6ff' : '#ffffff',
})

const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  marginTop: '8px',
  backgroundColor: '#b91c1c',
  borderColor: '#b91c1c',
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  marginTop: '8px',
  backgroundColor: '#6b7280',
  borderColor: '#6b7280',
}

type AvatarRowProps = {
  avatar: AvatarSummary
  isSelected?: boolean
  onSelected?: (avatar: AvatarSummary) => void
  onUpdated: (avatar: AvatarSummary) => void
  onDeleted: (avatarId: string) => void
}

export function AvatarRow({
  avatar,
  isSelected,
  onSelected,
  onUpdated,
  onDeleted,
}: AvatarRowProps): JSX.Element {
  const [editMode, setEditMode] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDelete = (): void => {
    void performDeleteAvatar(avatar.avatarId, onDeleted, setDeleteError)
  }

  if (editMode) {
    return (
      <AvatarEditForm
        avatar={avatar}
        onSaved={(updated) => {
          onUpdated(updated)
          setEditMode(false)
        }}
        onCancel={() => {
          setEditMode(false)
        }}
      />
    )
  }

  return (
    <div style={rowStyle(isSelected ?? false)}>
      <div>
        <strong>{avatar.name}</strong> · {avatar.status}
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280' }}>Avatar ID: {avatar.avatarId}</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {onSelected !== undefined ? (
          <button
            type="button"
            style={{ ...buttonStyle, marginTop: '8px' }}
            onClick={() => {
              onSelected(avatar)
            }}
          >
            {(isSelected ?? false) ? 'Selected avatar' : 'Select avatar'}
          </button>
        ) : null}
        <button
          type="button"
          style={{ ...buttonStyle, marginTop: '8px' }}
          onClick={() => {
            setEditMode(true)
          }}
        >
          Edit
        </button>
        <button type="button" style={dangerButtonStyle} onClick={handleDelete}>
          Delete
        </button>
      </div>
      {deleteError !== null ? <p style={errorStyle}>{deleteError}</p> : null}
    </div>
  )
}

type AvatarEditValues = {
  name: string
  personaPrompt: string
  tone: string
  description: string
  llmProviderOverride: string
  llmModelOverride: string
}

type AvatarEditFormProps = {
  avatar: AvatarSummary
  onSaved: (updated: AvatarSummary) => void
  onCancel: () => void
}

export function AvatarEditForm({ avatar, onSaved, onCancel }: AvatarEditFormProps): JSX.Element {
  const [values, setValues] = useState<AvatarEditValues>({
    name: avatar.name,
    personaPrompt: avatar.personaPrompt,
    tone: avatar.tone ?? '',
    description: avatar.description ?? '',
    llmProviderOverride: avatar.llmOverride?.provider ?? '',
    llmModelOverride: avatar.llmOverride?.model ?? '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isOverrideExpanded, setIsOverrideExpanded] = useState(false)

  const handleSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void performUpdateAvatar(avatar.avatarId, values, onSaved, setSubmitError, setIsSubmitting)
  }

  return (
    <div style={rowStyle(false)}>
      <form onSubmit={handleSubmit}>
        <fieldset style={{ margin: 0, padding: 0, border: 'none' }} disabled={isSubmitting}>
          <LabeledInput
            id={`edit-avatar-name-${avatar.avatarId}`}
            label="Name"
            value={values.name}
            onChange={(name) => {
              setValues((v) => ({ ...v, name }))
            }}
            required
            style={inputStyle}
            labelStyle={labelStyle}
          />
          <label style={labelStyle} htmlFor={`edit-avatar-persona-${avatar.avatarId}`}>
            Persona Prompt
          </label>
          <textarea
            id={`edit-avatar-persona-${avatar.avatarId}`}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            value={values.personaPrompt}
            onChange={(e) => {
              setValues((v) => ({ ...v, personaPrompt: e.target.value }))
            }}
            required
          />
          <LabeledInput
            id={`edit-avatar-tone-${avatar.avatarId}`}
            label="Tone (optional)"
            value={values.tone}
            onChange={(tone) => {
              setValues((v) => ({ ...v, tone }))
            }}
            style={inputStyle}
            labelStyle={labelStyle}
          />
          <LabeledInput
            id={`edit-avatar-desc-${avatar.avatarId}`}
            label="Description (optional)"
            value={values.description}
            onChange={(description) => {
              setValues((v) => ({ ...v, description }))
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
            <label style={labelStyle} htmlFor={`edit-avatar-provider-${avatar.avatarId}`}>
              Provider override
            </label>
            <select
              id={`edit-avatar-provider-${avatar.avatarId}`}
              style={inputStyle}
              value={values.llmProviderOverride}
              onChange={(event) => {
                setValues((v) => ({ ...v, llmProviderOverride: event.target.value }))
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
              id={`edit-avatar-model-${avatar.avatarId}`}
              label="Model override"
              value={values.llmModelOverride}
              onChange={(llmModelOverride) => {
                setValues((v) => ({ ...v, llmModelOverride }))
              }}
              style={inputStyle}
              labelStyle={labelStyle}
            />
          </details>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              style={buttonStyle}
              disabled={
                isSubmitting || values.name.trim() === '' || values.personaPrompt.trim() === ''
              }
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
              Cancel
            </button>
          </div>
          {submitError !== null ? <p style={errorStyle}>{submitError}</p> : null}
        </fieldset>
      </form>
    </div>
  )
}

export async function performUpdateAvatar(
  avatarId: string,
  values: AvatarEditValues,
  onSaved: (updated: AvatarSummary) => void,
  setSubmitError: (e: string | null) => void,
  setIsSubmitting: (v: boolean) => void,
): Promise<void> {
  setSubmitError(null)
  setIsSubmitting(true)
  try {
    const updated = await updateAvatar(avatarId, {
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
    onSaved(updated)
  } catch (error) {
    setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update avatar'))
  } finally {
    setIsSubmitting(false)
  }
}

export async function performDeleteAvatar(
  avatarId: string,
  onDeleted: (avatarId: string) => void,
  setDeleteError: (e: string | null) => void,
): Promise<void> {
  if (!window.confirm('Delete avatar?')) return
  setDeleteError(null)
  try {
    await deleteAvatar(avatarId)
    onDeleted(avatarId)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CONFLICT') {
      setDeleteError('Cannot delete: avatar has active sessions.')
    } else {
      setDeleteError(formatApiError(error, 'UNKNOWN_ERROR: Failed to delete avatar'))
    }
  }
}
