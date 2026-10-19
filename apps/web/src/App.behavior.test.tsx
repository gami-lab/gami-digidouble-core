// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  RuntimeEvent,
  AvailableAvatarSummary,
  ConversationSummary,
  PublicScenarioSummary,
  SessionSummary,
} from '@gami/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import i18n from './i18n/index'
import { getPlayer } from './api/player-session'
import { subscribeToRuntimeEvents } from './api/runtime-events-stream'
import { listAvailableScenarios } from './api/scenarios'
import { ensureActiveSession, getAvailableAvatarsForSession, startSession } from './api/sessions'
import {
  endConversation,
  getConversationHistory,
  sendMessageStream,
  startConversation,
  switchAvatar,
} from './api/conversations'
import { upsertUserPersona } from './api/users'
import { LOCAL_WEB_RUNTIME_STORAGE_KEY } from './runtime/local-runtime-state'

vi.mock('./api/player-session', () => ({ getPlayer: vi.fn() }))
vi.mock('./api/scenarios', () => ({ listAvailableScenarios: vi.fn() }))
vi.mock('./api/sessions', () => ({
  ensureActiveSession: vi.fn(),
  getAvailableAvatarsForSession: vi.fn(),
  startSession: vi.fn(),
}))
vi.mock('./api/runtime-events-stream', () => ({ subscribeToRuntimeEvents: vi.fn() }))
vi.mock('./api/users', () => ({ upsertUserPersona: vi.fn() }))
vi.mock('./api/conversations', () => ({
  startConversation: vi.fn(),
  sendMessageStream: vi.fn(),
  getConversationHistory: vi.fn(),
  endConversation: vi.fn(),
  requestMessageAudio: vi.fn(),
  sendVoiceMessageStream: vi.fn(),
  switchAvatar: vi.fn(),
}))

const villa: PublicScenarioSummary = {
  scenarioId: 'scenario_villa',
  name: 'Villa Miralac',
  presentation: {
    tagline: 'A storm and a locked villa.',
    introText: 'Nobody leaves until the truth comes out.',
    entryQuestion: { prompt: 'And you are…?', personaField: 'name' },
    outroText: 'The storm is passing.',
  },
}

const session: SessionSummary = {
  sessionId: 'session_1',
  userId: 'player_1',
  scenarioId: 'scenario_villa',
  unlockedAvatarIds: ['avatar_clara'],
  status: 'active',
  startedAt: '2026-10-19T00:00:00.000Z',
  lastActivityAt: '2026-10-19T00:00:00.000Z',
}

const clara: AvailableAvatarSummary = {
  avatarId: 'avatar_clara',
  scenarioId: 'scenario_villa',
  name: 'Clara',
  status: 'active',
  presentation: {
    hook: 'The housekeeper who saw everything.',
    starterQuestions: ['What did you see last night?'],
  },
}

const elias: AvailableAvatarSummary = {
  avatarId: 'avatar_elias',
  scenarioId: 'scenario_villa',
  name: 'Elias',
  status: 'active',
}

const conversation: ConversationSummary = {
  conversationId: 'conversation_1',
  sessionId: 'session_1',
  avatarId: 'avatar_clara',
  status: 'active',
  startedAt: '2026-10-19T00:00:00.000Z',
  lastActivityAt: '2026-10-19T00:00:00.000Z',
}

async function click(name: string | RegExp): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name }))
}

async function reachCharacterChoice(): Promise<void> {
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Villa Miralac' })).toBeTruthy()
  expect(screen.getByText('A storm and a locked villa.')).toBeTruthy()
  await click('Begin')
  expect(screen.getByText('Nobody leaves until the truth comes out.')).toBeTruthy()
  await click('Continue')
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'Inspector Vega' } })
  await click('Answer')
  await screen.findByRole('heading', { name: 'Who do you want to talk to?' })
}

