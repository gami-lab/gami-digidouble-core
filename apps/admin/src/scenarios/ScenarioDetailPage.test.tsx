// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarSummary, KnowledgeSourceDto, ScenarioSummary } from '@gami/shared'
import {
  createAvatar as createAvatarApi,
  getScenario,
  listScenarioAvatars,
  updateScenario,
} from '../api/scenarios'
import {
  createKnowledgeSource as createKnowledgeSourceApi,
  getIngestionJob,
  listKnowledgeChunks,
  listKnowledgeSources,
  queryKnowledgeRetrieval,
  triggerIngestion,
  updateKnowledgeSource as updateKnowledgeSourceApi,
  uploadKnowledgeSource as uploadKnowledgeSourceApi,
} from '../api/knowledge'
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

function createKnowledgeSource(overrides: Partial<KnowledgeSourceDto> = {}): KnowledgeSourceDto {
  return {
    sourceId: 'knowledge_source_1',
    scenarioId: 'scenario_a',
    name: 'Secret lore',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: 'inline://secret-lore.txt',
    status: 'pending',
    createdAt: '2026-06-01T00:00:00.000Z',
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
  knowledgeSources = [] as KnowledgeSourceDto[],
}: {
  scenario?: ScenarioSummary
  avatars?: AvatarSummary[]
  knowledgeSources?: KnowledgeSourceDto[]
} = {}): void {
  vi.mocked(getScenario).mockResolvedValue(scenario)
  vi.mocked(listScenarioAvatars).mockResolvedValue(avatars)
  vi.mocked(listKnowledgeSources).mockResolvedValue(knowledgeSources)
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
  vi.unstubAllGlobals()
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

describe('ScenarioDetailPage knowledge section', () => {
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

class MockKnowledgeFileReader {
  public result: string | ArrayBuffer | null = null
  public onload: null | (() => void) = null
  public onerror: null | (() => void) = null

  readAsDataURL(file: File): void {
    this.result = `data:${file.type};base64,${Buffer.from('Top secret clue').toString('base64')}`
    this.onload?.()
  }
}

describe('ScenarioDetailPage knowledge creation submissions', () => {
  it('submits pasted-text knowledge creation with avatar-scoped visibility', async () => {
    mockReadyLoad({
      avatars: [createAvatar(), createAvatar({ avatarId: 'avatar_2', name: 'Noor' })],
    })
    vi.mocked(createKnowledgeSourceApi).mockResolvedValue(
      createKnowledgeSource({
        visibilityPolicy: 'avatars',
        visibleToAvatarIds: ['avatar_1', 'avatar_2'],
      }),
    )

    renderPage()

    await waitForScenario()
    fireEvent.click(screen.getByRole('button', { name: 'Add knowledge' }))

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Character secrets' } })
    fireEvent.change(screen.getByLabelText(/Visibility policy/), {
      target: { value: 'avatars' },
    })
    fireEvent.click(screen.getByLabelText('Mira'))
    fireEvent.click(screen.getByLabelText('Noor'))
    fireEvent.change(screen.getByLabelText(/Content/), {
      target: { value: 'Hidden relationships between suspects.' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: /Create knowledge source/ }).closest('form') as HTMLFormElement,
    )

    await waitFor(() => {
      expect(createKnowledgeSourceApi).toHaveBeenCalledWith({
        scenarioId: 'scenario_a',
        name: 'Character secrets',
        knowledgeType: 'world',
        visibilityPolicy: 'avatars',
        visibleToAvatarIds: ['avatar_1', 'avatar_2'],
        format: 'text',
        uriOrPath: 'inline://character-secrets.txt',
        metadata: { inlineText: 'Hidden relationships between suspects.' },
      })
    })
  })

  it('submits uploaded knowledge creation with GM-only visibility', async () => {
    mockReadyLoad({ avatars: [createAvatar()] })
    vi.mocked(uploadKnowledgeSourceApi).mockResolvedValue(
      createKnowledgeSource({
        name: 'Clue packet',
        uriOrPath: 'clues.txt',
        visibilityPolicy: 'none',
      }),
    )

    vi.stubGlobal('FileReader', MockKnowledgeFileReader)

    renderPage()

    await waitForScenario()
    fireEvent.click(screen.getByRole('button', { name: 'Add knowledge' }))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Clue packet' } })
    fireEvent.change(screen.getByLabelText(/Visibility policy/), {
      target: { value: 'none' },
    })
    fireEvent.click(screen.getByLabelText(/Upload file/))
    fireEvent.change(screen.getByLabelText(/File \(PDF or TXT\)/), {
      target: {
        files: [new File(['Top secret clue'], 'clues.txt', { type: 'text/plain' })],
      },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: /Create knowledge source/ }).closest('form') as HTMLFormElement,
    )

    await waitFor(() => {
      expect(uploadKnowledgeSourceApi).toHaveBeenCalledWith({
        scenarioId: 'scenario_a',
        name: 'Clue packet',
        knowledgeType: 'world',
        visibilityPolicy: 'none',
        content: Buffer.from('Top secret clue').toString('base64'),
        filename: 'clues.txt',
      })
    })
  })
})

describe('ScenarioDetailPage knowledge edit submissions', () => {
  it('submits knowledge visibility edits with canonical avatar ids', async () => {
    mockReadyLoad({
      avatars: [createAvatar(), createAvatar({ avatarId: 'avatar_2', name: 'Noor' })],
      knowledgeSources: [
        createKnowledgeSource({
          visibilityPolicy: 'all',
        }),
      ],
    })
    vi.mocked(updateKnowledgeSourceApi).mockResolvedValue(
      createKnowledgeSource({
        visibilityPolicy: 'avatars',
        visibleToAvatarIds: ['avatar_2'],
      }),
    )

    renderPage()

    await waitForScenario()

    const knowledgeRow = screen.getByText('Secret lore').closest('tr')
    expect(knowledgeRow).not.toBeNull()
    fireEvent.click(within(knowledgeRow as HTMLTableRowElement).getByRole('button', { name: 'Edit' }))

    fireEvent.change(screen.getByLabelText(/Visibility policy/), {
      target: { value: 'avatars' },
    })
    fireEvent.click(screen.getByLabelText('Noor'))
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(updateKnowledgeSourceApi).toHaveBeenCalledWith('knowledge_source_1', {
        name: 'Secret lore',
        visibilityPolicy: 'avatars',
        visibleToAvatarIds: ['avatar_2'],
      })
    })
  })
})

