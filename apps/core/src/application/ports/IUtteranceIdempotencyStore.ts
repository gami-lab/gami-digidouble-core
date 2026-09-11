import { createHash } from 'node:crypto'
import type { SpeechToTextInput } from '../voice/speech-to-text.contracts.js'

export type SpeechUtteranceIdentity = Readonly<{
  conversationId: string
  utteranceId: string
}>

export type SpeechUtteranceReservation =
  | Readonly<{
      status: 'claimed'
      reservationId: string
      expiresAt: number
    }>
  | Readonly<{
      status: 'in_flight'
    }>
  | Readonly<{
      status: 'completed'
    }>
  | Readonly<{
      status: 'expired'
    }>
  | Readonly<{
      status: 'conflict'
    }>

/**
 * Application boundary for at-most-once voice-turn execution.
 *
 * `fingerprint` is computed from the normalized bounded request, never from a
 * provider payload. A completed record is retained by implementations until
 * their configured idempotency retention policy says otherwise; this initial
 * contract intentionally does not permit automatic reuse after expiry.
 */
export interface IUtteranceIdempotencyStore {
  reserve(
    identity: SpeechUtteranceIdentity,
    fingerprint: string,
    nowMs?: number,
  ): Promise<SpeechUtteranceReservation>
  complete(identity: SpeechUtteranceIdentity, reservationId: string): Promise<boolean>
  release(identity: SpeechUtteranceIdentity, reservationId: string): Promise<boolean>
}

/** Stable opaque identity key; JSON avoids delimiter collisions between IDs. */
export function createSpeechUtteranceIdentityKey(identity: SpeechUtteranceIdentity): string {
  return JSON.stringify([identity.conversationId, identity.utteranceId])
}

/**
 * A deterministic request fingerprint for duplicate/conflict detection.
 * The digest is safe to retain; raw audio and transcript text are not.
 */
export function createSpeechUtteranceFingerprint(input: SpeechToTextInput): string {
  return createHash('sha256')
    .update(input.audio)
    .update('\0')
    .update(JSON.stringify([input.mediaType, input.language ?? null, input.durationMs ?? null]))
    .digest('hex')
}
