import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import type { KnowledgeType, KnowledgeVisibilityPolicy } from '@gami/shared'
import { formatApiError } from '../api/error'
import type { KnowledgeSourceDto } from '../api/knowledge'
import { createKnowledgeSource, updateKnowledgeSource, uploadKnowledgeSource } from '../api/knowledge'

type VisibilityPolicy = KnowledgeVisibilityPolicy

type KnowledgeSourceCreateFormProps = {
  scenarioId: string
  onCancel: () => void
  onCreated: (source: KnowledgeSourceDto) => void
  onError: (message: string) => void
}

export function KnowledgeSourceCreateForm({
  scenarioId,
  onCancel,
  onCreated,
  onError,
}: KnowledgeSourceCreateFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeType>('world')
  const [visibilityPolicy, setVisibilityPolicy] = useState<VisibilityPolicy>('all')
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  const [inlineText, setInlineText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault()
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      const source = inputMode === 'file'
        ? await createUploadedKnowledgeSource({ scenarioId, name, knowledgeType, visibilityPolicy, file, setSaving })
        : await createInlineKnowledgeSource({ scenarioId, name, knowledgeType, visibilityPolicy, inlineText, setSaving })
      if (source === null) return
      onCreated(source)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to create knowledge source'))
      setSaving(false)
    }
  }

  const submitDisabled =
    saving ||
    name.trim().length === 0 ||
    (inputMode === 'text' && inlineText.trim().length === 0) ||
    (inputMode === 'file' && file === null)

  return (
    <KnowledgeSourceCreateLayout
      name={name}
      knowledgeType={knowledgeType}
      visibilityPolicy={visibilityPolicy}
      inputMode={inputMode}
      inlineText={inlineText}
      file={file}
      saving={saving}
      submitDisabled={submitDisabled}
      onSubmit={(event) => { void handleSubmit(event) }}
      onCancel={onCancel}
      onNameChange={setName}
      onKnowledgeTypeChange={setKnowledgeType}
      onVisibilityPolicyChange={setVisibilityPolicy}
      onInputModeChange={setInputMode}
      onInlineTextChange={setInlineText}
      onFileChange={setFile}
    />
  )
}

type KnowledgeSourceEditFormProps = {
  source: KnowledgeSourceDto
  onCancel: () => void
  onSaved: (source: KnowledgeSourceDto) => void
  onError: (message: string) => void
}

export function KnowledgeSourceEditForm({
  source,
  onCancel,
  onSaved,
  onError,
}: KnowledgeSourceEditFormProps): JSX.Element {
  const [name, setName] = useState(source.name)
  const [visibilityPolicy, setVisibilityPolicy] = useState<VisibilityPolicy>(
    normalizeVisibilityPolicy(source.visibilityPolicy),
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault()
    if (name.trim().length === 0) return
    setSaving(true)
    try {
      const updated = await updateKnowledgeSource(source.sourceId, {
        name: name.trim(),
        visibilityPolicy,
      })
      onSaved(updated)
    } catch (error: unknown) {
      onError(formatApiError(error, 'UNKNOWN_ERROR: Failed to update knowledge source'))
      setSaving(false)
    }
  }

  return (
    <>
      <h2>Edit knowledge source</h2>
      <form onSubmit={(event) => { void handleSubmit(event) }}>
        <KnowledgeSourceIdentityFields
          name={name}
          knowledgeType={source.knowledgeType}
          visibilityPolicy={visibilityPolicy}
          saving={saving}
          idPrefix="ks-edit"
          disableKnowledgeType
          onNameChange={setName}
          onKnowledgeTypeChange={() => {}}
          onVisibilityPolicyChange={setVisibilityPolicy}
        />
        <KnowledgeSourceFormActions
          submitLabel={saving ? 'Saving…' : 'Save'}
          submitDisabled={saving || name.trim().length === 0}
          saving={saving}
          onCancel={onCancel}
        />
      </form>
    </>
  )
}

type KnowledgeSourceCreateLayoutProps = {
  name: string
  knowledgeType: KnowledgeType
  visibilityPolicy: VisibilityPolicy
  inputMode: 'text' | 'file'
  inlineText: string
  file: File | null
  saving: boolean
  submitDisabled: boolean
  onSubmit: (event: SyntheticEvent) => void
  onCancel: () => void
  onNameChange: (value: string) => void
  onKnowledgeTypeChange: (value: KnowledgeType) => void
  onVisibilityPolicyChange: (value: VisibilityPolicy) => void
  onInputModeChange: (value: 'text' | 'file') => void
  onInlineTextChange: (value: string) => void
  onFileChange: (value: File | null) => void
}

