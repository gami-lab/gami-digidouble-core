import { describe, expect, it } from 'vitest'
import { createSpeechUtteranceFingerprint } from '../ports/IUtteranceIdempotencyStore.js'
import { normalizeSpeechToTextInput } from '../ports/ISpeechToTextAdapter.js'
import { InMemoryUtteranceIdempotencyStore } from './test-support/in-memory-utterance-idempotency.store.js'

const identity = { conversationId: 'conversation-1', utteranceId: 'utterance-1' }

describe('in-memory utterance idempotency contract', () => {
  it('fingerprints bounded audio and normalized metadata without retaining raw content', () => {
    const input = normalizeSpeechToTextInput({
      ...identity,
      audio: Uint8Array.from([1, 2, 3]),
      mediaType: 'audio/webm',
      language: 'en-US',
      durationMs: 1_000,
    })
    const sameInput = normalizeSpeechToTextInput({
      ...identity,
      audio: Uint8Array.from([1, 2, 3]),
      mediaType: 'AUDIO/WEBM',
      language: 'en-us',
      durationMs: 1_000,
    })
    const differentInput = normalizeSpeechToTextInput({
      ...identity,
      audio: Uint8Array.from([1, 2, 4]),
      mediaType: 'audio/webm',
      language: 'en-US',
      durationMs: 1_000,
    })

    const firstFingerprint = createSpeechUtteranceFingerprint(input)
    expect(firstFingerprint).toHaveLength(64)
    expect(createSpeechUtteranceFingerprint(sameInput)).toBe(firstFingerprint)
    expect(createSpeechUtteranceFingerprint(differentInput)).not.toBe(firstFingerprint)
    expect(input.audio).toEqual(Uint8Array.from([1, 2, 3]))
  })

  it('claims one utterance and reports an identical concurrent submission as in-flight', async () => {
    const store = new InMemoryUtteranceIdempotencyStore({ inFlightTtlMs: 100 })

    const first = await store.reserve(identity, 'fingerprint-a', 1_000)
    const duplicate = await store.reserve(identity, 'fingerprint-a', 1_001)

    expect(first).toEqual({
      status: 'claimed',
      reservationId: 'speech-reservation-1',
      expiresAt: 1_100,
    })
    expect(duplicate).toEqual({ status: 'in_flight' })
  })

  it('keeps a completed identity terminal so a replay cannot execute another turn', async () => {
    const store = new InMemoryUtteranceIdempotencyStore()
    const first = await store.reserve(identity, 'fingerprint-a', 1_000)

    if (first.status !== 'claimed') throw new Error('Expected an initial claim')
    await expect(store.complete(identity, first.reservationId)).resolves.toBe(true)
    await expect(store.reserve(identity, 'fingerprint-a', 1_001)).resolves.toEqual({
      status: 'completed',
    })
  })

  it('fails safe when an in-flight reservation expires', async () => {
    const store = new InMemoryUtteranceIdempotencyStore({ inFlightTtlMs: 100 })
    await store.reserve(identity, 'fingerprint-a', 1_000)

    await expect(store.reserve(identity, 'fingerprint-a', 1_100)).resolves.toEqual({
      status: 'expired',
    })
    await expect(store.reserve(identity, 'fingerprint-a', 2_000)).resolves.toEqual({
      status: 'expired',
    })
  })

  it('rejects a conflicting duplicate identity with a different fingerprint', async () => {
    const store = new InMemoryUtteranceIdempotencyStore()
    await store.reserve(identity, 'fingerprint-a', 1_000)

    await expect(store.reserve(identity, 'fingerprint-b', 1_001)).resolves.toEqual({
      status: 'conflict',
    })
  })

  it('allows a failed pre-turn reservation to be released and retried', async () => {
    const store = new InMemoryUtteranceIdempotencyStore()
    const first = await store.reserve(identity, 'fingerprint-a', 1_000)

    if (first.status !== 'claimed') throw new Error('Expected an initial claim')
    await expect(store.release(identity, first.reservationId)).resolves.toBe(true)
    await expect(store.reserve(identity, 'fingerprint-a', 1_001)).resolves.toMatchObject({
      status: 'claimed',
      reservationId: 'speech-reservation-2',
    })
  })
})
