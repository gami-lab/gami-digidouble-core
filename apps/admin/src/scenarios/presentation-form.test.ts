import { describe, expect, it } from 'vitest'
import {
  moveItem,
  toAvatarPresentationPayload,
  toScenarioPresentationPayload,
} from './presentation-form'

describe('presentation form payloads', () => {
  it('trims scenario text and drops blank fields and an empty entry question', () => {
    expect(
      toScenarioPresentationPayload({
        tagline: '  A night  ',
        introText: '   ',
        entryQuestion: { prompt: ' ', personaField: 'name' },
      }),
    ).toEqual({ tagline: 'A night' })
  })

  it('returns null when every field is blank so an update clears presentation', () => {
    expect(toScenarioPresentationPayload({ cover: '', outroText: ' ' })).toBeNull()
    expect(toAvatarPresentationPayload({ hook: '', starterQuestions: ['', ' '] })).toBeNull()
  })

  it('keeps non-blank starter questions in order', () => {
    expect(
      toAvatarPresentationPayload({ hook: 'Hook', starterQuestions: [' First ', '', 'Second'] }),
    ).toEqual({ hook: 'Hook', starterQuestions: ['First', 'Second'] })
  })

  it('moves an item up or down and ignores moves past the edges', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})
