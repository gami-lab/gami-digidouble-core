// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiError, type AvatarSummary, type ScenarioSummary } from '@gami/shared'
import { updateAvatar, updateScenario } from '../api/scenarios'
import { AvatarEditForm } from './ScenarioAvatarForms'
import { ScenarioEditForm } from './ScenarioEditForm'

vi.mock('../api/scenarios', () => ({
  createAvatar: vi.fn(),
  updateAvatar: vi.fn(),
  updateScenario: vi.fn(),
}))

vi.mock('../voice/VoiceSelect', () => ({ VoiceSelect: () => null }))

const scenario: ScenarioSummary = {
  scenarioId: 'scenario_1',
  name: 'Villa',
  status: 'draft',
  language: 'en',
  objectives: [],
  worldContext: '',
  avatarAvailability: { initialAvatarIds: [] },
  presentation: {
    cover: 'https://cdn.example.com/cover.jpg',
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
    portrait: 'https://cdn.example.com/clara.png',
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
})

describe('scenario player presentation', () => {
  it('shows authored values with a cover preview and saves edits', async () => {
    vi.mocked(updateScenario).mockResolvedValue(scenario)
    render(
      <ScenarioEditForm
        scenario={scenario}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    )

    expect(screen.getByRole('img', { name: 'Cover preview' }).getAttribute('src')).toBe(
      'https://cdn.example.com/cover.jpg',
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
            cover: 'https://cdn.example.com/cover.jpg',
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
    render(
      <ScenarioEditForm
        scenario={scenario}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    )

    for (const label of ['Cover image URL', 'Tagline', 'Entry question']) {
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
            portrait: 'https://cdn.example.com/clara.png',
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
