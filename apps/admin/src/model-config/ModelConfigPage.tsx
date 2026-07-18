import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type {
  ModelConfigResponse,
  ModelProviderName,
  UpdateModelConfigRequest,
} from '@gami/shared'
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

  const globalModelOptions =
    form === null ? [] : getModelPresetOptions(form.globalDefault.provider, form.globalDefault.model)

  return (
    <section className="admin-card">
      <h2>Model configuration</h2>
      <p className="admin-muted">
        Configure the global runtime default plus per-role overrides for Avatar, Game Master, and memory maintenance.
      </p>

      {isLoading ? <p>Loading model configuration…</p> : null}
      {error !== null ? <p className="admin-error">{error}</p> : null}
      {success !== null ? <p>{success}</p> : null}

      {form === null ? null : (
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
                setForm((previous) => {
                  if (previous === null) return previous
                  const provider = event.target.value
                  const nextModelOptions = getModelPresetOptions(provider, previous.globalDefault.model)
                  const model = nextModelOptions.some((option) => option.value === previous.globalDefault.model)
                    ? previous.globalDefault.model
                    : ''
                  return {
                    ...previous,
                    globalDefault: { provider, model },
                  }
                })
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
                setForm((previous) =>
                  previous === null
                    ? previous
                    : {
                        ...previous,
                        globalDefault: { ...previous.globalDefault, model: event.target.value },
                      },
                )
              }}
            >
              <option value="">inherit</option>
              {globalModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

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
                <tr key={role}>
                  <td>{ROLE_LABELS[role]}</td>
                  <td>
                    <select
                      className="admin-form-select"
                      value={form.roleOverrides[role].provider}
                      onChange={(event) => {
                        setForm((previous) => {
                          if (previous === null) return previous
                          const provider = event.target.value
                          const nextModelOptions = getModelPresetOptions(
                            provider,
                            previous.roleOverrides[role].model,
                          )
                          const model = nextModelOptions.some(
                            (option) => option.value === previous.roleOverrides[role].model,
                          )
                            ? previous.roleOverrides[role].model
                            : ''
                          return {
                            ...previous,
                            roleOverrides: {
                              ...previous.roleOverrides,
                              [role]: { provider, model },
                            },
                          }
                        })
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
                      value={form.roleOverrides[role].model}
                      onChange={(event) => {
                        setForm((previous) =>
                          previous === null
                            ? previous
                            : {
                                ...previous,
                                roleOverrides: {
                                  ...previous.roleOverrides,
                                  [role]: {
                                    ...previous.roleOverrides[role],
                                    model: event.target.value,
                                  },
                                },
                              },
                        )
                      }}
                    >
                      <option value="">inherit</option>
                      {getModelPresetOptions(
                        form.roleOverrides[role].provider,
                        form.roleOverrides[role].model,
                      ).map((option) => (
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
                            : {
                                ...previous,
                                roleOverrides: {
                                  ...previous.roleOverrides,
                                  [role]: { provider: '', model: '' },
                                },
                              },
                        )
                      }}
                    >
                      Reset to default
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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

function toModelConfigForm(config: ModelConfigResponse): ModelConfigForm {
  return {
    globalDefault: { ...config.globalDefault },
    roleOverrides: {
      avatar: {
        provider: config.roleOverrides.avatar?.provider ?? '',
        model: config.roleOverrides.avatar?.model ?? '',
      },
      gameMaster: {
        provider: config.roleOverrides.gameMaster?.provider ?? '',
        model: config.roleOverrides.gameMaster?.model ?? '',
      },
      memory: {
        provider: config.roleOverrides.memory?.provider ?? '',
        model: config.roleOverrides.memory?.model ?? '',
      },
    },
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
