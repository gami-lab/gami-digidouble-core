import { describe, expect, it } from 'vitest'
import {
  applyMediaTriggersMutation,
  mediaTriggerReferences,
  readMediaTriggers,
} from './avatar-media-triggers.js'

describe('avatar media triggers config mapping', () => {
  it('stores triggers under mediaTriggers, keeps them when omitted, and clears them with null', () => {
    const stored = applyMediaTriggersMutation(
      undefined,
      { scope: 'x' },
      {},
      { onUnlock: 'media_a' },
    )
    expect(stored).toEqual({ scope: 'x', mediaTriggers: { onUnlock: 'media_a' } })
    expect(readMediaTriggers(stored)).toEqual({ onUnlock: 'media_a' })

    expect(applyMediaTriggersMutation({ scope: 'y' }, { scope: 'y' }, stored, undefined)).toEqual({
      scope: 'y',
      mediaTriggers: { onUnlock: 'media_a' },
    })
    expect(applyMediaTriggersMutation(undefined, stored, stored, null)).toEqual({ scope: 'x' })
  })

  it('rejects triggers inside config and malformed triggers', () => {
    expect(() => applyMediaTriggersMutation({ mediaTriggers: {} }, {}, {}, undefined)).toThrow(
      'top-level',
    )
    expect(() => applyMediaTriggersMutation(undefined, {}, {}, { onLeave: 'media_a' })).toThrow(
      'not a valid trigger set',
    )
  })

  it('lists referenced assets per trigger', () => {
    expect(mediaTriggerReferences({ onSwitchTo: 'media_cut' })).toEqual([
      { slot: 'onSwitchTo', assetId: 'media_cut', allowedKinds: ['image', 'video'] },
    ])
    expect(mediaTriggerReferences(undefined)).toEqual([])
  })
})
