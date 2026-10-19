// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ConversationSummary } from '@gami/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n/index'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import { useVoiceConversation, type VoiceConversationState } from '../voice/use-voice-conversation'
import { ConversationScreen } from './ConversationScreen'

vi.mock('../voice/use-voice-conversation', () => ({ useVoiceConversation: vi.fn() }))

const conversation: ConversationSummary = {
  conversationId: 'conversation_1',
  sessionId: 'session_1',
  avatarId: 'avatar_1',
  status: 'active',
  startedAt: '2026-06-01T00:00:00.000Z',
  lastActivityAt: '2026-06-01T00:00:00.000Z',
}

const clara = { name: 'Clara', presentation: { portrait: 'https://cdn.example.com/clara.png' } }

function createChat(overrides: Partial<ActiveChatRuntimeState> = {}): ActiveChatRuntimeState {
  return {
    activeAvatarId: 'avatar_1',
    conversation,
    conversationStatus: 'ready',
    conversationError: null,
    messages: [
      { localId: 'm1', role: 'user', content: 'Hello', createdAt: conversation.startedAt },
      { localId: 'm2', role: 'avatar', content: 'Welcome in.', createdAt: conversation.startedAt },
    ],
    avatarDraft: null,
    composerValue: '',
    sendStatus: 'idle',
    sendError: null,
    audio: { messageId: null, status: 'idle', errorCode: null },
    canSend: true,
    canEndConversation: true,
    setComposerValue: vi.fn(),
    startChatWithAvatar: vi.fn(),
    sendCurrentMessage: vi.fn(),
    sendMessage: vi.fn(),
    sendVoiceMessage: vi.fn(),
    endCurrentConversation: vi.fn(),
    playMessageAudio: vi.fn(),
    stopMessageAudio: vi.fn(),
    ...overrides,
  }
}

function mockVoice(overrides: Partial<VoiceConversationState> = {}): VoiceConversationState {
  const voice: VoiceConversationState = {
    supported: true,
    enabled: false,
    phase: 'off',
    hearing: false,
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
    submitNow: vi.fn().mockReturnValue(false),
    ...overrides,
  }
  vi.mocked(useVoiceConversation).mockReturnValue(voice)
  return voice
}

