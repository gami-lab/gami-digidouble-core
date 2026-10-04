import { useEffect, useState } from 'react'
import type { Dispatch, JSX, SetStateAction } from 'react'
import type { ModelConfigResponse } from '@gami/shared'
import {
  MODEL_PROVIDER_NAMES,
  getModelPresetOptions,
  mapModelConfigFormToRequest,
} from '@gami/shared'
import { ApiError } from '../api/client'
import { formatApiError } from '../api/error'
import { getModelConfig, updateModelConfig } from '../api/model-config'
import { ModelSelectionTable, selectProvider } from '../model-selection/ModelSelectionTable'
import { useDocumentTitle } from '../routing/router'

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
  useDocumentTitle(['Model config'])
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
    void updateModelConfig(mapModelConfigFormToRequest(form))
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

function RoleOverridesTable({ form, setForm }: GlobalDefaultFieldsProps): JSX.Element {
  return (
    <ModelSelectionTable
      providers={MODEL_PROVIDER_NAMES}
      rows={ROLE_KEYS.map((role) => ({
        id: `role-${role}`,
        label: ROLE_LABELS[role],
        value: form.roleOverrides[role],
      }))}
      onChange={(rowId, value) => {
        const role = ROLE_KEYS.find((key) => `role-${key}` === rowId)
        if (role === undefined) return
        setForm((previous) =>
          previous === null ? previous : updateRoleOverride(previous, role, value),
        )
      }}
    />
  )
}

function updateGlobalProvider(previous: ModelConfigForm, provider: string): ModelConfigForm {
  return {
    ...previous,
    globalDefault: selectProvider(previous.globalDefault, provider),
  }
}

function updateGlobalModel(previous: ModelConfigForm, model: string): ModelConfigForm {
  return {
    ...previous,
    globalDefault: { ...previous.globalDefault, model },
  }
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

function formatValidationDetails(details: unknown): string {
  if (typeof details === 'string') return details
  return JSON.stringify(details)
}
