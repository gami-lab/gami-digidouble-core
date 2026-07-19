// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarComputedTraits, AvatarSummary, ScenarioSummary } from '@gami/shared'
import { getScenario, listScenarioAvatars, prepareAvatarTraits } from '../api/scenarios'
import { listKnowledgeSources } from '../api/knowledge'
import { ScenarioDetailPage } from './ScenarioDetailPage'

vi.mock('../api/scenarios', () => ({
  getScenario: vi.fn(),
  listScenarioAvatars: vi.fn(),
  updateScenario: vi.fn(),
  updateAvatar: vi.fn(),
  createAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  prepareAvatarTraits: vi.fn(),
}))

vi.mock('../api/knowledge', () => ({
  listKnowledgeSources: vi.fn(),
  createKnowledgeSource: vi.fn(),
  uploadKnowledgeSource: vi.fn(),
  updateKnowledgeSource: vi.fn(),
  deleteKnowledgeSource: vi.fn(),
  triggerIngestion: vi.fn(),
  getIngestionJob: vi.fn(),
  listKnowledgeChunks: vi.fn(),
  queryKnowledgeRetrieval: vi.fn(),
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
    computedTraits: null,
    config: {},
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function createComputedTraits(overrides: Partial<AvatarComputedTraits> = {}): AvatarComputedTraits {
  return {
    identity: ['A guide at the discovery lab'],
    personality: ['Curious and warm'],
    speakingStyle: ['Uses short, friendly sentences'],
    background: ['Grew up near the lab'],
    timeline: ['Joined the lab five years ago'],
    currentSituation: ['Leading today\'s session'],
    behaviouralRules: ['Never reveals the answer directly'],
    ...overrides,
  }
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

function renderPage(): void {
  render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)
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

describe('ScenarioDetailPage avatar trait preparation signal', () => {
  it('shows a "not prepared" signal for avatars without computed traits', async () => {
    mockReadyLoad({ avatars: [createAvatar()] })

    renderPage()
    await waitForScenario()

    const avatarRow = screen.getByText('Mira').closest('tr')
    expect(within(avatarRow as HTMLTableRowElement).getByText('not prepared')).toBeTruthy()
  })

  it('shows a "prepared" signal for avatars with computed traits', async () => {
    mockReadyLoad({ avatars: [createAvatar({ computedTraits: createComputedTraits() })] })

    renderPage()
    await waitForScenario()

    const avatarRow = screen.getByText('Mira').closest('tr')
    expect(within(avatarRow as HTMLTableRowElement).getByText('prepared')).toBeTruthy()
  })
})

describe('ScenarioDetailPage avatar trait preparation trigger', () => {
  it('disables the trigger and shows a loading label while preparation runs', async () => {
    mockReadyLoad({ avatars: [createAvatar()] })
    vi.mocked(prepareAvatarTraits).mockReturnValue(new Promise(() => {}))

    renderPage()
    await waitForScenario()

    fireEvent.click(screen.getByRole('button', { name: 'Prepare avatar traits' }))

    const button = screen.getByRole('button', { name: 'Preparing…' })
    expect(button).toBeTruthy()
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('refreshes avatars from the API and shows a success message after preparation', async () => {
    mockReadyLoad({ avatars: [createAvatar()] })
    vi.mocked(prepareAvatarTraits).mockResolvedValue({
      scenarioId: 'scenario_a',
      results: [
        { avatarId: 'avatar_1', status: 'prepared', computedTraits: createComputedTraits() },
      ],
    })

    renderPage()
    await waitForScenario()

    vi.mocked(listScenarioAvatars).mockResolvedValue([
      createAvatar({ computedTraits: createComputedTraits() }),
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Prepare avatar traits' }))

    await waitFor(() => {
      expect(prepareAvatarTraits).toHaveBeenCalledWith('scenario_a')
    })
    await waitFor(() => {
      expect(listScenarioAvatars).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(screen.getByText('Prepared traits for 1 avatar(s).')).toBeTruthy()
    })
    const avatarRow = screen.getByText('Mira').closest('tr')
    expect(within(avatarRow as HTMLTableRowElement).getByText('prepared')).toBeTruthy()
  })

  it('shows a failure message when trait preparation fails', async () => {
    mockReadyLoad({ avatars: [createAvatar()] })
    vi.mocked(prepareAvatarTraits).mockRejectedValue(new Error('boom'))

    renderPage()
    await waitForScenario()

    fireEvent.click(screen.getByRole('button', { name: 'Prepare avatar traits' }))

    await waitFor(() => {
      expect(screen.getByText('UNKNOWN_ERROR: Failed to prepare avatar traits')).toBeTruthy()
    })
    expect(listScenarioAvatars).toHaveBeenCalledTimes(1)
  })
})

describe('ScenarioDetailPage read-only computed traits', () => {
  it('shows the seven computed trait sections read-only in the avatar edit panel', async () => {
    mockReadyLoad({ avatars: [createAvatar({ computedTraits: createComputedTraits() })] })

    renderPage()
    await waitForScenario()

    const avatarRow = screen.getByText('Mira').closest('tr')
    fireEvent.click(within(avatarRow as HTMLTableRowElement).getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Computed traits')).toBeTruthy()
    expect(screen.getByText('Curious and warm')).toBeTruthy()
    expect(screen.getByText('Never reveals the answer directly')).toBeTruthy()
    expect(screen.queryByDisplayValue('Curious and warm')).toBeNull()
  })

  it('does not show the computed traits block when traits are absent', async () => {
    mockReadyLoad({ avatars: [createAvatar()] })

    renderPage()
    await waitForScenario()

    const avatarRow = screen.getByText('Mira').closest('tr')
    fireEvent.click(within(avatarRow as HTMLTableRowElement).getByRole('button', { name: 'Edit' }))

    expect(screen.queryByText('Computed traits')).toBeNull()
  })
})
