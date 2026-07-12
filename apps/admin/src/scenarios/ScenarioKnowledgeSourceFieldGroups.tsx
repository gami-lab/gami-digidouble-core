import type { JSX } from 'react'
import type { AvatarSummary, KnowledgeType, KnowledgeVisibilityPolicy } from '@gami/shared'

export type VisibilityPolicy = KnowledgeVisibilityPolicy
export type AvatarOption = Pick<AvatarSummary, 'avatarId' | 'name'>

type KnowledgeSourceIdentityFieldsProps = {
  name: string
  knowledgeType: KnowledgeType
  avatars: AvatarOption[]
  visibilityPolicy: VisibilityPolicy
  visibleToAvatarIds: string[]
  saving: boolean
  idPrefix: string
  disableKnowledgeType?: boolean
  onNameChange: (value: string) => void
  onKnowledgeTypeChange: (value: KnowledgeType) => void
  onVisibilityPolicyChange: (value: VisibilityPolicy) => void
  onVisibleToAvatarIdsChange: (value: string[]) => void
}

export function KnowledgeSourceIdentityFields({
  name,
  knowledgeType,
  avatars,
  visibilityPolicy,
  visibleToAvatarIds,
  saving,
  idPrefix,
  disableKnowledgeType = false,
  onNameChange,
  onKnowledgeTypeChange,
  onVisibilityPolicyChange,
  onVisibleToAvatarIdsChange,
}: KnowledgeSourceIdentityFieldsProps): JSX.Element {
  return (
    <>
      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-name`} className="admin-form-label">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          className="admin-form-input"
          value={name}
          onChange={(event) => { onNameChange(event.target.value) }}
          required
          disabled={saving}
        />
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-type`} className="admin-form-label">
          Knowledge type
        </label>
        <select
          id={`${idPrefix}-type`}
          className="admin-form-select"
          value={knowledgeType}
          onChange={(event) => { onKnowledgeTypeChange(event.target.value as KnowledgeType) }}
          disabled={saving || disableKnowledgeType}
        >
          <option value="world">world</option>
          <option value="memory">memory</option>
          <option value="media">media</option>
        </select>
      </div>

      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-visibility`} className="admin-form-label">
          Visibility policy
        </label>
        <select
          id={`${idPrefix}-visibility`}
          className="admin-form-select"
          value={visibilityPolicy}
          onChange={(event) => { onVisibilityPolicyChange(event.target.value as VisibilityPolicy) }}
          disabled={saving}
        >
          <option value="all">all avatars</option>
          <option value="avatars">specific avatars</option>
          <option value="none">GM-only (no avatars)</option>
        </select>
      </div>

      {visibilityPolicy !== 'avatars' ? null : (
        <KnowledgeSourceAvatarSelectionFields
          avatars={avatars}
          selectedAvatarIds={visibleToAvatarIds}
          saving={saving}
          idPrefix={idPrefix}
          onSelectionChange={onVisibleToAvatarIdsChange}
        />
      )}
    </>
  )
}

type KnowledgeSourceAvatarSelectionFieldsProps = {
  avatars: AvatarOption[]
  selectedAvatarIds: string[]
  saving: boolean
  idPrefix: string
  onSelectionChange: (value: string[]) => void
}

function KnowledgeSourceAvatarSelectionFields({
  avatars,
  selectedAvatarIds,
  saving,
  idPrefix,
  onSelectionChange,
}: KnowledgeSourceAvatarSelectionFieldsProps): JSX.Element {
  if (avatars.length === 0) {
    return <p className="admin-muted">Create an avatar before using avatar-scoped knowledge.</p>
  }

  return (
    <fieldset className="admin-form-group">
      <legend className="admin-form-label" id={`${idPrefix}-avatar-scope-legend`}>
        Visible to avatars <span aria-hidden="true">*</span>
      </legend>
      {avatars.map((avatar) => {
        const checked = selectedAvatarIds.includes(avatar.avatarId)
        return (
          <label key={avatar.avatarId}>
            <input
              type="checkbox"
              checked={checked}
              disabled={saving}
              onChange={() => {
                onSelectionChange(toggleAvatarSelection(selectedAvatarIds, avatar.avatarId))
              }}
            />{' '}
            {avatar.name}
          </label>
        )
      })}
    </fieldset>
  )
}

type KnowledgeSourceInputModeFieldsProps = {
  inputMode: 'text' | 'file'
  saving: boolean
  onInputModeChange: (value: 'text' | 'file') => void
}

export function KnowledgeSourceInputModeFields({
  inputMode,
  saving,
  onInputModeChange,
}: KnowledgeSourceInputModeFieldsProps): JSX.Element {
  return (
    <div className="admin-form-group">
      <label className="admin-form-label">Input mode</label>
      <label>
        <input
          type="radio"
          name="ks-input-mode"
          value="text"
          checked={inputMode === 'text'}
          onChange={() => { onInputModeChange('text') }}
          disabled={saving}
        />{' '}
        Paste text
      </label>
      {' '}
      <label>
        <input
          type="radio"
          name="ks-input-mode"
          value="file"
          checked={inputMode === 'file'}
          onChange={() => { onInputModeChange('file') }}
          disabled={saving}
        />{' '}
        Upload file (PDF/TXT)
      </label>
    </div>
  )
}

type KnowledgeSourceContentFieldsProps = {
  inputMode: 'text' | 'file'
  inlineText: string
  file: File | null
  saving: boolean
  onInlineTextChange: (value: string) => void
  onFileChange: (value: File | null) => void
}

export function KnowledgeSourceContentFields({
  inputMode,
  inlineText,
  file,
  saving,
  onInlineTextChange,
  onFileChange,
}: KnowledgeSourceContentFieldsProps): JSX.Element {
  if (inputMode === 'text') {
    return (
      <div className="admin-form-group">
        <label htmlFor="ks-create-text" className="admin-form-label">
          Content <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="ks-create-text"
          className="admin-form-textarea"
          rows={8}
          value={inlineText}
          onChange={(event) => { onInlineTextChange(event.target.value) }}
          required
          disabled={saving}
        />
      </div>
    )
  }

  return (
    <div className="admin-form-group">
      <label htmlFor="ks-create-file" className="admin-form-label">
        File (PDF or TXT) <span aria-hidden="true">*</span>
      </label>
      <input
        id="ks-create-file"
        type="file"
        accept=".pdf,.txt,.text"
        onChange={(event) => { onFileChange(event.target.files?.[0] ?? null) }}
        disabled={saving}
      />
      {file === null ? null : <p className="admin-muted">{file.name}</p>}
    </div>
  )
}

type KnowledgeSourceFormActionsProps = {
  submitLabel: string
  submitDisabled: boolean
  saving: boolean
  onCancel: () => void
}

export function KnowledgeSourceFormActions({
  submitLabel,
  submitDisabled,
  saving,
  onCancel,
}: KnowledgeSourceFormActionsProps): JSX.Element {
  return (
    <div className="admin-form-actions">
      <button type="submit" className="admin-button admin-button-primary" disabled={submitDisabled}>
        {submitLabel}
      </button>
      <button type="button" className="admin-button admin-button-secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </div>
  )
}

export function normalizeVisibilityPolicy(
  value: string | undefined,
  visibleToAvatarIds: string[] | undefined,
): VisibilityPolicy {
  if (value === 'avatars' || value === 'none') return value
  if (normalizeVisibleToAvatarIds(visibleToAvatarIds).length > 0) return 'avatars'
  return 'all'
}

export function normalizeVisibleToAvatarIds(visibleToAvatarIds: string[] | undefined): string[] {
  return (visibleToAvatarIds ?? [])
    .map((avatarId) => avatarId.trim())
    .filter((avatarId) => avatarId.length > 0)
}

export function buildKnowledgeVisibilityInput(
  visibilityPolicy: VisibilityPolicy,
  visibleToAvatarIds: string[],
): string[] | undefined {
  if (visibilityPolicy !== 'avatars') return undefined
  return normalizeVisibleToAvatarIds(visibleToAvatarIds)
}

export function buildInlineKnowledgeUri(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `inline://${slug.length > 0 ? slug : 'knowledge-source'}.txt`
}

function toggleAvatarSelection(selectedAvatarIds: string[], avatarId: string): string[] {
  if (selectedAvatarIds.includes(avatarId)) {
    return selectedAvatarIds.filter((currentAvatarId) => currentAvatarId !== avatarId)
  }

  return [...selectedAvatarIds, avatarId]
}
