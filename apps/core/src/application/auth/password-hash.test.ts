import { describe, expect, it } from 'vitest'
import { hashPassword, isPasswordHash, verifyPassword } from './password-hash.js'

describe('admin password hashing', () => {
  it('verifies the original password and rejects any other', async () => {
    const hash = await hashPassword('correct horse battery')

    expect(isPasswordHash(hash)).toBe(true)
    expect(hash).not.toContain('correct horse battery')
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true)
    await expect(verifyPassword('correct horse battery!', hash)).resolves.toBe(false)
  })

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'))
  })

  it.each(['', 'plain-text', 'scrypt:abc', 'bcrypt:abc:def', 'scrypt:YWJj:ZGVm:extra'])(
    'rejects the malformed stored hash %j',
    async (stored) => {
      expect(isPasswordHash(stored)).toBe(false)
      await expect(verifyPassword('anything', stored)).resolves.toBe(false)
    },
  )
})
