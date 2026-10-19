import { describe, expect, it } from 'vitest'
import { getConversationPresence, type PresenceInputs } from './conversation-presence'

const base: PresenceInputs = {
  hasConversation: true,
  conversationStatus: 'ready',
  sendStatus: 'idle',
  audioStatus: 'idle',
  voicePhase: 'off',
  watching: false,
}

describe('conversation presence', () => {
  it.each<[string, Partial<PresenceInputs>, string]>([
    ['no conversation yet', { hasConversation: false }, 'joining'],
    ['conversation starting', { conversationStatus: 'starting' }, 'joining'],
    ['reply audio loading', { audioStatus: 'loading', voicePhase: 'speaking' }, 'speaking'],
    ['reply audio playing', { audioStatus: 'playing' }, 'speaking'],
    ['reply streaming (text)', { sendStatus: 'streaming' }, 'thinking'],
    ['reply streaming (voice)', { sendStatus: 'streaming', voicePhase: 'waiting' }, 'thinking'],
    ['microphone listening', { voicePhase: 'listening' }, 'listening'],
    ['scenario media on screen', { watching: true, voicePhase: 'watching' }, 'watching'],
    ['idle text mode', {}, 'yourTurn'],
    ['audio finished', { audioStatus: 'stopped' }, 'yourTurn'],
    ['audio failed', { audioStatus: 'failed' }, 'yourTurn'],
  ])('%s → %s', (_label, overrides, expected) => {
    expect(getConversationPresence({ ...base, ...overrides })).toBe(expected)
  })
})
