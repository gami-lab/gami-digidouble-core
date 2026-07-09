// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarSummary, ScenarioSummary } from '@gami/shared'
import {
  createAvatar as createAvatarApi,
  getScenario,
  listScenarioAvatars,
  updateScenario,
} from '../api/scenarios'
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

function mockPendingLoad(): void {
  vi.mocked(getScenario).mockReturnValue(new Promise(() => {}))
  vi.mocked(listScenarioAvatars).mockReturnValue(new Promise(() => {}))
  vi.mocked(listKnowledgeSources).mockReturnValue(new Promise(() => {}))
}

function mockReadyLoad({
  scenario = createScenario(),
  avatars = [] as AvatarSummary[],
}: {
  scenario?: ScenarioSummary
  avatars?: AvatarSummary[]
} = {}): void {
  vi.mocked(getScenario).mockResolvedValue(scenario)
  vi.mocked(listScenarioAvatars).mockResolvedValue(avatars)
  vi.mocked(listKnowledgeSources).mockResolvedValue([])
}

function renderPage(onBack = vi.fn()): void {
  render(<ScenarioDetailPage scenarioId="scenario_a" onBack={onBack} />)
}

async function waitForScenario(name = 'Guided Discovery'): Promise<void> {
  await waitFor(() => {
    expect(screen.getByText(name)).toBeTruthy()
  })
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ScenarioDetailPage loading and data states', () => {
  it('shows a loading state while the scenario is fetched', () => {
    mockPendingLoad()

    renderPage()

    expect(screen.getByText('Loading scenario…')).toBeTruthy()
  })

  it('renders the fetched scenario details with avatars', async () => {
    mockReadyLoad({
      scenario: createScenario({
        modelSelection: {
          defaultProfile: { provider: 'openai', model: 'gpt-4o' },
          gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        },
      }),
      avatars: [createAvatar({ llmOverride: { provider: 'mistral', model: 'mistral-small-4' } })],
    })

    renderPage()

    await waitForScenario()
    expect(screen.getByText('A guided discovery lab.')).toBeTruthy()
    expect(screen.getByText('Explore AI concepts')).toBeTruthy()
    expect(screen.getByText('Mira')).toBeTruthy()
    expect(screen.getByText(/Scenario default:\s*openai \/ gpt-4o/)).toBeTruthy()
    expect(
      screen.getByText(/Game Master override:\s*anthropic \/ claude-sonnet-4-6/),
    ).toBeTruthy()
    expect(screen.getByText('mistral / mistral-small-4')).toBeTruthy()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(getScenario).mockRejectedValue(new Error('not found'))
    vi.mocked(listScenarioAvatars).mockResolvedValue([])
    vi.mocked(listKnowledgeSources).mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('UNKNOWN_ERROR: Failed to load scenario')).toBeTruthy()
    })
  })
})

describe('ScenarioDetailPage navigation and avatar actions', () => {
  it('calls onBack when the back button is clicked', () => {
    mockPendingLoad()
    const onBack = vi.fn()

    renderPage(onBack)
    fireEvent.click(screen.getByRole('button', { name: '← Back to scenarios' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('shows scenario edit form when Edit button is clicked', async () => {
    mockReadyLoad()

    renderPage()

    await waitForScenario()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Edit scenario')).toBeTruthy()
  })

  it('shows avatar create form when "Add avatar" is clicked', async () => {
    mockReadyLoad()

    renderPage()

    await waitForScenario()

    fireEvent.click(screen.getByRole('button', { name: 'Add avatar' }))

    expect(screen.getByText('Add avatar')).toBeTruthy()
    expect(screen.getByLabelText(/Persona prompt/)).toBeTruthy()
  })

  it('submits avatar model override from the create form', async () => {
    mockReadyLoad()
    vi.mocked(createAvatarApi).mockResolvedValue(createAvatar())

    renderPage()

    await waitForScenario()
    fireEvent.click(screen.getByRole('button', { name: 'Add avatar' }))

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Mira' } })
    fireEvent.change(screen.getByLabelText(/Persona prompt/), { target: { value: 'You are Mira.' } })
    fireEvent.change(screen.getByLabelText('Provider', { selector: '#create-avatar-model-provider' }), {
      target: { value: 'openai' },
    })
    fireEvent.change(screen.getByLabelText('Model', { selector: '#create-avatar-model-model' }), {
      target: { value: 'gpt-4o' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /Create avatar/ }).closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(createAvatarApi).toHaveBeenCalledWith('scenario_a', {
        name: 'Mira',
        personaPrompt: 'You are Mira.',
        status: 'active',
        llmOverride: { provider: 'openai', model: 'gpt-4o' },
      })
    })
  })

  it('renders initially visible checkbox reflecting scenario avatarAvailability', async () => {
    mockReadyLoad({
      scenario: createScenario({ avatarAvailability: { initialAvatarIds: ['avatar_1'] } }),
      avatars: [createAvatar()],
    })

    renderPage()

    await waitForScenario()

    const checkbox = screen.getByRole('checkbox', { name: /Initially visible: Mira/ })
    expect((checkbox as HTMLInputElement).checked).toBe(true)
  })

  it('calls updateScenario when visibility checkbox is toggled', async () => {
    const scenario = createScenario({ avatarAvailability: { initialAvatarIds: [] } })
    mockReadyLoad({ scenario, avatars: [createAvatar()] })
    vi.mocked(updateScenario).mockResolvedValue(
      createScenario({ avatarAvailability: { initialAvatarIds: ['avatar_1'] } }),
    )

    renderPage()

    await waitForScenario()

    const checkbox = screen.getByRole('checkbox', { name: /Initially visible: Mira/ })
    fireEvent.click(checkbox)

    expect(updateScenario).toHaveBeenCalledWith('scenario_a', {
      avatarAvailability: { initialAvatarIds: ['avatar_1'] },
    })
  })
})

describe('ScenarioDetailPage knowledge actions', () => {
  it('shows knowledge sources section with "Add knowledge" button', async () => {
    mockReadyLoad()

    renderPage()

    await waitForScenario()
    expect(screen.getByText('No knowledge sources yet.')).toBeTruthy()
  })

  it('shows knowledge create form when "Add knowledge" is clicked', async () => {
    mockReadyLoad()

    renderPage()

    await waitForScenario()

    fireEvent.click(screen.getByRole('button', { name: 'Add knowledge' }))

    expect(screen.getByText('Add knowledge source')).toBeTruthy()
    expect(screen.getByLabelText(/Visibility policy/)).toBeTruthy()
  })
})
