import type { ConversationStatus, SendStatus } from '../chat/chat-thread-state'
import type { AudioPlaybackStatus } from '../chat/use-message-audio-playback'
import type { VoiceLoopPhase } from '../voice/voice-loop'

/** The one state the conversation screen shows for the character. */
export type ConversationPresence = 'joining' | 'listening' | 'thinking' | 'speaking' | 'yourTurn'

export type PresenceInputs = {
  hasConversation: boolean
  conversationStatus: ConversationStatus
  sendStatus: SendStatus
  audioStatus: AudioPlaybackStatus
  voicePhase: VoiceLoopPhase
}

export function getConversationPresence(inputs: PresenceInputs): ConversationPresence {
  if (!inputs.hasConversation || inputs.conversationStatus === 'starting') return 'joining'
  if (inputs.audioStatus === 'loading' || inputs.audioStatus === 'playing') return 'speaking'
  if (inputs.sendStatus === 'streaming') return 'thinking'
  if (inputs.voicePhase === 'listening') return 'listening'
  return 'yourTurn'
}
