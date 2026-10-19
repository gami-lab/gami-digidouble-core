// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createApiError,
  type AvatarSummary,
  type MediaAssetSummary,
  type MediaKind,
  type ScenarioSummary,
} from '@gami/shared'
import { listMediaAssets } from '../api/media'
import { createAvatar, updateAvatar, updateScenario } from '../api/scenarios'
import { AvatarCreateForm, AvatarEditForm } from './ScenarioAvatarForms'
import { ScenarioEditForm } from './ScenarioEditForm'
import { ScenarioPresentationFields } from './PresentationFields'

vi.mock('../api/scenarios', () => ({
  createAvatar: vi.fn(),
  updateAvatar: vi.fn(),
  updateScenario: vi.fn(),
}))

vi.mock('../voice/VoiceSelect', () => ({ VoiceSelect: () => null }))

vi.mock('../api/media', () => ({
  listMediaAssets: vi.fn(),
  mediaSrc: (asset: { previewUrl: string }) => asset.previewUrl,
}))

function mediaAsset(assetId: string, kind: MediaKind, description: string): MediaAssetSummary {
  return {
    assetId,
    scenarioId: 'scenario_1',
    kind,
    source: 'upload',
    mimeType: kind === 'image' ? 'image/png' : 'video/mp4',
    byteSize: 10,
    url: null,
    fileUrl: `/v1/media/${assetId}`,
    previewUrl: `/v1/admin/media/${assetId}/file`,
    posterAssetId: null,
    durationMs: null,
    description,
    cueable: false,
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  }
}

const LIBRARY = [
  mediaAsset('media_cover', 'image', 'The villa in the storm'),
  mediaAsset('media_clara', 'image', 'Clara by the window'),
  mediaAsset('media_intro', 'video', 'Arrival at the villa'),
]

const scenario: ScenarioSummary = {
  scenarioId: 'scenario_1',
  name: 'Villa',
  status: 'draft',
  language: 'en',
  objectives: [],
  worldContext: '',
  avatarAvailability: { initialAvatarIds: [] },
  presentation: {
    cover: 'media_cover',
    tagline: 'A storm',
    entryQuestion: { prompt: 'Who are you?', personaField: 'name' },
  },
  config: {},
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
}

const avatar: AvatarSummary = {
  avatarId: 'avatar_1',
  scenarioId: 'scenario_1',
  name: 'Clara',
  status: 'draft',
  personaPrompt: 'You are Clara.',
  presentation: {
    portrait: 'media_clara',
    hook: 'Saw everything',
    starterQuestions: ['First?', 'Second?'],
  },
  config: {},
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
}

function submit(buttonName: RegExp): void {
  fireEvent.submit(
    screen.getByRole('button', { name: buttonName }).closest('form') as HTMLFormElement,
  )
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listMediaAssets).mockResolvedValue(LIBRARY)
})

describe('scenario player presentation', () => {
  it('keeps media refs and saves text edits', async () => {
    vi.mocked(updateScenario).mockResolvedValue(scenario)
    render(
      <ScenarioEditForm
        scenario={scenario}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Outro text'), { target: { value: ' See you ' } })
    fireEvent.change(screen.getByLabelText('The answer fills'), {
      target: { value: 'roleInWorld' },
    })
    submit(/Save/)

    await waitFor(() => {
      expect(updateScenario).toHaveBeenCalledWith(
        'scenario_1',
        expect.objectContaining({
          presentation: {
            cover: 'media_cover',
            tagline: 'A storm',
            entryQuestion: { prompt: 'Who are you?', personaField: 'roleInWorld' },
            outroText: 'See you',
          },
        }),
      )
    })
  })

  it('clears presentation with null when every field is emptied', async () => {
    vi.mocked(updateScenario).mockResolvedValue(scenario)
    const withoutMedia = {
      tagline: 'A storm',
      entryQuestion: { prompt: 'Who are you?', personaField: 'name' as const },
    }
    render(
      <ScenarioEditForm
        scenario={{ ...scenario, presentation: withoutMedia }}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    )

    for (const label of ['Tagline', 'Entry question']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: '' } })
    }
    submit(/Save/)

    await waitFor(() => {
      expect(updateScenario).toHaveBeenCalledWith(
        'scenario_1',
        expect.objectContaining({ presentation: null }),
      )
    })
  })

  it('caps text inputs at the shared limits', () => {
    render(
      <ScenarioEditForm
        scenario={scenario}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Tagline').getAttribute('maxLength')).toBe('160')
  })
})

