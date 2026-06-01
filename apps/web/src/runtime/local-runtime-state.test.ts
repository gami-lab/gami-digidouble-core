import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLocalWebRuntimeState,
  LOCAL_WEB_RUNTIME_STORAGE_KEY,
  persistLocalWebRuntimeState,
  readLocalWebRuntimeState,
  type StorageLike,
} from './local-runtime-state'

describe('local runtime state', () => {
  let storage: StorageLike

  beforeEach(() => {
    vi.restoreAllMocks()
    storage = createMemoryStorage()
  })

  it('persists and restores runtime state for the same user', () => {
    persistLocalWebRuntimeState(
      {
        version: 1,
        userId: 'user_12345678',
        selectedScenarioId: 'scenario_1',
        sessionId: 'session_1',
        activeAvatarId: 'avatar_1',
        conversationId: 'conversation_1',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
      storage,
    )

    expect(readLocalWebRuntimeState('user_12345678', storage)).toEqual({
      version: 1,
      userId: 'user_12345678',
      selectedScenarioId: 'scenario_1',
      sessionId: 'session_1',
      activeAvatarId: 'avatar_1',
      conversationId: 'conversation_1',
      updatedAt: '2026-06-01T10:00:00.000Z',
    })
  })

  it('returns null for invalid payload or different user', () => {
    storage.setItem(LOCAL_WEB_RUNTIME_STORAGE_KEY, '{bad json')
    expect(readLocalWebRuntimeState('user_12345678', storage)).toBeNull()

    storage.setItem(
      LOCAL_WEB_RUNTIME_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId: 'user_other',
        selectedScenarioId: null,
        sessionId: null,
        activeAvatarId: null,
        conversationId: null,
        updatedAt: '2026-06-01T10:00:00.000Z',
      }),
    )
    expect(readLocalWebRuntimeState('user_12345678', storage)).toBeNull()
  })

  it('clears persisted runtime state', () => {
    storage.setItem(LOCAL_WEB_RUNTIME_STORAGE_KEY, JSON.stringify({ any: 'value' }))
    clearLocalWebRuntimeState(storage)
    expect(storage.getItem(LOCAL_WEB_RUNTIME_STORAGE_KEY)).toBeNull()
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
