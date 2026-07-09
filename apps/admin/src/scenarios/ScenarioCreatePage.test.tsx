// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScenarioSummary } from '@gami/shared'
import { createScenario } from '../api/scenarios'
import { ScenarioCreatePage } from './ScenarioCreatePage'

vi.mock('../api/scenarios', () => ({
  createScenario: vi.fn(),
}))

function makeScenario(): ScenarioSummary {
  return {
    scenarioId: 'scenario_new',
    name: 'New Scenario',
    status: 'draft',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

describe('ScenarioCreatePage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders the create form', () => {
    render(<ScenarioCreatePage onBack={vi.fn()} onCreated={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Create scenario' })).toBeTruthy()
    expect(screen.getByLabelText(/Name/)).toBeTruthy()
    expect(screen.getByLabelText(/World context/)).toBeTruthy()
  })

  it('calls onBack when Cancel is clicked', () => {
    const onBack = vi.fn()
    render(<ScenarioCreatePage onBack={onBack} onCreated={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('calls onBack when back link is clicked', () => {
    const onBack = vi.fn()
    render(<ScenarioCreatePage onBack={onBack} onCreated={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '← Back to scenarios' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('submits the form and calls onCreated with the new scenario ID', async () => {
    vi.mocked(createScenario).mockResolvedValue(makeScenario())
    const onCreated = vi.fn()

    render(<ScenarioCreatePage onBack={vi.fn()} onCreated={onCreated} />)

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'New Scenario' } })
    fireEvent.submit(screen.getByRole('button', { name: /Create scenario/ }).closest('form')!)

    await waitFor(() => {
      expect(createScenario).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Scenario' }),
      )
      expect(onCreated).toHaveBeenCalledWith('scenario_new')
    })
  })

  it('shows an error message when creation fails', async () => {
    vi.mocked(createScenario).mockRejectedValue(new Error('server error'))

    render(<ScenarioCreatePage onBack={vi.fn()} onCreated={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'New Scenario' } })
    fireEvent.submit(screen.getByRole('button', { name: /Create scenario/ }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/UNKNOWN_ERROR: Failed to create scenario/)).toBeTruthy()
    })
  })

  it('adds and removes objectives', async () => {
    render(<ScenarioCreatePage onBack={vi.fn()} onCreated={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Add an objective…'), {
      target: { value: 'Learn AI basics' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getByText('Learn AI basics')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: '✕' }))

    await waitFor(() => {
      expect(screen.queryByText('Learn AI basics')).toBeNull()
    })
  })
})
