import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalWebIdentity,
  createGeneratedUserId,
  createInitialIdentityFormValues,
  createLocalWebIdentity,
  LOCAL_WEB_IDENTITY_STORAGE_KEY,
  normalizePersonaInput,
  persistLocalWebIdentity,
  readLocalWebIdentity,
  type StorageLike,
} from './local-identity'

describe('local identity', () => {
  let storage: StorageLike

  beforeEach(() => {
    vi.restoreAllMocks()
    storage = createMemoryStorage()
  })

  it('builds identity with generated userId and normalized persona fields', () => {
    const form = {
      name: ' Nora ',
      roleInWorld: ' Investigator ',
      avatarRelationships: 'Clara, Thomas\n  Margot  ',
      dialogGuidance: ' Keep your answers concise. ',
    }

    const identity = createLocalWebIdentity(form, '2026-06-01T11:00:00.000Z', 'user_12345678')

    expect(identity).toEqual({
      version: 1,
      userId: 'user_12345678',
      persona: {
        name: 'Nora',
        roleInWorld: 'Investigator',
        avatarRelationships: ['Clara', 'Thomas', 'Margot'],
        dialogGuidance: 'Keep your answers concise.',
      },
      createdAt: '2026-06-01T11:00:00.000Z',
      updatedAt: '2026-06-01T11:00:00.000Z',
    })
  })

  it('persists and restores an identity payload', () => {
    const identity = createLocalWebIdentity(
      createInitialIdentityFormValues(),
      '2026-06-01T11:15:00.000Z',
      'user_alix0001',
    )

    persistLocalWebIdentity(identity, storage)

    expect(readLocalWebIdentity(storage)).toEqual(identity)
  })

  it('returns null when storage payload is invalid', () => {
    storage.setItem(LOCAL_WEB_IDENTITY_STORAGE_KEY, '{bad json')
    expect(readLocalWebIdentity(storage)).toBeNull()

    storage.setItem(
      LOCAL_WEB_IDENTITY_STORAGE_KEY,
      JSON.stringify({ version: 1, userId: '', persona: {}, createdAt: '', updatedAt: '' }),
    )
    expect(readLocalWebIdentity(storage)).toBeNull()
  })

  it('clears persisted identity', () => {
    storage.setItem(LOCAL_WEB_IDENTITY_STORAGE_KEY, JSON.stringify({ some: 'value' }))

    clearLocalWebIdentity(storage)

    expect(storage.getItem(LOCAL_WEB_IDENTITY_STORAGE_KEY)).toBeNull()
  })

  it('exposes stable helpers for generated userId and empty persona values', () => {
    expect(createGeneratedUserId()).toMatch(/^user_[a-f0-9]{8}$/)

    expect(
      normalizePersonaInput({
        ...createInitialIdentityFormValues(),
        name: ' ',
        roleInWorld: ' ',
        avatarRelationships: '  ',
        dialogGuidance: '  ',
      }),
    ).toEqual({})
  })
})

function createMemoryStorage(): StorageLike {
  const records = new Map<string, string>()
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => {
      records.set(key, value)
    },
    removeItem: (key) => {
      records.delete(key)
    },
  }
}
