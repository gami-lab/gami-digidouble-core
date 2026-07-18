// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelConfigResponse, ScenarioSummary } from '@gami/shared'
import App from './App'
import { listKnowledgeSources } from './api/knowledge'
import { getModelConfig } from './api/model-config'
import { getScenario, listScenarioAvatars, listScenarios } from './api/scenarios'

vi.mock('./api/scenarios', () => ({
  listScenarios: vi.fn(),
  getScenario: vi.fn(),
  listScenarioAvatars: vi.fn(),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  createAvatar: vi.fn(),
  updateAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

vi.mock('./api/knowledge', () => ({
  listKnowledgeSources: vi.fn(),
}))

vi.mock('./api/model-config', () => ({
  getModelConfig: vi.fn(),
  updateModelConfig: vi.fn(),
}))

function createScenario(): ScenarioSummary {
  return {
    scenarioId: 'scenario_a',
    name: 'Guided Discovery',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}

function createModelConfig(): ModelConfigResponse {
  return {
    globalDefault: { provider: 'openai', model: 'gpt-5.4' },
    roleOverrides: {},
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}

describe('App navigation', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows the nav shell and the scenario list by default', async () => {
    vi.mocked(listScenarios).mockResolvedValue([createScenario()])

    render(<App />)

    expect(screen.getByText('Gami DigiDouble — Admin')).toBeTruthy()
    expect(screen.getAllByText('Scenarios').length).toBeGreaterThan(0)
    expect(screen.getByText('Model Config')).toBeTruthy()
    expect(screen.queryByText('Knowledge Sources')).toBeNull()

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })
  })

  it('opens the scenario detail shell after selecting a scenario row', async () => {
    vi.mocked(listScenarios).mockResolvedValue([createScenario()])
    vi.mocked(getScenario).mockResolvedValue(createScenario())
    vi.mocked(listScenarioAvatars).mockResolvedValue([])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })

    screen.getByText('Guided Discovery').closest('tr')?.click()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '← Back to scenarios' })).toBeTruthy()
    })
    expect(getScenario).toHaveBeenCalledWith('scenario_a')
  })

  it('opens the model config page from the nav', async () => {
    vi.mocked(listScenarios).mockResolvedValue([createScenario()])
    vi.mocked(getModelConfig).mockResolvedValue(createModelConfig())

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })

    screen.getByRole('button', { name: 'Model Config' }).click()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Model configuration' })).toBeTruthy()
    })
    expect(getModelConfig).toHaveBeenCalledTimes(1)
  })
})
