import type { SendStatus } from '../chat/chat-thread-state'
import type { AudioPlaybackStatus } from '../chat/use-message-audio-playback'

export type VoiceLoopPhase = 'off' | 'listening' | 'waiting' | 'speaking' | 'watching'

/**
 * Where the hands-free loop is. The microphone records only while `listening`, so it never
 * captures the avatar's own reply or the sound of scenario media.
 */
export function getVoiceLoopPhase(
  enabled: boolean,
  sendStatus: SendStatus,
  audioStatus: AudioPlaybackStatus,
  watching: boolean,
): VoiceLoopPhase {
  if (!enabled) return 'off'
  if (watching) return 'watching'
  if (sendStatus === 'streaming') return 'waiting'
  if (audioStatus === 'loading' || audioStatus === 'playing') return 'speaking'
  return 'listening'
}
