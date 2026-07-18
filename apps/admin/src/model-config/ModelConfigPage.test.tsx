// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelConfigResponse } from '@gami/shared'
import { getModelConfig, updateModelConfig } from '../api/model-config'
import { ModelConfigPage } from './ModelConfigPage'

vi.mock('../api/model-config', () => ({
  getModelConfig: vi.fn(),
  updateModelConfig: vi.fn(),
}))

function createModelConfig(): ModelConfigResponse {
  return {
    globalDefault: { provider: 'openai', model: 'gpt-5.4' },
    roleOverrides: {
      avatar: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    },
    updatedAt: '2026-07-18T00:00:00.000Z',
  }
}

describe('ModelConfigPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('loads the current model config on mount', async () => {
    vi.mocked(getModelConfig).mockResolvedValue(createModelConfig())

    render(<ModelConfigPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('openai')).toBeTruthy()
    })
    expect(screen.getByDisplayValue('gpt-5.4 (balanced)')).toBeTruthy()
    expect(screen.getByDisplayValue('anthropic')).toBeTruthy()
  })

  it('saves the edited model config', async () => {
    const modelConfig = createModelConfig()
    vi.mocked(getModelConfig).mockResolvedValue(modelConfig)
    vi.mocked(updateModelConfig).mockResolvedValue({
      ...modelConfig,
      roleOverrides: {
        avatar: { provider: 'xai', model: 'grok-4.3' },
      },
    })

    render(<ModelConfigPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('anthropic')).toBeTruthy()
    })

    const selects = screen.getAllByRole('combobox')
    const avatarProviderSelect = selects[2]
    const avatarModelSelect = selects[3]
    if (avatarProviderSelect === undefined || avatarModelSelect === undefined) {
      throw new Error('Expected avatar override selects to be rendered.')
    }

    fireEvent.change(avatarProviderSelect, {
      target: { value: 'xai' },
    })
    fireEvent.change(avatarModelSelect, {
      target: { value: 'grok-4.3' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateModelConfig).toHaveBeenCalledWith({
        globalDefault: { provider: 'openai', model: 'gpt-5.4' },
        roleOverrides: {
          avatar: { provider: 'xai', model: 'grok-4.3' },
        },
      })
    })
    expect(screen.getByText('Saved model configuration.')).toBeTruthy()
  })
})
