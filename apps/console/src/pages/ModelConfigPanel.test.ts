import { describe, expect, it } from 'vitest'
import type { ModelConfigResponse } from '@gami/shared'
import {
  formatValidationDetails,
  toModelConfigForm,
  toUpdateModelConfigRequest,
} from './ModelConfigPanel'

describe('ModelConfigPanel mapping helpers', () => {
  it('hydrates empty role overrides with inherit placeholders', () => {
    const config: ModelConfigResponse = {
      globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
      roleOverrides: {},
      updatedAt: '2026-05-20T00:00:00.000Z',
    }

    const form = toModelConfigForm(config)

    expect(form.globalDefault).toEqual({ provider: 'openai', model: 'gpt-4.1-mini' })
    expect(form.roleOverrides.avatar).toEqual({ provider: '', model: '' })
    expect(form.roleOverrides.gameMaster).toEqual({ provider: '', model: '' })
    expect(form.roleOverrides.memory).toEqual({ provider: '', model: '' })
  })

  it('drops empty overrides and trims override values on save mapping', () => {
    const form = {
      globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
      roleOverrides: {
        avatar: { provider: ' anthropic ', model: ' claude-3-7-sonnet ' },
        gameMaster: { provider: '', model: '' },
        memory: { provider: 'xai', model: ' ' },
      },
    }

    const request = toUpdateModelConfigRequest(form)

    expect(request).toEqual({
      globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
      roleOverrides: {
        avatar: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
        memory: { provider: 'xai' },
      },
    })
  })

  it('formats validation details for strings and structured payloads', () => {
    expect(formatValidationDetails('invalid')).toBe('invalid')
    expect(formatValidationDetails({ field: 'globalDefault.model' })).toBe(
      JSON.stringify({ field: 'globalDefault.model' }),
    )
  })
})