beforeEach(async () => {
  vi.resetAllMocks()
  window.localStorage.clear()
  await i18n.changeLanguage('en')
  vi.mocked(getPlayer).mockResolvedValue({
    userId: 'player_1',
    token: 'token',
    expiresAt: '2099-01-01T00:00:00.000Z',
  })
  vi.mocked(listAvailableScenarios).mockResolvedValue([villa])
  vi.mocked(ensureActiveSession).mockResolvedValue(session)
  vi.mocked(startSession).mockResolvedValue({ ...session, sessionId: 'session_2' })
  vi.mocked(getAvailableAvatarsForSession).mockResolvedValue([clara, elias])
  vi.mocked(subscribeToRuntimeEvents).mockReturnValue({ close: vi.fn() })
  vi.mocked(upsertUserPersona).mockResolvedValue({
    userId: 'player_1',
    persona: { name: 'Inspector Vega' },
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
  })
  vi.mocked(startConversation).mockResolvedValue(conversation)
  vi.mocked(sendMessageStream).mockResolvedValue(undefined)
  vi.mocked(endConversation).mockResolvedValue({} as never)
})

afterEach(() => {
  cleanup()
})

describe('guided player flow', () => {
  it('goes from landing to the first message, saving the in-world answer', async () => {
    await reachCharacterChoice()
    expect(upsertUserPersona).toHaveBeenCalledWith({ name: 'Inspector Vega' })

    await click('Talk to Clara')
    const composer = await screen.findByLabelText('Your message')
    fireEvent.change(composer, { target: { value: 'What did you see?' } })
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => {
      expect(sendMessageStream).toHaveBeenCalledWith(
        'conversation_1',
        { message: { content: 'What did you see?' } },
        expect.anything(),
        expect.anything(),
      )
    })
    expect(screen.getByRole('heading', { name: 'Clara' })).toBeTruthy()
  })

  it('logs the time from landing to the first sent message once', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    await reachCharacterChoice()
    await click('What did you see last night?')

    await waitFor(() => {
      expect(info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[gami\] time to first exchange: \d+ ms$/),
      )
    })
    expect(info).toHaveBeenCalledTimes(1)
    info.mockRestore()
  })

  it('lets the visitor skip the in-world question', async () => {
    render(<App />)
    await click('Begin')
    await click('Continue')
    await click('Skip')

    expect(await screen.findByRole('heading', { name: 'Who do you want to talk to?' })).toBeTruthy()
    expect(upsertUserPersona).not.toHaveBeenCalled()
  })

  it('keeps Shift+Enter as a newline instead of sending', async () => {
    await reachCharacterChoice()
    await click('Talk to Clara')
    const composer = await screen.findByLabelText('Your message')
    fireEvent.change(composer, { target: { value: 'Line one' } })

    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true })

    expect(sendMessageStream).not.toHaveBeenCalled()
  })

  it('shows the outro after leaving, and starting again opens a new session', async () => {
    await reachCharacterChoice()
    await click('Talk to Clara')
    await click('Leave the conversation')

    expect(await screen.findByText('The storm is passing.')).toBeTruthy()
    await click('Start again')

    expect(await screen.findByRole('heading', { name: 'Villa Miralac' })).toBeTruthy()
    expect(startSession).toHaveBeenCalledWith({ scenarioId: 'scenario_villa' })
  })
})

