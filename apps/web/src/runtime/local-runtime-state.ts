export const LOCAL_WEB_RUNTIME_STORAGE_KEY = 'gami.web.runtime.v1'

export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type LocalWebRuntimeState = {
  version: 1
  userId: string
  selectedScenarioId: string | null
  sessionId: string | null
  activeAvatarId: string | null
  conversationId: string | null
  updatedAt: string
}

export function persistLocalWebRuntimeState(
  state: LocalWebRuntimeState,
  storage: StorageLike = getDefaultStorage(),
): void {
  storage.setItem(LOCAL_WEB_RUNTIME_STORAGE_KEY, JSON.stringify(state))
}

export function readLocalWebRuntimeState(
  userId: string,
  storage: StorageLike = getDefaultStorage(),
): LocalWebRuntimeState | null {
  const raw = storage.getItem(LOCAL_WEB_RUNTIME_STORAGE_KEY)
  if (raw === null) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isLocalWebRuntimeState(parsed)) {
      return null
    }
    return parsed.userId === userId ? parsed : null
  } catch {
    return null
  }
}

export function clearLocalWebRuntimeState(storage: StorageLike = getDefaultStorage()): void {
  storage.removeItem(LOCAL_WEB_RUNTIME_STORAGE_KEY)
}

function isLocalWebRuntimeState(value: unknown): value is LocalWebRuntimeState {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    record['version'] === 1 &&
    typeof record['userId'] === 'string' &&
    isNullableString(record['selectedScenarioId']) &&
    isNullableString(record['sessionId']) &&
    isNullableString(record['activeAvatarId']) &&
    isNullableString(record['conversationId']) &&
    typeof record['updatedAt'] === 'string'
  )
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string'
}

function getDefaultStorage(): StorageLike {
  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this environment')
  }
  return globalThis.localStorage
}
