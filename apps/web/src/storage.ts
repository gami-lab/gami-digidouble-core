export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export function getDefaultStorage(): StorageLike {
  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this environment')
  }
  return globalThis.localStorage
}
