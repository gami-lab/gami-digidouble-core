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

    render(<ScenarioListPage onCreateScenario={vi.fn()} />)

    expect(screen.getByText('Loading scenarios…')).toBeTruthy()
  })

  it('renders fetched scenarios once loaded', async () => {
    vi.mocked(listScenarios).mockResolvedValue([createScenario('scenario_a', 'Guided Discovery')])

    render(<ScenarioListPage onCreateScenario={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })
  })

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(listScenarios).mockRejectedValue(new Error('network down'))

    render(<ScenarioListPage onCreateScenario={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('UNKNOWN_ERROR: Failed to load scenarios')).toBeTruthy()
    })
  })

  it('links each scenario to its detail URL and opens it when the row is clicked', async () => {
    vi.mocked(listScenarios).mockResolvedValue([createScenario('scenario_a', 'Guided Discovery')])
    window.history.replaceState(null, '', '/scenarios')

    render(<ScenarioListPage onCreateScenario={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })

    expect(screen.getByRole('link', { name: 'Guided Discovery' }).getAttribute('href')).toBe(
      '/scenarios/scenario_a',
    )
    screen.getByText('Guided Discovery').closest('tr')?.click()

    expect(window.location.pathname).toBe('/scenarios/scenario_a')
  })

  it('calls onCreateScenario when "Create scenario" is clicked', async () => {
    vi.mocked(listScenarios).mockResolvedValue([])
    const onCreateScenario = vi.fn()

    render(<ScenarioListPage onCreateScenario={onCreateScenario} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create scenario' })).toBeTruthy()
    })

    screen.getByRole('button', { name: 'Create scenario' }).click()

    expect(onCreateScenario).toHaveBeenCalledTimes(1)
  })
})
