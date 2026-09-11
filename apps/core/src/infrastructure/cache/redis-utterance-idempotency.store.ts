import crypto from 'node:crypto'
import {
  createSpeechUtteranceIdentityKey,
  type IUtteranceIdempotencyStore,
  type SpeechUtteranceIdentity,
  type SpeechUtteranceReservation,
} from '../../application/ports/IUtteranceIdempotencyStore.js'

type RedisStringStore = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode?: 'NX' | 'XX'): Promise<'OK' | null>
  del(key: string): Promise<number>
}

type StoredReservationState = 'in_flight' | 'completed' | 'expired'

type StoredReservation = {
  fingerprint: string
  reservationId: string
  state: StoredReservationState
  expiresAt: number
}

const DEFAULT_IN_FLIGHT_TTL_MS = 30_000

/**
 * Redis-backed utterance idempotency for multi-instance voice processing.
 *
 * Entries are stored as one JSON value per utterance identity. Completed and
 * expired records are retained until an explicit lifecycle policy is added.
 */
export class RedisUtteranceIdempotencyStore implements IUtteranceIdempotencyStore {
  constructor(
    private readonly redis: RedisStringStore,
    private readonly inFlightTtlMs = DEFAULT_IN_FLIGHT_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  async reserve(
    identity: SpeechUtteranceIdentity,
    fingerprint: string,
    nowMs = this.now(),
  ): Promise<SpeechUtteranceReservation> {
    const key = redisUtteranceKey(identity)

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await this.readEntry(key)
      if (existing !== null) {
        if (existing.fingerprint !== fingerprint) return { status: 'conflict' }
        if (existing.state === 'completed') return { status: 'completed' }
        if (existing.state === 'expired' || nowMs >= existing.expiresAt) {
          await this.writeEntry(key, { ...existing, state: 'expired' })
          return { status: 'expired' }
        }
        return { status: 'in_flight' }
      }

      const reservationId = `speech-reservation-${crypto.randomUUID()}`
      const expiresAt = nowMs + this.inFlightTtlMs
      const created = await this.redis.set(
        key,
        serializeEntry({ fingerprint, reservationId, state: 'in_flight', expiresAt }),
        'NX',
      )
      if (created === 'OK') {
        return { status: 'claimed', reservationId, expiresAt }
      }
    }

    return { status: 'in_flight' }
  }

  async complete(identity: SpeechUtteranceIdentity, reservationId: string): Promise<boolean> {
    const key = redisUtteranceKey(identity)
    const entry = await this.readEntry(key)
    if (entry === null || entry.reservationId !== reservationId || entry.state !== 'in_flight') {
      return false
    }

    const updated = await this.redis.set(
      key,
      serializeEntry({ ...entry, state: 'completed' }),
      'XX',
    )
    return updated === 'OK'
  }

  async release(identity: SpeechUtteranceIdentity, reservationId: string): Promise<boolean> {
    const key = redisUtteranceKey(identity)
    const entry = await this.readEntry(key)
    if (entry === null || entry.reservationId !== reservationId || entry.state !== 'in_flight') {
      return false
    }

    const deleted = await this.redis.del(key)
    return deleted === 1
  }

  private async readEntry(key: string): Promise<StoredReservation | null> {
    const raw = await this.redis.get(key)
    if (raw === null) return null

    const parsed = parseEntry(raw)
    if (parsed !== null) return parsed

    await this.redis.del(key)
    return null
  }

  private async writeEntry(key: string, entry: StoredReservation): Promise<void> {
    await this.redis.set(key, serializeEntry(entry))
  }
}

function redisUtteranceKey(identity: SpeechUtteranceIdentity): string {
  return `voice:utterance:${createSpeechUtteranceIdentityKey(identity)}`
}

function serializeEntry(entry: StoredReservation): string {
  return JSON.stringify(entry)
}

function parseEntry(raw: string): StoredReservation | null {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  if (typeof record['fingerprint'] !== 'string') return null
  if (typeof record['reservationId'] !== 'string') return null
  if (!isStoredState(record['state'])) return null
  if (typeof record['expiresAt'] !== 'number' || !Number.isFinite(record['expiresAt'])) {
    return null
  }

  return {
    fingerprint: record['fingerprint'],
    reservationId: record['reservationId'],
    state: record['state'],
    expiresAt: record['expiresAt'],
  }
}

function isStoredState(value: unknown): value is StoredReservationState {
  return value === 'in_flight' || value === 'completed' || value === 'expired'
}
