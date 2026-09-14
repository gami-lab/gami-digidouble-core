import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultStorage, type StorageLike } from './storage'

describe('web storage boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the browser localStorage implementation', () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    }
    vi.stubGlobal('localStorage', storage)

    expect(getDefaultStorage()).toBe(storage)
  })

  it('fails clearly when browser storage is unavailable', () => {
    expect(() => getDefaultStorage()).toThrow('localStorage is not available in this environment')
  })
})