function KnowledgeSourceCreateLayout({
  name,
  knowledgeType,
  visibilityPolicy,
  inputMode,
  inlineText,
  file,
  saving,
  submitDisabled,
  onSubmit,
  onCancel,
  onNameChange,
  onKnowledgeTypeChange,
  onVisibilityPolicyChange,
  onInputModeChange,
  onInlineTextChange,
  onFileChange,
}: KnowledgeSourceCreateLayoutProps): JSX.Element {
  return (
    <>
      <h2>Add knowledge source</h2>
      <form onSubmit={onSubmit}>
        <KnowledgeSourceIdentityFields
          name={name}
          knowledgeType={knowledgeType}
          visibilityPolicy={visibilityPolicy}
          saving={saving}
          idPrefix="ks-create"
          onNameChange={onNameChange}
          onKnowledgeTypeChange={onKnowledgeTypeChange}
          onVisibilityPolicyChange={onVisibilityPolicyChange}
        />
        <KnowledgeSourceInputModeFields inputMode={inputMode} saving={saving} onInputModeChange={onInputModeChange} />
        <KnowledgeSourceContentFields
          inputMode={inputMode}
          inlineText={inlineText}
          file={file}
          saving={saving}
          onInlineTextChange={onInlineTextChange}
          onFileChange={onFileChange}
        />
        <KnowledgeSourceFormActions
          submitLabel={saving ? 'Creating…' : 'Create knowledge source'}
          submitDisabled={submitDisabled}
          saving={saving}
          onCancel={onCancel}
        />
      </form>
    </>
  )
}

type KnowledgeSourceIdentityFieldsProps = {
  name: string
  knowledgeType: KnowledgeType
  visibilityPolicy: VisibilityPolicy
  saving: boolean
  idPrefix: string
  disableKnowledgeType?: boolean
  onNameChange: (value: string) => void
  onKnowledgeTypeChange: (value: KnowledgeType) => void
  onVisibilityPolicyChange: (value: VisibilityPolicy) => void
}

function KnowledgeSourceIdentityFields({
  name,
  knowledgeType,
  visibilityPolicy,
  saving,
  idPrefix,
  disableKnowledgeType = false,
  onNameChange,
  onKnowledgeTypeChange,
  onVisibilityPolicyChange,
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
    </>
  )
}

type KnowledgeSourceInputModeFieldsProps = {
  inputMode: 'text' | 'file'
  saving: boolean
  onInputModeChange: (value: 'text' | 'file') => void
}

function KnowledgeSourceInputModeFields({
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

function KnowledgeSourceContentFields({
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

function KnowledgeSourceFormActions({
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

type CreateUploadedKnowledgeSourceArgs = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  visibilityPolicy: VisibilityPolicy
  file: File | null
  setSaving: (value: boolean) => void
}

async function createUploadedKnowledgeSource({
  scenarioId,
  name,
  knowledgeType,
  visibilityPolicy,
  file,
  setSaving,
}: CreateUploadedKnowledgeSourceArgs): Promise<KnowledgeSourceDto | null> {
  if (file === null) {
    setSaving(false)
    return null
  }

  const content = await readFileAsBase64(file)
  return uploadKnowledgeSource({
    scenarioId,
    name: name.trim(),
    knowledgeType,
    visibilityPolicy,
    content,
    filename: file.name,
  })
}

type CreateInlineKnowledgeSourceArgs = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  visibilityPolicy: VisibilityPolicy
  inlineText: string
  setSaving: (value: boolean) => void
}

async function createInlineKnowledgeSource({
  scenarioId,
  name,
  knowledgeType,
  visibilityPolicy,
  inlineText,
  setSaving,
}: CreateInlineKnowledgeSourceArgs): Promise<KnowledgeSourceDto | null> {
  if (inlineText.trim().length === 0) {
    setSaving(false)
    return null
  }

  return createKnowledgeSource({
    scenarioId,
    name: name.trim(),
    knowledgeType,
    visibilityPolicy,
    format: 'text',
    uriOrPath: '',
    metadata: { inlineText: inlineText.trim() },
  })
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => { reject(new Error('Failed to read file')) }
    reader.readAsDataURL(file)
  })
}

function normalizeVisibilityPolicy(value: string | undefined): VisibilityPolicy {
  if (value === 'avatars' || value === 'none') return value
  return 'all'
}
