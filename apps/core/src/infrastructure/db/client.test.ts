import { afterEach, describe, expect, it } from 'vitest'
import { closeDbClient, getDbClient } from './client.js'

describe('getDbClient', () => {
  afterEach(async () => {
    await closeDbClient()
  })

  it('returns a client when called with a URL', () => {
    const client = getDbClient('postgres://localhost/test')
    expect(client).toBeDefined()
  })

  it('returns the same instance on repeated calls with the same URL', () => {
    const a = getDbClient('postgres://localhost/test')
    const b = getDbClient('postgres://localhost/test')
    expect(a).toBe(b)
  })

  it('throws when called with a different URL after initialization', () => {
    getDbClient('postgres://localhost/test')
    expect(() => getDbClient('postgres://localhost/other')).toThrow(
      'Database client already initialized with a different URL.',
    )
  })

  it('allows reinitialization after closeDbClient', async () => {
    getDbClient('postgres://localhost/test')
    await closeDbClient()
    expect(() => getDbClient('postgres://localhost/other')).not.toThrow()
  })
})
