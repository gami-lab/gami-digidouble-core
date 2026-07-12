import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import type { KnowledgeType } from '@gami/shared'
import { formatApiError } from '../api/error'
import type { KnowledgeSourceDto } from '../api/knowledge'
import { createKnowledgeSource, updateKnowledgeSource, uploadKnowledgeSource } from '../api/knowledge'
import {
  buildInlineKnowledgeUri,
  buildKnowledgeVisibilityInput,
  KnowledgeSourceContentFields,
  KnowledgeSourceFormActions,
  KnowledgeSourceIdentityFields,
  KnowledgeSourceInputModeFields,
  normalizeVisibilityPolicy,
  normalizeVisibleToAvatarIds,
} from './ScenarioKnowledgeSourceFieldGroups'
import type { AvatarOption, VisibilityPolicy } from './ScenarioKnowledgeSourceFieldGroups'

type KnowledgeSourceCreateFormProps = {
  scenarioId: string
  avatars: AvatarOption[]
  onCancel: () => void
  onCreated: (source: KnowledgeSourceDto) => void
  onError: (message: string) => void
}

export function KnowledgeSourceCreateForm({
  scenarioId,
  avatars,
  onCancel,
  onCreated,
  onError,
}: KnowledgeSourceCreateFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeType>('world')
  const [visibilityPolicy, setVisibilityPolicy] = useState<VisibilityPolicy>('all')
  const [visibleToAvatarIds, setVisibleToAvatarIds] = useState<string[]>([])
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  const [inlineText, setInlineText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault()
    if (name.trim().length === 0) return
    setSaving(true)
    const selectedAvatarIds = buildKnowledgeVisibilityInput(visibilityPolicy, visibleToAvatarIds)
    try {
      const source = inputMode === 'file'
        ? await createUploadedKnowledgeSource({
            scenarioId,
            name,
            knowledgeType,
            visibilityPolicy,
            file,
            setSaving,
            ...(selectedAvatarIds !== undefined ? { visibleToAvatarIds: selectedAvatarIds } : {}),
          })
        : await createInlineKnowledgeSource({
            scenarioId,
            name,
            knowledgeType,
            visibilityPolicy,
            inlineText,
            setSaving,
            ...(selectedAvatarIds !== undefined ? { visibleToAvatarIds: selectedAvatarIds } : {}),
          })
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
    (visibilityPolicy === 'avatars' && visibleToAvatarIds.length === 0) ||
    (inputMode === 'text' && inlineText.trim().length === 0) ||
    (inputMode === 'file' && file === null)

  return (
    <KnowledgeSourceCreateLayout
      name={name}
      knowledgeType={knowledgeType}
      avatars={avatars}
      visibilityPolicy={visibilityPolicy}
      visibleToAvatarIds={visibleToAvatarIds}
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
      onVisibleToAvatarIdsChange={setVisibleToAvatarIds}
      onInputModeChange={setInputMode}
      onInlineTextChange={setInlineText}
      onFileChange={setFile}
    />
  )
}

type KnowledgeSourceEditFormProps = {
  source: KnowledgeSourceDto
  avatars: AvatarOption[]
  onCancel: () => void
  onSaved: (source: KnowledgeSourceDto) => void
  onError: (message: string) => void
}

export function KnowledgeSourceEditForm({
  source,
  avatars,
  onCancel,
  onSaved,
  onError,
}: KnowledgeSourceEditFormProps): JSX.Element {
  const [name, setName] = useState(source.name)
  const [visibilityPolicy, setVisibilityPolicy] = useState<VisibilityPolicy>(
    normalizeVisibilityPolicy(source.visibilityPolicy, source.visibleToAvatarIds),
  )
  const [visibleToAvatarIds, setVisibleToAvatarIds] = useState<string[]>(
    normalizeVisibleToAvatarIds(source.visibleToAvatarIds),
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault()
    if (name.trim().length === 0) return
    setSaving(true)
    const selectedAvatarIds = buildKnowledgeVisibilityInput(visibilityPolicy, visibleToAvatarIds)
    try {
      const updated = await updateKnowledgeSource(source.sourceId, {
        name: name.trim(),
        visibilityPolicy,
        ...(selectedAvatarIds !== undefined ? { visibleToAvatarIds: selectedAvatarIds } : {}),
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
          avatars={avatars}
          visibilityPolicy={visibilityPolicy}
          visibleToAvatarIds={visibleToAvatarIds}
          saving={saving}
          idPrefix="ks-edit"
          disableKnowledgeType
          onNameChange={setName}
          onKnowledgeTypeChange={() => {}}
          onVisibilityPolicyChange={setVisibilityPolicy}
          onVisibleToAvatarIdsChange={setVisibleToAvatarIds}
        />
        <KnowledgeSourceFormActions
          submitLabel={saving ? 'Saving…' : 'Save'}
          submitDisabled={
            saving || name.trim().length === 0 || (visibilityPolicy === 'avatars' && visibleToAvatarIds.length === 0)
          }
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
  avatars: AvatarOption[]
  visibilityPolicy: VisibilityPolicy
  visibleToAvatarIds: string[]
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
  onVisibleToAvatarIdsChange: (value: string[]) => void
  onInputModeChange: (value: 'text' | 'file') => void
  onInlineTextChange: (value: string) => void
  onFileChange: (value: File | null) => void
}

function KnowledgeSourceCreateLayout({
  name,
  knowledgeType,
  avatars,
  visibilityPolicy,
  visibleToAvatarIds,
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
  onVisibleToAvatarIdsChange,
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
          avatars={avatars}
          visibilityPolicy={visibilityPolicy}
          visibleToAvatarIds={visibleToAvatarIds}
          saving={saving}
          idPrefix="ks-create"
          onNameChange={onNameChange}
          onKnowledgeTypeChange={onKnowledgeTypeChange}
          onVisibilityPolicyChange={onVisibilityPolicyChange}
          onVisibleToAvatarIdsChange={onVisibleToAvatarIdsChange}
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

type CreateUploadedKnowledgeSourceArgs = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  visibilityPolicy: VisibilityPolicy
  visibleToAvatarIds?: string[]
  file: File | null
  setSaving: (value: boolean) => void
}

async function createUploadedKnowledgeSource({
  scenarioId,
  name,
  knowledgeType,
  visibilityPolicy,
  visibleToAvatarIds,
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
    ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
    content,
    filename: file.name,
  })
}

type CreateInlineKnowledgeSourceArgs = {
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  visibilityPolicy: VisibilityPolicy
  visibleToAvatarIds?: string[]
  inlineText: string
  setSaving: (value: boolean) => void
}

async function createInlineKnowledgeSource({
  scenarioId,
  name,
  knowledgeType,
  visibilityPolicy,
  visibleToAvatarIds,
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
    ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
    uriOrPath: buildInlineKnowledgeUri(name),
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
