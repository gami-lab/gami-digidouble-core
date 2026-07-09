// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScenarioSummary } from '@gami/shared'
import { listScenarios } from '../api/scenarios'
import { ScenarioListPage } from './ScenarioListPage'

vi.mock('../api/scenarios', () => ({
  listScenarios: vi.fn(),
}))

function createScenario(scenarioId: string, name: string): ScenarioSummary {
  return {
    scenarioId,
    name,
    status: 'active',
    objectives: ['Explore AI concepts'],
    worldContext: 'A guided discovery lab.',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}

describe('ScenarioListPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows a loading state while scenarios are fetched', () => {
    vi.mocked(listScenarios).mockReturnValue(new Promise(() => {}))

    render(<ScenarioListPage onOpenScenario={vi.fn()} onCreateScenario={vi.fn()} />)

    expect(screen.getByText('Loading scenarios…')).toBeTruthy()
  })

  it('renders fetched scenarios once loaded', async () => {
    vi.mocked(listScenarios).mockResolvedValue([createScenario('scenario_a', 'Guided Discovery')])

    render(<ScenarioListPage onOpenScenario={vi.fn()} onCreateScenario={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })
  })

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(listScenarios).mockRejectedValue(new Error('network down'))

    render(<ScenarioListPage onOpenScenario={vi.fn()} onCreateScenario={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('UNKNOWN_ERROR: Failed to load scenarios')).toBeTruthy()
    })
  })

  it('opens a scenario when its row is clicked', async () => {
    vi.mocked(listScenarios).mockResolvedValue([createScenario('scenario_a', 'Guided Discovery')])
    const onOpenScenario = vi.fn()

    render(<ScenarioListPage onOpenScenario={onOpenScenario} onCreateScenario={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })

    screen.getByText('Guided Discovery').closest('tr')?.click()

    expect(onOpenScenario).toHaveBeenCalledWith('scenario_a')
  })

  it('calls onCreateScenario when "Create scenario" is clicked', async () => {
    vi.mocked(listScenarios).mockResolvedValue([])
    const onCreateScenario = vi.fn()

    render(<ScenarioListPage onOpenScenario={vi.fn()} onCreateScenario={onCreateScenario} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create scenario' })).toBeTruthy()
    })

    screen.getByRole('button', { name: 'Create scenario' }).click()

    expect(onCreateScenario).toHaveBeenCalledTimes(1)
  })
})
