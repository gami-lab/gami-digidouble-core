import type { LocalWebIdentity, UserPersona } from '@gami/shared'

export const LOCAL_WEB_IDENTITY_STORAGE_KEY = 'gami.web.identity.v1'

export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type LocalIdentityFormValues = {
  name: string
  roleInWorld: string
  avatarRelationships: string
  dialogGuidance: string
}

export function createInitialIdentityFormValues(): LocalIdentityFormValues {
  return {
    name: '',
    roleInWorld: '',
    avatarRelationships: '',
    dialogGuidance: '',
  }
}

export function createGeneratedUserId(): string {
  if ('crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return `user_${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`
  }

  return `user_${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`
}

export function normalizePersonaInput(values: LocalIdentityFormValues): UserPersona {
  const name = toOptionalTrimmed(values.name)
  const roleInWorld = toOptionalTrimmed(values.roleInWorld)
  const dialogGuidance = toOptionalTrimmed(values.dialogGuidance)
  const avatarRelationships = splitRelationships(values.avatarRelationships)

  return {
    ...(name !== undefined ? { name } : {}),
    ...(roleInWorld !== undefined ? { roleInWorld } : {}),
    ...(avatarRelationships !== undefined ? { avatarRelationships } : {}),
    ...(dialogGuidance !== undefined ? { dialogGuidance } : {}),
  }
}

export function createLocalWebIdentity(
  formValues: LocalIdentityFormValues,
  nowIso: string,
  userId: string = createGeneratedUserId(),
): LocalWebIdentity {
  return {
    version: 1,
    userId,
    persona: normalizePersonaInput(formValues),
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

export function persistLocalWebIdentity(
  identity: LocalWebIdentity,
  storage: StorageLike = getDefaultStorage(),
): void {
  storage.setItem(LOCAL_WEB_IDENTITY_STORAGE_KEY, JSON.stringify(identity))
}

export function readLocalWebIdentity(
  storage: StorageLike = getDefaultStorage(),
): LocalWebIdentity | null {
  const raw = storage.getItem(LOCAL_WEB_IDENTITY_STORAGE_KEY)
  if (raw === null) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return isLocalWebIdentity(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearLocalWebIdentity(storage: StorageLike = getDefaultStorage()): void {
  storage.removeItem(LOCAL_WEB_IDENTITY_STORAGE_KEY)
}

function splitRelationships(value: string): string[] | undefined {
  const relationships = value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  return relationships.length > 0 ? relationships : undefined
}

function toOptionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function isLocalWebIdentity(value: unknown): value is LocalWebIdentity {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>

  if (record['version'] !== 1) {
    return false
  }

  if (typeof record['userId'] !== 'string' || record['userId'].trim().length === 0) {
    return false
  }

  if (typeof record['createdAt'] !== 'string' || typeof record['updatedAt'] !== 'string') {
    return false
  }

  if (!isUserPersona(record['persona'])) {
    return false
  }

  return true
}

function isUserPersona(value: unknown): value is UserPersona {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const persona = value as Record<string, unknown>

  if (
    !isOptionalString(persona['name']) ||
    !isOptionalString(persona['roleInWorld']) ||
    !isOptionalString(persona['dialogGuidance'])
  ) {
    return false
  }

  const relationships = persona['avatarRelationships']
  if (relationships !== undefined) {
    if (!Array.isArray(relationships)) {
      return false
    }
    if (!relationships.every((entry) => typeof entry === 'string')) {
      return false
    }
  }

  return true
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function getDefaultStorage(): StorageLike {
  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this environment')
  }
  return globalThis.localStorage
}
