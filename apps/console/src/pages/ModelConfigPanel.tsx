/* eslint-disable max-lines-per-function, complexity */
import { useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { ModelConfigResponse } from '@gami/shared'
import { ApiError } from '../api'
import { getModelConfig, updateModelConfig } from '../api'
import { PROVIDER_OPTIONS } from '../api/provider-options'
import { formatApiError } from '../api/error'
import { buttonStyle, errorStyle, inputStyle, labelStyle, sectionStyle } from './form-styles'

type RoleKey = 'avatar' | 'gameMaster' | 'memory'

type ModelOverrideForm = { provider: string; model: string }
type ModelConfigForm = {
  globalDefault: { provider: string; model: string }
  roleOverrides: Record<RoleKey, ModelOverrideForm>
}

export type UpdateModelConfigRequestBody = {
  globalDefault: { provider: string; model: string }
  roleOverrides: {
    avatar?: { provider?: string; model?: string }
    gameMaster?: { provider?: string; model?: string }
    memory?: { provider?: string; model?: string }
  }
}

const roleLabels: Record<RoleKey, string> = {
  avatar: 'Avatar',
  gameMaster: 'Game Master',
  memory: 'Memory',
}

const roleTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '12px',
}

const cellStyle: CSSProperties = {
  borderBottom: '1px solid #e5e7eb',
  padding: '8px',
  verticalAlign: 'middle',
}

export function ModelConfigPanel(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState<ModelConfigForm | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    void getModelConfig()
      .then((config) => {
        setForm(toModelConfigForm(config))
      })
      .catch((nextError: unknown) => {
        setError(formatApiError(nextError, 'Failed to load model configuration'))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const onSave = (): void => {
    if (form === null) return
    setError(null)
    setSuccess(null)
    setIsSaving(true)
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
        setError(formatApiError(nextError, 'Failed to save model configuration'))
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  return (
    <section style={sectionStyle}>
      <h3 style={{ marginTop: 0 }}>Model Configuration</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Configure global model default and per-role overrides.
      </p>
      {isLoading ? <p>Loading model configuration…</p> : null}
      {error !== null ? <p style={errorStyle}>{error}</p> : null}
      {success !== null ? <p style={{ color: '#15803d' }}>{success}</p> : null}
      {form === null ? null : (
        <>
          <label style={labelStyle} htmlFor="global-provider">
            Global provider
          </label>
          <select
            id="global-provider"
            style={inputStyle}
            value={form.globalDefault.provider}
            onChange={(event) => {
              setForm((prev) =>
                prev === null
                  ? prev
                  : {
                      ...prev,
                      globalDefault: { ...prev.globalDefault, provider: event.target.value },
                    },
              )
            }}
          >
            {PROVIDER_OPTIONS.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
          <label style={labelStyle} htmlFor="global-model">
            Global model
          </label>
          <input
            id="global-model"
            style={inputStyle}
            value={form.globalDefault.model}
            onChange={(event) => {
              setForm((prev) =>
                prev === null
                  ? prev
                  : {
                      ...prev,
                      globalDefault: { ...prev.globalDefault, model: event.target.value },
                    },
              )
            }}
          />

          <table style={roleTableStyle}>
            <thead>
              <tr>
                <th style={cellStyle}>Role</th>
                <th style={cellStyle}>Provider override</th>
                <th style={cellStyle}>Model override</th>
                <th style={cellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(['avatar', 'gameMaster', 'memory'] as RoleKey[]).map((role) => (
                <tr key={role}>
                  <td style={cellStyle}>{roleLabels[role]}</td>
                  <td style={cellStyle}>
                    <select
                      style={inputStyle}
                      value={form.roleOverrides[role].provider}
                      onChange={(event) => {
                        setForm((prev) =>
                          prev === null
                            ? prev
                            : {
                                ...prev,
                                roleOverrides: {
                                  ...prev.roleOverrides,
                                  [role]: {
                                    ...prev.roleOverrides[role],
                                    provider: event.target.value,
                                  },
                                },
                              },
                        )
                      }}
                    >
                      <option value="">inherit</option>
                      {PROVIDER_OPTIONS.map((provider) => (
                        <option key={provider} value={provider}>
                          {provider}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={cellStyle}>
                    <input
                      style={inputStyle}
                      value={form.roleOverrides[role].model}
                      onChange={(event) => {
                        setForm((prev) =>
                          prev === null
                            ? prev
                            : {
                                ...prev,
                                roleOverrides: {
                                  ...prev.roleOverrides,
                                  [role]: {
                                    ...prev.roleOverrides[role],
                                    model: event.target.value,
                                  },
                                },
                              },
                        )
                      }}
                      placeholder="inherit"
                    />
                  </td>
                  <td style={cellStyle}>
                    <button
                      type="button"
                      style={{ ...buttonStyle, marginTop: 0 }}
                      onClick={() => {
                        setForm((prev) =>
                          prev === null
                            ? prev
                            : {
                                ...prev,
                                roleOverrides: {
                                  ...prev.roleOverrides,
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

          <button type="button" style={buttonStyle} onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
    </section>
  )
}

export function toModelConfigForm(config: ModelConfigResponse): ModelConfigForm {
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

export function toUpdateModelConfigRequest(form: ModelConfigForm): UpdateModelConfigRequestBody {
  const roleOverrides: UpdateModelConfigRequestBody['roleOverrides'] = {}
  const avatarOverride = toOverride(form.roleOverrides.avatar)
  const gameMasterOverride = toOverride(form.roleOverrides.gameMaster)
  const memoryOverride = toOverride(form.roleOverrides.memory)
  if (avatarOverride !== undefined) roleOverrides.avatar = avatarOverride
  if (gameMasterOverride !== undefined) roleOverrides.gameMaster = gameMasterOverride
  if (memoryOverride !== undefined) roleOverrides.memory = memoryOverride

  return {
    globalDefault: {
      provider: form.globalDefault.provider,
      model: form.globalDefault.model,
    },
    roleOverrides,
  }
}

function toOverride(override: ModelOverrideForm): { provider?: string; model?: string } | undefined {
  const provider = override.provider.trim()
  const model = override.model.trim()
  if (provider.length === 0 && model.length === 0) return undefined
  return {
    ...(provider.length > 0 ? { provider } : {}),
    ...(model.length > 0 ? { model } : {}),
  }
}

export function formatValidationDetails(details: unknown): string {
  if (typeof details === 'string') return details
  return JSON.stringify(details)
}
