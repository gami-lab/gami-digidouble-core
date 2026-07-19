import { useEffect, useState } from 'react'
import type { Dispatch, JSX, SetStateAction } from 'react'
import type { ModelConfigResponse, ModelProviderName, UpdateModelConfigRequest } from '@gami/shared'
import { MODEL_PROVIDER_NAMES, getModelPresetOptions } from '@gami/shared'
import { ApiError } from '../api/client'
import { formatApiError } from '../api/error'
import { getModelConfig, updateModelConfig } from '../api/model-config'

type RoleKey = 'avatar' | 'gameMaster' | 'memory'

type ModelOverrideForm = {
  provider: string
  model: string
}

type ModelConfigForm = {
  globalDefault: {
    provider: string
    model: string
  }
  roleOverrides: Record<RoleKey, ModelOverrideForm>
}

type SetModelConfigForm = Dispatch<SetStateAction<ModelConfigForm | null>>

const ROLE_KEYS: RoleKey[] = ['avatar', 'gameMaster', 'memory']

const ROLE_LABELS: Record<RoleKey, string> = {
  avatar: 'Avatar',
  gameMaster: 'Game Master',
  memory: 'Memory',
}

export function ModelConfigPage(): JSX.Element {
  const [form, setForm] = useState<ModelConfigForm | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    void getModelConfig()
      .then((config) => {
        setForm(toModelConfigForm(config))
      })
      .catch((nextError: unknown) => {
        setError(formatApiError(nextError, 'UNKNOWN_ERROR: Failed to load model configuration'))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const onSave = (): void => {
    if (form === null) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    void updateModelConfig(toUpdateModelConfigRequest(form))
      .then((config) => {
        setForm(toModelConfigForm(config))
        setSuccess('Saved model configuration.')
      })
      .catch((nextError: unknown) => {
        if (nextError instanceof ApiError && nextError.code === 'VALIDATION_ERROR') {
          setError(`VALIDATION_ERROR: ${formatValidationDetails(nextError.details)}`)
          return
        }
        setError(formatApiError(nextError, 'UNKNOWN_ERROR: Failed to save model configuration'))
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  return (
    <section className="admin-card">
      <h2>Model configuration</h2>
      <p className="admin-muted">
        Configure the global runtime default plus per-role overrides for Avatar, Game Master, and
        memory maintenance.
      </p>

      {isLoading ? <p>Loading model configuration…</p> : null}
      {error !== null ? <p className="admin-error">{error}</p> : null}
      {success !== null ? <p>{success}</p> : null}

      {form === null ? null : (
        <>
          <GlobalDefaultFields form={form} setForm={setForm} />
          <RoleOverridesTable form={form} setForm={setForm} />

          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-button admin-button-primary"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

type GlobalDefaultFieldsProps = {
  form: ModelConfigForm
  setForm: SetModelConfigForm
}

function GlobalDefaultFields({ form, setForm }: GlobalDefaultFieldsProps): JSX.Element {
  const modelOptions = getModelPresetOptions(form.globalDefault.provider, form.globalDefault.model)

  return (
    <>
      <div className="admin-form-group">
        <label htmlFor="global-provider" className="admin-form-label">
          Global provider
        </label>
        <select
          id="global-provider"
          className="admin-form-select"
          value={form.globalDefault.provider}
          onChange={(event) => {
            const provider = event.target.value
            setForm((previous) =>
              previous === null ? previous : updateGlobalProvider(previous, provider),
            )
          }}
        >
          {MODEL_PROVIDER_NAMES.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-form-group">
        <label htmlFor="global-model" className="admin-form-label">
          Global model
        </label>
        <select
          id="global-model"
          className="admin-form-select"
          value={form.globalDefault.model}
          onChange={(event) => {
            const model = event.target.value
            setForm((previous) =>
              previous === null ? previous : updateGlobalModel(previous, model),
            )
          }}
        >
          <option value="">inherit</option>
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

type RoleOverridesTableProps = {
  form: ModelConfigForm
  setForm: SetModelConfigForm
}

function RoleOverridesTable({ form, setForm }: RoleOverridesTableProps): JSX.Element {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Role</th>
          <th>Provider override</th>
          <th>Model override</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {ROLE_KEYS.map((role) => (
          <RoleOverrideRow key={role} form={form} role={role} setForm={setForm} />
        ))}
      </tbody>
    </table>
  )
}

type RoleOverrideRowProps = {
  form: ModelConfigForm
  role: RoleKey
  setForm: SetModelConfigForm
}

function RoleOverrideRow({ form, role, setForm }: RoleOverrideRowProps): JSX.Element {
  const override = form.roleOverrides[role]
  const modelOptions = getModelPresetOptions(override.provider, override.model)

  return (
    <tr>
      <td>{ROLE_LABELS[role]}</td>
      <td>
        <select
          className="admin-form-select"
          value={override.provider}
          onChange={(event) => {
            const provider = event.target.value
            setForm((previous) =>
              previous === null ? previous : updateRoleProvider(previous, role, provider),
            )
          }}
        >
          <option value="">inherit</option>
          {MODEL_PROVIDER_NAMES.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          className="admin-form-select"
          value={override.model}
          onChange={(event) => {
            const model = event.target.value
            setForm((previous) =>
              previous === null ? previous : updateRoleModel(previous, role, model),
            )
          }}
        >
          <option value="">inherit</option>
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="admin-button admin-button-secondary"
          onClick={() => {
            setForm((previous) =>
              previous === null
                ? previous
                : updateRoleOverride(previous, role, { provider: '', model: '' }),
            )
          }}
        >
          Reset to default
        </button>
      </td>
    </tr>
  )
}

function updateGlobalProvider(previous: ModelConfigForm, provider: string): ModelConfigForm {
  return {
    ...previous,
    globalDefault: {
      provider,
      model: getSupportedModelOrEmpty(provider, previous.globalDefault.model),
    },
  }
}

function updateGlobalModel(previous: ModelConfigForm, model: string): ModelConfigForm {
  return {
    ...previous,
    globalDefault: { ...previous.globalDefault, model },
  }
}

function updateRoleProvider(
  previous: ModelConfigForm,
  role: RoleKey,
  provider: string,
): ModelConfigForm {
  return updateRoleOverride(previous, role, {
    provider,
    model: getSupportedModelOrEmpty(provider, previous.roleOverrides[role].model),
  })
}

function updateRoleModel(previous: ModelConfigForm, role: RoleKey, model: string): ModelConfigForm {
  return updateRoleOverride(previous, role, {
    ...previous.roleOverrides[role],
    model,
  })
}

function updateRoleOverride(
  previous: ModelConfigForm,
  role: RoleKey,
  override: ModelOverrideForm,
): ModelConfigForm {
  return {
    ...previous,
    roleOverrides: {
      ...previous.roleOverrides,
      [role]: override,
    },
  }
}

function getSupportedModelOrEmpty(provider: string, model: string): string {
  return getModelPresetOptions(provider, model).some((option) => option.value === model)
    ? model
    : ''
}

function toModelConfigForm(config: ModelConfigResponse): ModelConfigForm {
  return {
    globalDefault: { ...config.globalDefault },
    roleOverrides: {
      avatar: toModelOverrideForm(config.roleOverrides.avatar),
      gameMaster: toModelOverrideForm(config.roleOverrides.gameMaster),
      memory: toModelOverrideForm(config.roleOverrides.memory),
    },
  }
}

function toModelOverrideForm(
  override: ModelConfigResponse['roleOverrides'][RoleKey] | undefined,
): ModelOverrideForm {
  return {
    provider: override?.provider ?? '',
    model: override?.model ?? '',
  }
}

function toUpdateModelConfigRequest(form: ModelConfigForm): UpdateModelConfigRequest {
  const roleOverrides: NonNullable<UpdateModelConfigRequest['roleOverrides']> = {}
  const avatarOverride = toOverride(form.roleOverrides.avatar)
  const gameMasterOverride = toOverride(form.roleOverrides.gameMaster)
  const memoryOverride = toOverride(form.roleOverrides.memory)

  if (avatarOverride !== undefined) roleOverrides.avatar = avatarOverride
  if (gameMasterOverride !== undefined) roleOverrides.gameMaster = gameMasterOverride
  if (memoryOverride !== undefined) roleOverrides.memory = memoryOverride

  return {
    globalDefault: {
      provider: form.globalDefault.provider as ModelProviderName,
      model: form.globalDefault.model,
    },
    roleOverrides,
  }
}

function toOverride(
  override: ModelOverrideForm,
): { provider?: ModelProviderName; model?: string } | undefined {
  const provider = override.provider.trim()
  const model = override.model.trim()

  if (provider.length === 0 && model.length === 0) return undefined

  return {
    ...(provider.length > 0 ? { provider: provider as ModelProviderName } : {}),
    ...(model.length > 0 ? { model } : {}),
  }
}

function formatValidationDetails(details: unknown): string {
  if (typeof details === 'string') return details
  return JSON.stringify(details)
}
