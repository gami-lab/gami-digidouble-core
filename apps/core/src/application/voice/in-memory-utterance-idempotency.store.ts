import {
  createSpeechUtteranceIdentityKey,
  type IUtteranceIdempotencyStore,
  type SpeechUtteranceIdentity,
  type SpeechUtteranceReservation,
} from '../ports/IUtteranceIdempotencyStore.js'

type Entry = {
  fingerprint: string
  reservationId: string
  state: 'in_flight' | 'completed' | 'expired'
  expiresAt: number
}

export type InMemoryUtteranceIdempotencyStoreOptions = Readonly<{
  inFlightTtlMs?: number
  now?: () => number
}>

/** Process-local implementation for the initial single-process deployment. */
export class InMemoryUtteranceIdempotencyStore implements IUtteranceIdempotencyStore {
  private readonly entries = new Map<string, Entry>()
  private readonly inFlightTtlMs: number
  private readonly now: () => number
  private nextReservationId = 1

  constructor(options: InMemoryUtteranceIdempotencyStoreOptions = {}) {
    this.inFlightTtlMs = options.inFlightTtlMs ?? 30_000
    this.now = options.now ?? Date.now
  }

  reserve(
    identity: SpeechUtteranceIdentity,
    fingerprint: string,
    nowMs = this.now(),
  ): Promise<SpeechUtteranceReservation> {
    return Promise.resolve().then(() => {
      const key = createSpeechUtteranceIdentityKey(identity)
      const existing = this.entries.get(key)
      if (existing !== undefined) {
        if (existing.fingerprint !== fingerprint) return { status: 'conflict' }
        if (existing.state === 'completed') return { status: 'completed' }
        if (existing.state === 'expired' || nowMs >= existing.expiresAt) {
          existing.state = 'expired'
          return { status: 'expired' }
        }
        return { status: 'in_flight' }
      }

      const reservationId = `speech-reservation-${String(this.nextReservationId++)}`
      const expiresAt = nowMs + this.inFlightTtlMs
      this.entries.set(key, { fingerprint, reservationId, state: 'in_flight', expiresAt })
      return { status: 'claimed', reservationId, expiresAt }
    })
  }

  complete(identity: SpeechUtteranceIdentity, reservationId: string): Promise<boolean> {
    return Promise.resolve().then(() => {
      const entry = this.entries.get(createSpeechUtteranceIdentityKey(identity))
      if (
        entry === undefined ||
        entry.reservationId !== reservationId ||
        entry.state !== 'in_flight'
      ) {
        return false
      }
      entry.state = 'completed'
      return true
    })
  }

  release(identity: SpeechUtteranceIdentity, reservationId: string): Promise<boolean> {
    return Promise.resolve().then(() => {
      const key = createSpeechUtteranceIdentityKey(identity)
      const entry = this.entries.get(key)
      if (
        entry === undefined ||
        entry.reservationId !== reservationId ||
        entry.state !== 'in_flight'
      ) {
        return false
      }
      this.entries.delete(key)
      return true
    })
  }
}
