import { describe, expect, it } from 'vitest'
import { assertTestDatabaseUrl } from './test-helpers.js'

describe('assertTestDatabaseUrl', () => {
  it('accepts a database whose name ends in _test', () => {
    expect(assertTestDatabaseUrl('postgresql://postgres:pw@localhost:5432/gami_core_test')).toBe(
      'gami_core_test',
    )
  })

  it.each([
    'postgresql://postgres:pw@localhost:5432/gami_core',
    'postgresql://postgres:pw@localhost:5432/test_gami_core',
    'postgresql://postgres:pw@localhost:5432/',
    'postgresql://postgres:pw@localhost:5432/evil_test";DROP',
  ])('refuses %s so integration cleanup can never wipe a real database', (url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow(/must name a database ending in "_test"/)
  })
})