describe('character cards and switching', () => {
  it('shows the card hook and portrait placeholder from authored presentation', async () => {
    await reachCharacterChoice()

    expect(screen.getByText('The housekeeper who saw everything.')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Elias' }).textContent).toBe('E')
  })

  it('starts the conversation with a starter question as the first message', async () => {
    await reachCharacterChoice()

    await click('What did you see last night?')

    await waitFor(() => {
      expect(sendMessageStream).toHaveBeenCalledWith(
        'conversation_1',
        { message: { content: 'What did you see last night?' } },
        expect.anything(),
        expect.anything(),
      )
    })
    expect(startConversation).toHaveBeenCalledWith('session_1', { avatarId: 'avatar_clara' })
  })

  it('switches to another character through the switch route', async () => {
    vi.mocked(switchAvatar).mockResolvedValue({
      ...conversation,
      conversationId: 'conversation_2',
      avatarId: 'avatar_elias',
    })
    await reachCharacterChoice()
    await click('Talk to Clara')
    await screen.findByLabelText('Your message')

    await click('Talk to someone else')
    await click('Talk to Elias')

    await waitFor(() => {
      expect(switchAvatar).toHaveBeenCalledWith('session_1', { avatarId: 'avatar_elias' })
    })
    expect(await screen.findByRole('heading', { name: 'Elias' })).toBeTruthy()
  })
})

describe('staged runtime moments', () => {
  it('stages a suggestion as an in-world nudge and switches only when the visitor accepts', async () => {
    let onEvent: ((event: RuntimeEvent) => void) | undefined
    vi.mocked(subscribeToRuntimeEvents).mockImplementation((_, handlers) => {
      onEvent = handlers.onEvent
      return { close: vi.fn() }
    })
    vi.mocked(switchAvatar).mockResolvedValue({
      ...conversation,
      conversationId: 'conversation_2',
      avatarId: 'avatar_elias',
    })
    await reachCharacterChoice()
    await click('Talk to Clara')
    await screen.findByLabelText('Your message')

    const suggestion: RuntimeEvent = {
      eventId: 'event_suggest',
      sessionId: 'session_1',
      type: 'runtime.avatar_suggested',
      occurredAt: '2026-10-19T00:00:01.000Z',
      payload: { suggestedAvatarId: 'avatar_elias', reason: 'GM reasoning text' },
    }
    act(() => {
      onEvent?.(suggestion)
      onEvent?.(suggestion)
    })

    expect(await screen.findByText('Elias might have something to tell you.')).toBeTruthy()
    expect(screen.getAllByText('Elias might have something to tell you.')).toHaveLength(1)
    expect(document.body.textContent).not.toContain('GM reasoning text')
    expect(switchAvatar).not.toHaveBeenCalled()

    await click('Talk to Elias')

    await waitFor(() => {
      expect(switchAvatar).toHaveBeenCalledWith('session_1', { avatarId: 'avatar_elias' })
    })
    expect(await screen.findByRole('heading', { name: 'Elias' })).toBeTruthy()
  })
})

describe('guided player resume and failure', () => {
  it('brings a returning visitor back into their live conversation', async () => {
    window.localStorage.setItem(
      LOCAL_WEB_RUNTIME_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId: 'player_1',
        selectedScenarioId: 'scenario_villa',
        activeAvatarId: 'avatar_clara',
        conversationId: 'conversation_1',
        updatedAt: '2026-10-19T00:00:00.000Z',
      }),
    )
    vi.mocked(getConversationHistory).mockResolvedValue({
      conversation,
      messages: [
        {
          messageId: 'message_1',
          conversationId: 'conversation_1',
          role: 'avatar',
          content: 'Welcome back.',
          createdAt: '2026-10-19T00:00:00.000Z',
        },
      ],
    } as never)

    render(<App />)

    expect(await screen.findByText('Welcome back.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Clara' })).toBeTruthy()
  })

  it('returns to character choice when the remembered conversation cannot be reopened', async () => {
    window.localStorage.setItem(
      LOCAL_WEB_RUNTIME_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId: 'player_1',
        selectedScenarioId: 'scenario_villa',
        activeAvatarId: 'avatar_clara',
        conversationId: 'conversation_gone',
        updatedAt: '2026-10-19T00:00:00.000Z',
      }),
    )
    vi.mocked(getConversationHistory).mockRejectedValue(new Error('gone'))

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Who do you want to talk to?' })).toBeTruthy()
  })

  it('shows a retryable error when the experience cannot load', async () => {
    vi.mocked(listAvailableScenarios).mockRejectedValueOnce(new Error('offline'))

    render(<App />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    await click('Try again')
    expect(await screen.findByRole('heading', { name: 'Villa Miralac' })).toBeTruthy()
  })

  it('never shows technical wording to the visitor', async () => {
    await reachCharacterChoice()
    const text = document.body.textContent
    for (const term of ['identity', 'avatar', 'session', 'scenario', 'thread']) {
      expect(text.toLowerCase()).not.toContain(term)
    }
  })
})
