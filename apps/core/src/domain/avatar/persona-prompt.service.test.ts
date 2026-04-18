import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from './avatar.fixtures.js'
import { assemblePersonaPrompt } from './persona-prompt.service.js'

describe('assemblePersonaPrompt', () => {
  it('always includes personaPrompt verbatim in output', () => {
    const config = makeAvatarConfig({
      personaPrompt: 'You are the scenario librarian. Never break role.',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain(config.personaPrompt)
  })

  it('includes name identification when personaPrompt does not reference the avatar name', () => {
    const config = makeAvatarConfig({
      name: 'Nova',
      personaPrompt: 'You are a futuristic museum guide.',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('Your name is Nova.')
  })

  it('does not duplicate name identification when personaPrompt already references the avatar name', () => {
    const config = makeAvatarConfig({
      name: 'Ava',
      personaPrompt: 'You are Ava, a warm and curious guide.',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).not.toContain('Your name is Ava.')
  })

  it('includes tone modifier when tone is provided', () => {
    const config = makeAvatarConfig({
      tone: 'calm and precise',
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('Your tone is calm and precise.')
  })

  it('returns a non-empty string output', () => {
    const prompt = assemblePersonaPrompt(makeAvatarConfig())

    expect(typeof prompt).toBe('string')
    expect(prompt.trim().length).toBeGreaterThan(0)
  })

  it('does not throw with minimal runtime config where only personaPrompt is meaningful', () => {
    const config = {
      avatarId: 'avatar-minimal',
      scenarioId: 'scenario-minimal',
      name: 'Mina',
      slug: 'mina',
      status: 'active' as const,
      personaPrompt: 'You are a calm museum docent.',
    }

    expect(() => assemblePersonaPrompt(config)).not.toThrow()
  })

  it('is deterministic for the same input', () => {
    const config = makeAvatarConfig({
      config: {
        personaAdjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
      },
    })

    const first = assemblePersonaPrompt(config)
    const second = assemblePersonaPrompt(config)

    expect(first).toBe(second)
  })

  it('includes optional persona adjustments from config when provided', () => {
    const config = makeAvatarConfig({
      config: {
        personaAdjustments: ['Avoid markdown tables.', 'Use short paragraphs.'],
      },
    })

    const prompt = assemblePersonaPrompt(config)

    expect(prompt).toContain('Avoid markdown tables.')
    expect(prompt).toContain('Use short paragraphs.')
  })

  it('throws a clear domain error when personaPrompt is empty', () => {
    const config = makeAvatarConfig({
      personaPrompt: '   ',
    })

    expect(() => assemblePersonaPrompt(config)).toThrow(
      'Avatar personaPrompt must be a non-empty string.',
    )
  })

  it('contains no imports from application, infrastructure, or external libraries', async () => {
    const testFilePath = fileURLToPath(import.meta.url)
    const servicePath = resolve(dirname(testFilePath), 'persona-prompt.service.ts')
    const source = await readFile(servicePath, 'utf8')

    expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/application\//)
    expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/infrastructure\//)
    expect(source).not.toMatch(/from ['"](?![./])/)
  })
})