describe('ScenarioDetailPage knowledge ingestion feedback', () => {
  it('polls the ingestion job and refreshes the source status on success', async () => {
    mockReadyLoad({ knowledgeSources: [createKnowledgeSource({ status: 'pending' })] })
    vi.mocked(triggerIngestion).mockResolvedValue({
      ingestionJobId: 'job_1',
      sourceId: 'knowledge_source_1',
      status: 'queued',
      attempts: 0,
      createdAt: '2026-06-01T00:00:00.000Z',
    })
    vi.mocked(getIngestionJob).mockResolvedValue({
      ingestionJobId: 'job_1',
      sourceId: 'knowledge_source_1',
      status: 'completed',
      attempts: 1,
      createdAt: '2026-06-01T00:00:00.000Z',
    })
    vi.mocked(listKnowledgeSources).mockResolvedValueOnce([createKnowledgeSource({ status: 'pending' })])
    vi.mocked(listKnowledgeSources).mockResolvedValueOnce([createKnowledgeSource({ status: 'ready' })])

    renderPage()
    await waitForScenario()

    const knowledgeRow = screen.getByText('Secret lore').closest('tr')
    fireEvent.click(within(knowledgeRow as HTMLTableRowElement).getByRole('button', { name: 'Ingest' }))

    await waitFor(() => {
      expect(triggerIngestion).toHaveBeenCalledWith('knowledge_source_1')
    })
    await waitFor(() => {
      expect(getIngestionJob).toHaveBeenCalledWith('job_1')
    })
    await waitFor(() => {
      const refreshedRow = screen.getByText('Secret lore').closest('tr') as HTMLTableRowElement
      expect(within(refreshedRow).getByText('ready')).toBeTruthy()
    })
  })

  it('shows an inline error when the ingestion job fails', async () => {
    mockReadyLoad({ knowledgeSources: [createKnowledgeSource({ status: 'pending' })] })
    vi.mocked(triggerIngestion).mockResolvedValue({
      ingestionJobId: 'job_2',
      sourceId: 'knowledge_source_1',
      status: 'queued',
      attempts: 0,
      createdAt: '2026-06-01T00:00:00.000Z',
    })
    vi.mocked(getIngestionJob).mockResolvedValue({
      ingestionJobId: 'job_2',
      sourceId: 'knowledge_source_1',
      status: 'failed',
      attempts: 1,
      createdAt: '2026-06-01T00:00:00.000Z',
      errorMessage: 'Could not load source content.',
    })
    vi.mocked(listKnowledgeSources).mockResolvedValue([createKnowledgeSource({ status: 'error' })])

    renderPage()
    await waitForScenario()

    const knowledgeRow = screen.getByText('Secret lore').closest('tr')
    fireEvent.click(within(knowledgeRow as HTMLTableRowElement).getByRole('button', { name: 'Ingest' }))

    await waitFor(() => {
      expect(screen.getByText(/Could not load source content\./)).toBeTruthy()
    })
  })

  it('relabels the button "Re-ingest" once a source is ready', async () => {
    mockReadyLoad({ knowledgeSources: [createKnowledgeSource({ status: 'ready' })] })

    renderPage()
    await waitForScenario()

    const knowledgeRow = screen.getByText('Secret lore').closest('tr')
    expect(within(knowledgeRow as HTMLTableRowElement).getByRole('button', { name: 'Re-ingest' })).toBeTruthy()
  })
})

