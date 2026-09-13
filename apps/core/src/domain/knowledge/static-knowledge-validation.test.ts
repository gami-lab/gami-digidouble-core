import { describe, expect, it } from 'vitest'
import {
  assertStaticMetadataAllowed,
  findReservedStaticScopeKeys,
} from './static-knowledge-validation.js'

describe('static knowledge metadata validation', () => {
  it('finds reserved scope keys recursively and in stable order', () => {
    expect(
      findReservedStaticScopeKeys({
        nested: [{ sessionId: 'session_1' }, { userId: 'user_1' }],
        conversationId: 'conversation_1',
      }),
    ).toEqual(['conversationId', 'sessionId', 'userId'])
  })

  it('rejects reserved scope keys with a safe validation message', () => {
    expect(() => {
      assertStaticMetadataAllowed({ nested: { userId: 'private-user' } }, 'source')
    }).toThrow('userId')
    expect(() => {
      assertStaticMetadataAllowed({ nested: { userId: 'private-user' } }, 'source')
    }).toThrowError(/cannot contain reserved scope keys/)
  })

  it('allows descriptive metadata without reserved scope keys', () => {
    expect(() => {
      assertStaticMetadataAllowed({ tags: ['lore'] }, 'chunk')
    }).not.toThrow()
  })
})
