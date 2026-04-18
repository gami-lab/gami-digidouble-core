import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from './avatar.fixtures.js'
import { assemblePersonaPrompt } from './persona-prompt.service.js'

describe('assemblePersonaPrompt -> personaPrompt included', () => {
  it('always includes personaPrompt in output', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are the scenario librarian. Never break role.',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain(config.personaPrompt)
  })
})

describe('assemblePersonaPrompt -> name included', () => {
  it('includes name when provided and not already present in personaPrompt', () => {
    const config = makeAvatarConfig({
      name: 'Nova',
      personaPrompt: 'You are a futuristic museum guide.',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('Your name is Nova.')
  })
})

describe('assemblePersonaPrompt -> tone included', () => {
  it('includes tone when provided and places it after the persona section', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a focused guide.',
      tone: 'calm and precise',
    })

    const prompt = assemblePersonaPrompt(config)
    const personaIndex = prompt.indexOf('You are a focused guide.')
    const toneIndex = prompt.indexOf('Your tone is calm and precise.')

    expect(prompt).toContain('Your tone is calm and precise.')
    expect(personaIndex).toBeGreaterThanOrEqual(0)
    expect(toneIndex).toBeGreaterThan(personaIndex)
  })
})

describe('assemblePersonaPrompt -> empty personaPrompt', () => {
  it('throws when personaPrompt is empty', () => {
    const config = makeAvatarConfig({ personaPrompt: '   ' })

    expect(() => assemblePersonaPrompt(config)).toThrow(
      'Avatar personaPrompt must be a non-empty string.',
    )
  })
})

describe('assemblePersonaPrompt -> determinism', () => {
  it('returns exactly the same output across repeated calls with same input', () => {
    const config = makeAvatarConfig({
      config: {
        personaAdjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
      },
    })

    const first = assemblePersonaPrompt(config)
    const second = assemblePersonaPrompt(config)
    const third = assemblePersonaPrompt(config)

    expect(first).toBe(second)
    expect(second).toBe(third)
  })
})