describe('ScenarioDetailPage ingested-data view', () => {
  it('opens the chunk viewer and lists ingested chunks', async () => {
    mockReadyLoad({ knowledgeSources: [createKnowledgeSource({ status: 'ready' })] })
    vi.mocked(listKnowledgeChunks).mockResolvedValue([
      {
        chunkId: 'chunk_1',
        sourceId: 'knowledge_source_1',
        content: 'Chunk one content',
        chunkIndex: 0,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ])

    renderPage()
    await waitForScenario()

    const knowledgeRow = screen.getByText('Secret lore').closest('tr')
    fireEvent.click(within(knowledgeRow as HTMLTableRowElement).getByRole('button', { name: 'View data' }))

    await waitFor(() => {
      expect(listKnowledgeChunks).toHaveBeenCalledWith('knowledge_source_1')
    })
    await waitFor(() => {
      expect(screen.getByText('Chunk one content')).toBeTruthy()
    })
  })
})

describe('ScenarioDetailPage retrieval tester', () => {
  it('runs a retrieval query and shows matched chunks', async () => {
    mockReadyLoad({ knowledgeSources: [createKnowledgeSource({ status: 'ready' })] })
    vi.mocked(queryKnowledgeRetrieval).mockResolvedValue({
      memory: [],
      world: [
        {
          sourceId: 'knowledge_source_1',
          chunkId: 'chunk_1',
          knowledgeType: 'world',
          content: 'World chunk content',
          score: 0.8,
          reason: 'lexical overlap',
        },
      ],
      media: [],
      trace: {
        query: 'lore',
        perType: {
          memory: { sourceIds: [], selectedChunkIds: [] },
          world: { sourceIds: ['knowledge_source_1'], selectedChunkIds: ['chunk_1'] },
          media: { sourceIds: [], selectedChunkIds: [] },
        },
      },
    })

    renderPage()
    await waitForScenario()

    fireEvent.click(screen.getByRole('button', { name: 'Test retrieval' }))
    fireEvent.change(screen.getByLabelText(/Query/), { target: { value: 'lore' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Run retrieval' }).closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(queryKnowledgeRetrieval).toHaveBeenCalledWith({ scenarioId: 'scenario_a', query: 'lore' })
    })
    await waitFor(() => {
      expect(screen.getByText('World chunk content')).toBeTruthy()
    })
  })
})
