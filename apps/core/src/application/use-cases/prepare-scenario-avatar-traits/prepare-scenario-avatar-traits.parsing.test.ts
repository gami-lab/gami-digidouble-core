import { describe, expect, it } from 'vitest'
import {
  normalizeComputedTraits,
  parseTraitPreparationOutput,
} from './prepare-scenario-avatar-traits.parsing.js'

const emptyTraits = {
  identity: [],
  personality: [],
  speakingStyle: [],
  background: [],
  timeline: [],
  currentSituation: [],
  behaviouralRules: [],
}

describe('parseTraitPreparationOutput', () => {
  it('parses a valid JSON object with all seven fields', () => {
    const result = parseTraitPreparationOutput(
      JSON.stringify({
        identity: ['A guide'],
        personality: ['Curious'],
        speakingStyle: ['Short sentences'],
        background: ['Former teacher'],
        timeline: ['Joined at story start'],
        currentSituation: ['Welcoming visitors'],
        behaviouralRules: ['No spoilers'],
      }),
    )

    expect(result).toEqual({
      identity: ['A guide'],
      personality: ['Curious'],
      speakingStyle: ['Short sentences'],
      background: ['Former teacher'],
      timeline: ['Joined at story start'],
      currentSituation: ['Welcoming visitors'],
      behaviouralRules: ['No spoilers'],
    })
  })

  it('strips markdown code fences before parsing', () => {
    const result = parseTraitPreparationOutput(
      '```json\n' + JSON.stringify({ identity: ['Fenced'] }) + '\n```',
    )

    expect(result?.identity).toEqual(['Fenced'])
  })

  it('returns null for unparseable content', () => {
    expect(parseTraitPreparationOutput('not json at all')).toBeNull()
  })

  it('returns null when the JSON is not an object', () => {
    expect(parseTraitPreparationOutput('[1, 2, 3]')).toBeNull()
    expect(parseTraitPreparationOutput('"a string"')).toBeNull()
  })

  it('defaults missing fields to an empty array rather than failing', () => {
    const result = parseTraitPreparationOutput(JSON.stringify({ identity: ['Only this'] }))

    expect(result).toEqual({ ...emptyTraits, identity: ['Only this'] })
  })

  it('drops fields the model invents beyond the fixed seven', () => {
    const result = parseTraitPreparationOutput(
      JSON.stringify({ identity: ['A guide'], extraField: ['Should be dropped'] }),
    )

    expect(result).toEqual({ ...emptyTraits, identity: ['A guide'] })
    expect(result).not.toHaveProperty('extraField')
  })

  it('filters out non-string items within a field array', () => {
    const result = parseTraitPreparationOutput(
      JSON.stringify({ identity: ['Valid', 42, null, { nested: true }, 'Also valid'] }),
    )

    expect(result?.identity).toEqual(['Valid', 'Also valid'])
  })

  it('defaults a field to empty when its value is not an array', () => {
    const result = parseTraitPreparationOutput(JSON.stringify({ identity: 'not an array' }))

    expect(result?.identity).toEqual([])
  })
})

describe('normalizeComputedTraits', () => {
  it('trims whitespace from every item', () => {
    const result = normalizeComputedTraits({
      ...emptyTraits,
      identity: ['  Padded  ', 'Clean'],
    })

    expect(result.identity).toEqual(['Padded', 'Clean'])
  })

  it('drops empty strings after trimming', () => {
    const result = normalizeComputedTraits({
      ...emptyTraits,
      personality: ['Curious', '   ', ''],
    })

    expect(result.personality).toEqual(['Curious'])
  })

  it('deduplicates exact repeats after trimming', () => {
    const result = normalizeComputedTraits({
      ...emptyTraits,
      background: ['Former teacher', 'Former teacher', '  Former teacher  '],
    })

    expect(result.background).toEqual(['Former teacher'])
  })

  it('caps each field at 7 items', () => {
    const result = normalizeComputedTraits({
      ...emptyTraits,
      behaviouralRules: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
    })

    expect(result.behaviouralRules).toHaveLength(7)
    expect(result.behaviouralRules).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  })

  it('normalizes all seven fields independently', () => {
    const result = normalizeComputedTraits({
      identity: ['  Id  '],
      personality: ['Pers'],
      speakingStyle: ['Style', 'Style'],
      background: [],
      timeline: ['T1', 'T2'],
      currentSituation: [''],
      behaviouralRules: ['Rule'],
    })

    expect(result).toEqual({
      identity: ['Id'],
      personality: ['Pers'],
      speakingStyle: ['Style'],
      background: [],
      timeline: ['T1', 'T2'],
      currentSituation: [],
      behaviouralRules: ['Rule'],
    })
  })
})
