// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarSummary, KnowledgeSourceDto, ScenarioSummary } from '@gami/shared'
import { getScenario, listScenarioAvatars } from '../api/scenarios'
import {
  listKnowledgeSources,
  updateKnowledgeSource as updateKnowledgeSourceApi,
} from '../api/knowledge'
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

function renderPage(): void {
  render(<ScenarioDetailPage scenarioId="scenario_a" onBack={vi.fn()} />)
}

async function waitForScenario(name = 'Guided Discovery'): Promise<void> {
  await waitFor(() => {
    expect(screen.getByText(name)).toBeTruthy()
  })
}

class MockKnowledgeFileReader {
  public result: string | ArrayBuffer | null = null
  public onload: null | (() => void) = null
  public onerror: null | (() => void) = null

  readAsDataURL(file: File): void {
    this.result = `data:${file.type};base64,${Buffer.from('Top secret clue').toString('base64')}`
    this.onload?.()
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ScenarioDetailPage knowledge content replacement', () => {
  it('submits inline knowledge content replacement through the edit form', async () => {
    mockReadyLoad({
      knowledgeSources: [createKnowledgeSource()],
    })
    vi.mocked(updateKnowledgeSourceApi).mockResolvedValue(
      createKnowledgeSource({
        status: 'pending',
      }),
    )

    renderPage()
    await waitForScenario()

    const knowledgeRow = screen.getByText('Secret lore').closest('tr')
    expect(knowledgeRow).not.toBeNull()
    fireEvent.click(within(knowledgeRow as HTMLTableRowElement).getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText(/Replace content/), {
      target: { value: 'Updated hidden lore.' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(updateKnowledgeSourceApi).toHaveBeenCalledWith('knowledge_source_1', {
        name: 'Secret lore',
        visibilityPolicy: 'all',
        uriOrPath: 'inline://secret-lore.txt',
        metadata: { inlineText: 'Updated hidden lore.' },
      })
    })
  })

  it('submits file-backed knowledge replacement through the edit form', async () => {
    mockReadyLoad({
      knowledgeSources: [
        createKnowledgeSource({
          name: 'Rulebook',
          format: 'pdf',
          uriOrPath: 'rulebook.pdf',
        }),
      ],
    })
    vi.mocked(updateKnowledgeSourceApi).mockResolvedValue(
      createKnowledgeSource({
        name: 'Rulebook',
        format: 'pdf',
        uriOrPath: 'rulebook-v2.pdf',
        status: 'pending',
      }),
    )
    vi.stubGlobal('FileReader', MockKnowledgeFileReader)

    renderPage()
    await waitForScenario()

    const knowledgeRow = screen.getByText('Rulebook').closest('tr')
    expect(knowledgeRow).not.toBeNull()
    fireEvent.click(within(knowledgeRow as HTMLTableRowElement).getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText(/Replace file/), {
      target: {
        files: [new File(['Replacement PDF bytes'], 'rulebook-v2.pdf', { type: 'application/pdf' })],
      },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(updateKnowledgeSourceApi).toHaveBeenCalledWith('knowledge_source_1', {
        name: 'Rulebook',
        visibilityPolicy: 'all',
        content: Buffer.from('Top secret clue').toString('base64'),
        filename: 'rulebook-v2.pdf',
      })
    })
  })
})
