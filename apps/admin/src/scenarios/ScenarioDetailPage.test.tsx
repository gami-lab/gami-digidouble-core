// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarSummary, ScenarioSummary } from '@gami/shared'
import { getScenario, listScenarioAvatars, updateScenario } from '../api/scenarios'
import { listKnowledgeSources } from '../api/knowledge'
import { ScenarioDetailPage } from './ScenarioDetailPage'

vi.mock('../api/scenarios', () => ({
  getScenario: vi.fn(),
  listScenarioAvatars: vi.fn(),
  updateScenario: vi.fn(),
  updateAvatar: vi.fn(),
  createAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

vi.mock('../api/knowledge', () => ({
  listKnowledgeSources: vi.fn(),
  createKnowledgeSource: vi.fn(),
  uploadKnowledgeSource: vi.fn(),
  updateKnowledgeSource: vi.fn(),
  deleteKnowledgeSource: vi.fn(),
  triggerIngestion: vi.fn(),
}))

function createScenario(overrides: Partial<ScenarioSummary> = {}): ScenarioSummary {
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
    ...overrides,
  }
}

function createAvatar(overrides: Partial<AvatarSummary> = {}): AvatarSummary {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_a',
    name: 'Mira',
    status: 'active',
    personaPrompt: 'You are Mira.',
    config: {},
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
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
    vi.mocked(listScenarioAvatars).mockReturnValue(new Promise(() => {}))
    vi.mocked(listKnowledgeSources).mockReturnValue(new Promise(() => {}))

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    expect(screen.getByText('Loading scenario…')).toBeTruthy()
  })

  it('renders the fetched scenario details with avatars', async () => {
    vi.mocked(getScenario).mockResolvedValue(createScenario())
    vi.mocked(listScenarioAvatars).mockResolvedValue([createAvatar()])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Guided Discovery')).toBeTruthy()
    })
    expect(screen.getByText('A guided discovery lab.')).toBeTruthy()
    expect(screen.getByText('Explore AI concepts')).toBeTruthy()
    expect(screen.getByText('Mira')).toBeTruthy()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(getScenario).mockRejectedValue(new Error('not found'))
    vi.mocked(listScenarioAvatars).mockResolvedValue([])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('UNKNOWN_ERROR: Failed to load scenario')).toBeTruthy()
    })
  })

  it('calls onBack when the back button is clicked', () => {
    vi.mocked(getScenario).mockReturnValue(new Promise(() => {}))
    vi.mocked(listScenarioAvatars).mockReturnValue(new Promise(() => {}))
    vi.mocked(listKnowledgeSources).mockReturnValue(new Promise(() => {}))
    const onBack = vi.fn()

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: '← Back to scenarios' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows scenario edit form when Edit button is clicked', async () => {
    vi.mocked(getScenario).mockResolvedValue(createScenario())
    vi.mocked(listScenarioAvatars).mockResolvedValue([])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Edit scenario')).toBeTruthy()
  })

  it('shows avatar create form when "Add avatar" is clicked', async () => {
    vi.mocked(getScenario).mockResolvedValue(createScenario())
    vi.mocked(listScenarioAvatars).mockResolvedValue([])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add avatar' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add avatar' }))

    expect(screen.getByText('Add avatar')).toBeTruthy()
    expect(screen.getByLabelText(/Persona prompt/)).toBeTruthy()
  })

  it('renders initially visible checkbox reflecting scenario avatarAvailability', async () => {
    vi.mocked(getScenario).mockResolvedValue(
      createScenario({ avatarAvailability: { initialAvatarIds: ['avatar_1'] } }),
    )
    vi.mocked(listScenarioAvatars).mockResolvedValue([createAvatar()])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Mira')).toBeTruthy()
    })

    const checkbox = screen.getByRole('checkbox', { name: /Initially visible: Mira/ })
    expect((checkbox as HTMLInputElement).checked).toBe(true)
  })

  it('calls updateScenario when visibility checkbox is toggled', async () => {
    const scenario = createScenario({ avatarAvailability: { initialAvatarIds: [] } })
    vi.mocked(getScenario).mockResolvedValue(scenario)
    vi.mocked(listScenarioAvatars).mockResolvedValue([createAvatar()])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])
    vi.mocked(updateScenario).mockResolvedValue(
      createScenario({ avatarAvailability: { initialAvatarIds: ['avatar_1'] } }),
    )

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Mira')).toBeTruthy()
    })

    const checkbox = screen.getByRole('checkbox', { name: /Initially visible: Mira/ })
    fireEvent.click(checkbox)

    expect(updateScenario).toHaveBeenCalledWith('scenario_a', {
      avatarAvailability: { initialAvatarIds: ['avatar_1'] },
    })
  })

  it('shows knowledge sources section with "Add knowledge" button', async () => {
    vi.mocked(getScenario).mockResolvedValue(createScenario())
    vi.mocked(listScenarioAvatars).mockResolvedValue([])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add knowledge' })).toBeTruthy()
    })
    expect(screen.getByText('No knowledge sources yet.')).toBeTruthy()
  })

  it('shows knowledge create form when "Add knowledge" is clicked', async () => {
    vi.mocked(getScenario).mockResolvedValue(createScenario())
    vi.mocked(listScenarioAvatars).mockResolvedValue([])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add knowledge' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add knowledge' }))

    expect(screen.getByText('Add knowledge source')).toBeTruthy()
    expect(screen.getByLabelText(/Visibility policy/)).toBeTruthy()
  })
})