function renderScreen(chat = createChat(), onSwitch = vi.fn()): void {
  render(<ConversationScreen avatar={clara} chat={chat} onSwitch={onSwitch} notice={null} />)
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('voice-first conversation screen', () => {
  it('anchors on the portrait and makes the mic the primary control', () => {
    const voice = mockVoice()
    renderScreen()

    expect(screen.getByRole('img', { name: 'Clara' }).getAttribute('src')).toBe(
      'https://cdn.example.com/clara.png',
    )
    const mic = screen.getByRole('button', { name: 'Talk', pressed: false })
    fireEvent.click(mic)
    expect(voice.start).toHaveBeenCalledTimes(1)
  })

  it('announces listening, thinking, and speaking in one polite status', () => {
    mockVoice({ enabled: true, phase: 'listening' })
    const { rerender } = render(
      <ConversationScreen avatar={clara} chat={createChat()} onSwitch={vi.fn()} notice={null} />,
    )
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('Listening…')

    mockVoice({ enabled: true, phase: 'waiting' })
    rerender(
      <ConversationScreen
        avatar={clara}
        chat={createChat({ sendStatus: 'streaming' })}
        onSwitch={vi.fn()}
        notice={null}
      />,
    )
    expect(screen.getByRole('status').textContent).toBe('Thinking…')

    mockVoice({ enabled: true, phase: 'speaking' })
    const speaking = createChat({ audio: { messageId: 'm2', status: 'playing', errorCode: null } })
    rerender(<ConversationScreen avatar={clara} chat={speaking} onSwitch={vi.fn()} notice={null} />)
    expect(screen.getByRole('status').textContent).toBe('Speaking…')
  })

  it('stops the voice loop from the pressed mic button', () => {
    const voice = mockVoice({ enabled: true, phase: 'listening' })
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Stop talking', pressed: true }))

    expect(voice.stop).toHaveBeenCalledTimes(1)
  })

  it('hides the transcript by default, shows the latest reply, and toggles the transcript', () => {
    mockVoice()
    renderScreen()

    expect(screen.queryByText('Hello')).toBeNull()
    expect(screen.getByText('Welcome in.')).toBeTruthy()

    const toggle = screen.getByRole('button', { name: 'Show the conversation' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)

    expect(screen.getByText('Hello')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide the conversation' })).toBeTruthy()
  })
})

describe('conversation fallbacks and actions', () => {
  it.each<[Partial<VoiceConversationState>, string]>([
    [{ error: 'permission-denied' }, 'chat.voice.permissionDenied'],
    [{ error: 'failed' }, 'chat.voice.failed'],
  ])('falls back to text with an explanation when the mic fails (%o)', (state, key) => {
    mockVoice(state)
    renderScreen()

    expect(screen.getByRole('alert').textContent).toBe(i18n.t(key))
    expect(screen.queryByRole('button', { name: 'Talk' })).toBeNull()
    expect(screen.getByLabelText('Your message')).toBeTruthy()
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  it('offers text only when the browser cannot record', () => {
    mockVoice({ supported: false })
    renderScreen()

    expect(screen.getByText(i18n.t('chat.voice.unsupported'))).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Talk' })).toBeNull()
  })

  it('sends the current speech with Send when nothing is typed', () => {
    const voice = mockVoice({ enabled: true, phase: 'listening', hearing: true })
    vi.mocked(voice.submitNow).mockReturnValue(true)
    const chat = createChat()
    renderScreen(chat)

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(voice.submitNow).toHaveBeenCalledTimes(1)
    expect(chat.sendCurrentMessage).not.toHaveBeenCalled()
  })

  it('sends typed text even while voice is listening', () => {
    const voice = mockVoice({ enabled: true, phase: 'listening', hearing: true })
    const chat = createChat({ composerValue: 'Typed instead' })
    renderScreen(chat)

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(voice.submitNow).not.toHaveBeenCalled()
    expect(chat.sendCurrentMessage).toHaveBeenCalledTimes(1)
  })

  it('switches character and leaves the conversation', () => {
    mockVoice()
    const chat = createChat()
    const onSwitch = vi.fn()
    renderScreen(chat, onSwitch)

    fireEvent.click(screen.getByRole('button', { name: 'Talk to someone else' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave the conversation' }))

    expect(onSwitch).toHaveBeenCalledTimes(1)
    expect(chat.endCurrentConversation).toHaveBeenCalledTimes(1)
  })

  it('stops the voice loop when the conversation ends', () => {
    const voice = mockVoice({ enabled: true, phase: 'listening' })
    renderScreen(createChat({ conversation: null }))

    expect(voice.stop).toHaveBeenCalledTimes(1)
  })

  it('shows an initial when no portrait is authored', () => {
    mockVoice()
    render(
      <ConversationScreen
        avatar={{ name: 'margot' }}
        chat={createChat()}
        onSwitch={vi.fn()}
        notice={null}
      />,
    )

    expect(screen.getByRole('img', { name: 'margot' }).textContent).toBe('M')
  })
})

describe('idle hint', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const withQuestions = {
    name: 'Clara',
    presentation: { starterQuestions: ['Hello', 'What did you see?'] },
  }

  it('offers an unused starter question after the visitor stays silent', () => {
    vi.useFakeTimers()
    mockVoice()
    const chat = createChat()
    render(
      <ConversationScreen avatar={withQuestions} chat={chat} onSwitch={vi.fn()} notice={null} />,
    )
    expect(screen.queryByText('Not sure what to say?')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ask: “What did you see?”' }))
    expect(chat.sendMessage).toHaveBeenCalledWith('What did you see?')
  })

  it('does not appear while the character is speaking or a moment is shown', () => {
    vi.useFakeTimers()
    mockVoice()
    const speaking = createChat({ audio: { messageId: 'm2', status: 'playing', errorCode: null } })
    const { rerender } = render(
      <ConversationScreen
        avatar={withQuestions}
        chat={speaking}
        onSwitch={vi.fn()}
        notice={null}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.queryByText('Not sure what to say?')).toBeNull()

    rerender(
      <ConversationScreen
        avatar={withQuestions}
        chat={createChat()}
        onSwitch={vi.fn()}
        notice={<p>moment</p>}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.queryByText('Not sure what to say?')).toBeNull()
  })

  it('disappears on visitor input', () => {
    vi.useFakeTimers()
    mockVoice()
    const { rerender } = render(
      <ConversationScreen
        avatar={withQuestions}
        chat={createChat()}
        onSwitch={vi.fn()}
        notice={null}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(20_000)
    })
    expect(screen.getByText('Not sure what to say?')).toBeTruthy()

    rerender(
      <ConversationScreen
        avatar={withQuestions}
        chat={createChat({ composerValue: 'W' })}
        onSwitch={vi.fn()}
        notice={null}
      />,
    )
    expect(screen.queryByText('Not sure what to say?')).toBeNull()
  })
})
