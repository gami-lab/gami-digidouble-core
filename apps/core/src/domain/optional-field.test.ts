import { describe, expect, it } from 'vitest'
import { optionalField } from './optional-field.js'

describe('optionalField', () => {
  it('omits the key for null and undefined values', () => {
    expect(optionalField('name', null)).toEqual({})
    expect(optionalField('name', undefined)).toEqual({})
    expect('name' in optionalField('name', null)).toBe(false)
  })

  it('keeps falsy but present values', () => {
    expect(optionalField('count', 0)).toEqual({ count: 0 })
    expect(optionalField('label', '')).toEqual({ label: '' })
    expect(optionalField('enabled', false)).toEqual({ enabled: false })
  })

  it('maps a present value and skips the mapper otherwise', () => {
    const toId = (uuid: string) => `avatar_${uuid}`

    expect(optionalField('avatarId', 'abc', toId)).toEqual({ avatarId: 'avatar_abc' })
    expect(optionalField('avatarId', null, toId)).toEqual({})
  })
})
