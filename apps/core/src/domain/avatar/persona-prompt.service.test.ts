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

describe('assemblePersonaPrompt -> adjustments included', () => {
  it('appends non-empty adjustments after tone and before the style rule', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a focused guide.',
      tone: 'precise',
      adjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
    })

    const prompt = assemblePersonaPrompt(config)
    const toneIndex = prompt.indexOf('Your tone is precise.')
    const firstAdjIndex = prompt.indexOf('Avoid markdown tables.')
    const secondAdjIndex = prompt.indexOf('Use short paragraphs.')
    const styleRuleIndex = prompt.indexOf('Stay in character')

    expect(prompt).toContain('Avoid markdown tables.')
    expect(prompt).toContain('Use short paragraphs.')
    expect(firstAdjIndex).toBeGreaterThan(toneIndex)
    expect(secondAdjIndex).toBeGreaterThan(firstAdjIndex)
    expect(styleRuleIndex).toBeGreaterThan(secondAdjIndex)
  })

  it('omits adjustments section when adjustments is undefined', () => {
    const config = makeAvatarConfig({
      name: 'Cosmos',
      personaPrompt: 'You are a helpful guide.',
    })

    const prompt = assemblePersonaPrompt(config)
    const lines = prompt.split('\n\n')

    // personaPrompt + name + tone + DEFAULT_STYLE_RULE — no adjustment lines
    expect(lines).toHaveLength(4)
  })

  it('skips blank or whitespace-only adjustments', () => {
    const config = makeAvatarConfig({ adjustments: ['', '  ', 'Keep it brief.'] })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('Keep it brief.')
    // blank items do not produce empty sections
    expect(prompt).not.toMatch(/\n\n\n/)
  })
})

describe('assemblePersonaPrompt -> determinism', () => {
  it('returns exactly the same output across repeated calls with same input', () => {
    const config = makeAvatarConfig({
      adjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
    })

    const first = assemblePersonaPrompt(config)
    const second = assemblePersonaPrompt(config)
    const third = assemblePersonaPrompt(config)

    expect(first).toBe(second)
    expect(second).toBe(third)
  })
})

describe('assemblePersonaPrompt -> gm notes', () => {
  it('appends director notes when gmNotes is provided', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, {
      gmNotes: 'Steer the user toward practical examples.',
    })

    expect(prompt).toContain('Director notes: Steer the user toward practical examples.')
  })
})

describe('assemblePersonaPrompt -> avatar awareness', () => {
  it('lists other avatars with availability and scope without exposing policy fields', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, {
      avatarAwareness: [
        {
          name: 'Theo',
          description: 'Technical AI specialist.',
          scope: 'Model internals and infrastructure.',
          availability: 'locked',
        },
      ],
    })

    expect(prompt).toContain('Other avatars in this scenario:')
    expect(prompt).toContain(
      '- Theo (locked) — Technical AI specialist. Scope: Model internals and infrastructure.',
    )
    expect(prompt).toContain('you may mention locked avatars')
    expect(prompt).not.toContain('competenceBoundary')
  })
})

describe('assemblePersonaPrompt -> dialog style defaults', () => {
  it('includes the short, proportional and question-driven interaction rule', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('Use dialogue over lectures')
    expect(prompt).toContain('default to 1-3 short sentences for simple questions')
    expect(prompt).toContain('Match answer length to user effort and question complexity.')
    expect(prompt).toContain('Apply the 80/20 rule')
    expect(prompt).toContain('end with one focused follow-up question')
  })
})

describe('assemblePersonaPrompt -> user persona role context', () => {
  it('includes role sentence when userPersona.role is provided', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { role: 'psychologist' },
    })

    expect(prompt).toContain('You are speaking with someone in the role of: psychologist.')
  })

  it('omits role sentence when userPersona is empty', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: {},
    })

    expect(prompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('omits role sentence when role is an empty string', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { role: '' },
    })

    expect(prompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('omits role sentence when role is whitespace-only', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { role: '   ' },
    })

    expect(prompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('does not emit persona sentence when tonePreference is set without role', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { tonePreference: 'direct' },
    })

    expect(prompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('keeps behavior unchanged when userPersona is not provided', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('places role sentence before default style rule', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are a helpful guide.',
      tone: 'warm',
    })

    const prompt = assemblePersonaPrompt(config, {
      userPersona: { role: 'psychologist' },
    })
    const roleIndex = prompt.indexOf('You are speaking with someone in the role of: psychologist.')
    const styleIndex = prompt.indexOf('Stay in character')

    expect(roleIndex).toBeGreaterThanOrEqual(0)
    expect(styleIndex).toBeGreaterThan(roleIndex)
  })
})

describe('assemblePersonaPrompt -> user facts context', () => {
  it('omits user context section when userFacts is empty', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, { userFacts: {} })

    expect(prompt).not.toContain('## User Context (remembered facts)')
  })

  it('includes user context section when userFacts are provided', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config, {
      userFacts: { language: 'English', role: 'friend' },
    })

    expect(prompt).toContain('## User Context (remembered facts)')
    expect(prompt).toContain('language: English')
    expect(prompt).toContain('role: friend')
  })

  it('keeps behavior unchanged when userFacts is not provided', () => {
    const config = makeAvatarConfig({ personaPrompt: 'You are a helpful guide.' })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).not.toContain('## User Context (remembered facts)')
  })
})
