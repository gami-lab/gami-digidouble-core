// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScenarioSummary } from '@gami/shared'
import { getScenario } from '../api/scenarios'
import { ScenarioDetailPage } from './ScenarioDetailPage'

vi.mock('../api/scenarios', () => ({
  getScenario: vi.fn(),
}))

function createScenario(): ScenarioSummary {
  return {
    scenarioId: 'scenario_a',
    name: 'Guided Discovery',
    status: 'active',
    objectives: ['Explore AI concepts'],
    worldContext: 'A guided discovery lab.',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}

describe('ScenarioDetailPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows a loading state while the scenario is fetched', () => {
    vi.mocked(getScenario).mockReturnValue(new Promise(() => {}))

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    expect(screen.getByText('Loading scenario…')).toBeTruthy()
  })

  it('renders the fetched scenario details', async () => {
    vi.mocked(getScenario).mockResolvedValue(createScenario())

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })
    expect(screen.getByText('A guided discovery lab.')).toBeTruthy()
    expect(screen.getByText('Explore AI concepts')).toBeTruthy()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(getScenario).mockRejectedValue(new Error('not found'))

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('UNKNOWN_ERROR: Failed to load scenario')).toBeTruthy()
    })
  })

  it('calls onBack when the back button is clicked', () => {
    vi.mocked(getScenario).mockReturnValue(new Promise(() => {}))
    const onBack = vi.fn()

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: '← Back to scenarios' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
