import { describe, expect, it } from 'vitest'
import {
  PRESENTATION_LIMITS,
  isAvatarPresentation,
  isScenarioPresentation,
} from './presentation-contract-types.js'

describe('presentation contract guards', () => {
  it('accepts a complete scenario presentation', () => {
    expect(
      isScenarioPresentation({
        cover: 'media_cover-1',
        tagline: 'A night at the museum',
        introText: 'The doors close behind you.',
        introMedia: 'media_intro-1',
        entryQuestion: { prompt: 'Who are you?', personaField: 'name' },
        outroText: 'Thank you for visiting.',
        outroMedia: 'media_outro-1',
      }),
    ).toBe(true)
    expect(isScenarioPresentation({})).toBe(true)
  })

  it('rejects unknown keys, URLs instead of media refs, empty text, and admin-only persona fields', () => {
    expect(isScenarioPresentation({ accentColor: '#fff' })).toBe(false)
    expect(isScenarioPresentation({ cover: 'https://cdn.example.com/cover.jpg' })).toBe(false)
    expect(isScenarioPresentation({ introMedia: 'javascript:alert(1)' })).toBe(false)
    expect(isScenarioPresentation({ tagline: '  ' })).toBe(false)
    expect(
      isScenarioPresentation({ entryQuestion: { prompt: 'Why?', personaField: 'dialogGuidance' } }),
    ).toBe(false)
    expect(
      isScenarioPresentation({ tagline: 'x'.repeat(PRESENTATION_LIMITS.taglineMaxLength + 1) }),
    ).toBe(false)
  })

  it('limits avatar starter questions to three non-empty questions', () => {
    expect(
      isAvatarPresentation({
        portrait: 'media_ava-portrait',
        idleLoop: 'media_ava-idle',
        hook: 'Knows every secret of the house',
        starterQuestions: ['Who are you?', 'What happened here?', 'Can I help?'],
      }),
    ).toBe(true)
    expect(isAvatarPresentation({ starterQuestions: ['a', 'b', 'c', 'd'] })).toBe(false)
    expect(isAvatarPresentation({ starterQuestions: [''] })).toBe(false)
    expect(isAvatarPresentation({ portrait: 'ava.png' })).toBe(false)
    expect(isAvatarPresentation({ idleLoop: 'https://cdn.example.com/idle.mp4' })).toBe(false)
    expect(isAvatarPresentation({ accentColor: '#6C5CE7' })).toBe(false)
  })
})
