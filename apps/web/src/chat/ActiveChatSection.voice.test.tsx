// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ConversationSummary } from '@gami/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n/index'
import { useVoiceConversation, type VoiceConversationState } from '../voice/use-voice-conversation'
import { ActiveChatSection } from './ActiveChatSection'
import type { ActiveChatRuntimeState } from './use-active-chat-runtime'

vi.mock('../voice/use-voice-conversation', () => ({ useVoiceConversation: vi.fn() }))

const conversation: ConversationSummary = {
  conversationId: 'conversation_1',
  sessionId: 'session_1',
  avatarId: 'avatar_1',
  status: 'active',
  startedAt: '2026-06-01T00:00:00.000Z',
  lastActivityAt: '2026-06-01T00:00:00.000Z',
}

function createChat(composerValue = ''): ActiveChatRuntimeState {
  return {
    activeAvatarId: 'avatar_1',
    conversation,
    conversationStatus: 'ready',
    conversationError: null,
    messages: [],
    avatarDraft: null,
    composerValue,
    sendStatus: 'idle',
    sendError: null,
    audio: { messageId: null, status: 'idle', errorCode: null },
    canSend: true,
    canEndConversation: true,
    setComposerValue: vi.fn(),
    startChatWithAvatar: vi.fn(),
    sendCurrentMessage: vi.fn(),
    sendVoiceMessage: vi.fn(),
    endCurrentConversation: vi.fn(),
    playMessageAudio: vi.fn(),
    stopMessageAudio: vi.fn(),
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

describe('ActiveChatSection voice controls', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('starts and stops the voice conversation from the Talk button', () => {
    const voice = mockVoice()
    const { rerender } = render(<ActiveChatSection avatars={[]} chat={createChat()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Talk' }))
    expect(voice.start).toHaveBeenCalledTimes(1)

    const listening = mockVoice({ enabled: true, phase: 'listening' })
    rerender(<ActiveChatSection avatars={[]} chat={createChat()} />)
    expect(screen.getByRole('status').textContent).toBe(i18n.t('chat.voice.listening'))
    fireEvent.click(screen.getByRole('button', { name: 'Stop talking', pressed: true }))
    expect(listening.stop).toHaveBeenCalledTimes(1)
  })

  it.each<[Partial<VoiceConversationState>, string]>([
    [{ phase: 'off' }, 'chat.voice.starting'],
    [{ phase: 'listening', hearing: true }, 'chat.voice.hearing'],
    [{ phase: 'waiting' }, 'chat.voice.waiting'],
    [{ phase: 'speaking' }, 'chat.voice.speaking'],
    [{ error: 'permission-denied' }, 'chat.voice.permissionDenied'],
    [{ error: 'unsupported' }, 'chat.voice.unsupported'],
  ])('shows the voice status for %o', (state, key) => {
    mockVoice({ enabled: state.error === undefined, ...state })
    render(<ActiveChatSection avatars={[]} chat={createChat()} />)

    expect(screen.getByRole('status').textContent).toBe(i18n.t(key))
  })

  it('sends the current speech with Send when nothing is typed', () => {
    const voice = mockVoice({ enabled: true, phase: 'listening', hearing: true })
    vi.mocked(voice.submitNow).mockReturnValue(true)
    const chat = createChat()
    render(<ActiveChatSection avatars={[]} chat={chat} />)

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(voice.submitNow).toHaveBeenCalledTimes(1)
    expect(chat.sendCurrentMessage).not.toHaveBeenCalled()
  })

  it('sends typed text even while voice is listening', () => {
    const voice = mockVoice({ enabled: true, phase: 'listening', hearing: true })
    const chat = createChat('Typed instead')
    render(<ActiveChatSection avatars={[]} chat={chat} />)

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(voice.submitNow).not.toHaveBeenCalled()
    expect(chat.sendCurrentMessage).toHaveBeenCalledTimes(1)
  })

  it('stops the voice loop when the conversation ends', () => {
    const voice = mockVoice({ enabled: true, phase: 'listening' })
    render(<ActiveChatSection avatars={[]} chat={{ ...createChat(), conversation: null }} />)

    expect(voice.stop).toHaveBeenCalledTimes(1)
  })
})