describe('avatar player presentation', () => {
  function renderAvatarForm(onError = vi.fn()): void {
    render(
      <AvatarEditForm
        avatar={avatar}
        scenarioLanguage="en"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={onError}
      />,
    )
  }

  it('adds up to three starter questions, then disables adding', () => {
    renderAvatarForm()
    const add = screen.getByRole('button', { name: 'Add starter question' })

    fireEvent.click(add)
    fireEvent.change(screen.getByLabelText('Starter question 3'), { target: { value: 'Third?' } })

    expect((add as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('article', { name: 'Character card preview' }).textContent).toContain(
      'Third?',
    )
  })

  it('reorders and removes starter questions before saving', async () => {
    vi.mocked(updateAvatar).mockResolvedValue(avatar)
    renderAvatarForm()

    fireEvent.click(screen.getByRole('button', { name: 'Add starter question' }))
    fireEvent.change(screen.getByLabelText('Starter question 3'), { target: { value: 'Third?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move starter question 2 up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove starter question 3' }))
    submit(/Save/)

    await waitFor(() => {
      expect(updateAvatar).toHaveBeenCalledWith(
        'avatar_1',
        expect.objectContaining({
          presentation: {
            portrait: 'media_clara',
            hook: 'Saw everything',
            starterQuestions: ['Second?', 'First?'],
          },
        }),
      )
    })
  })

  it('shows the server error when presentation is rejected', async () => {
    vi.mocked(updateAvatar).mockRejectedValue(
      createApiError({ code: 'VALIDATION_ERROR', message: 'presentation is invalid' }),
    )
    const onError = vi.fn()
    renderAvatarForm(onError)

    submit(/Save/)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('presentation is invalid'))
    })
  })
})

describe('presentation on create', () => {
  function renderCreate(): void {
    render(
      <AvatarCreateForm
        scenarioId="scenario_1"
        scenarioLanguage="en"
        onCancel={vi.fn()}
        onCreated={vi.fn()}
        onError={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Elias' } })
    fireEvent.change(screen.getByLabelText(/Persona prompt/), {
      target: { value: 'You are Elias.' },
    })
  }

  it('sends authored avatar presentation with the new avatar', async () => {
    vi.mocked(createAvatar).mockResolvedValue(avatar)
    renderCreate()
    fireEvent.change(screen.getByLabelText('One-line hook'), { target: { value: 'The doctor' } })
    submit(/Create avatar/)

    await waitFor(() => {
      expect(createAvatar).toHaveBeenCalledWith(
        'scenario_1',
        expect.objectContaining({ presentation: { hook: 'The doctor' } }),
      )
    })
  })

  it('omits presentation when nothing is authored', async () => {
    vi.mocked(createAvatar).mockResolvedValue(avatar)
    renderCreate()
    submit(/Create avatar/)

    await waitFor(() => {
      expect(createAvatar).toHaveBeenCalledTimes(1)
    })
    expect(vi.mocked(createAvatar).mock.calls[0]?.[1]).not.toHaveProperty('presentation')
  })
})

describe('media slots and triggers', () => {
  it('assigns intro media from the library and saves the ref with the scenario', async () => {
    vi.mocked(updateScenario).mockResolvedValue(scenario)
    render(
      <ScenarioEditForm
        scenario={scenario}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    )
    const introPicker = await screen.findByLabelText(/^Intro media/)
    await screen.findAllByRole('option', { name: /Arrival at the villa/ })

    fireEvent.change(introPicker, { target: { value: 'media_intro' } })
    submit(/Save/)

    await waitFor(() => {
      expect(updateScenario).toHaveBeenCalledTimes(1)
    })
    expect(vi.mocked(updateScenario).mock.calls[0]?.[1].presentation).toMatchObject({
      cover: 'media_cover',
      introMedia: 'media_intro',
    })
  })

  it('offers images only for the cover', async () => {
    render(
      <ScenarioEditForm
        scenario={scenario}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    )
    const cover = await screen.findByLabelText(/^Cover/)
    await screen.findAllByRole('option', { name: /Arrival at the villa/ })

    const labels = Array.from((cover as HTMLSelectElement).options).map((option) => option.text)
    expect(labels.some((label) => label.includes('Arrival at the villa'))).toBe(false)
  })

  it('saves avatar portrait and unlock trigger as refs', async () => {
    vi.mocked(updateAvatar).mockResolvedValue(avatar)
    render(
      <AvatarEditForm
        avatar={avatar}
        scenarioLanguage="en"
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    )
    await screen.findAllByRole('option', { name: /Arrival at the villa/ })

    fireEvent.change(screen.getByLabelText(/^When unlocked/), { target: { value: 'media_intro' } })
    submit(/Save/)

    await waitFor(() => {
      expect(updateAvatar).toHaveBeenCalledTimes(1)
    })
    const payload = vi.mocked(updateAvatar).mock.calls[0]?.[1]
    expect(payload?.presentation).toMatchObject({ portrait: 'media_clara' })
    expect(payload?.mediaTriggers).toEqual({ onUnlock: 'media_intro' })
  })

  it('explains that a new scenario has no library yet', () => {
    render(<ScenarioPresentationFields idPrefix="new" value={{}} disabled={false} onChange={vi.fn()} />)

    expect(screen.getByText(/Save the scenario first/)).not.toBeNull()
    expect(listMediaAssets).not.toHaveBeenCalled()
  })
})
