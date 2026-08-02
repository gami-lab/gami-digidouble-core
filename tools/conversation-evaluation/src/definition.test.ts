import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  DefinitionLoadError,
  DefinitionValidationError,
  loadTestDefinition,
  validateTestDefinition,
} from './definition.js'

const validDefinition = {
  version: 1,
  name: 'Villa baseline',
  scenarioId: 'scenario_villa',
  initialAvatarName: 'Clara Whitcombe',
  model: 'openai/gpt-5.4',
  judgeModel: 'openai/gpt-5.4-mini',
  avatarOptions: {
    retrieval: {
      maxChunks: 5,
      minimumChunksBySource: {
        gm_required_fact: 1,
        gm_retrieval_query: 1,
        last_user_input: 1,
      },
    },
  },
  questions: [
    {
      question: 'What happened in the winter garden?',
      expectedResponse: 'Mention the death and the storm without requiring exact wording.',
      requiredFacts: ['the death', 'the storm'],
      acceptedAlternatives: ['a storm caused the death'],
      forbiddenClaims: ['the death was accidental'],
    },
    {
      question: 'Who was present that evening?',
      expectedResponse: 'Identify the relevant people known to the avatar.',
    },
  ],
}

// eslint-disable-next-line max-lines-per-function
describe('evaluation definition validation', () => {
  it('accepts a valid definition and preserves criteria text', () => {
    expect(validateTestDefinition(validDefinition)).toEqual(validDefinition)
  })

  it('loads and validates JSON without any network dependency', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-'))
    const filePath = join(directory, 'definition.json')
    await writeFile(filePath, JSON.stringify(validDefinition), 'utf8')

    await expect(loadTestDefinition(filePath)).resolves.toEqual(validDefinition)
  })

  it('keeps the seeded Villa Miralac definition opt-in and executable by name', async () => {
    const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const definition = await loadTestDefinition(
      join(packageDirectory, 'definitions', 'murder-party-villa-miralac.json'),
    )
    expect(definition).toMatchObject({
      version: 1,
      scenarioId: 'murder-party-villa-miralac',
      initialAvatarName: 'Clara Whitcombe',
    })
    expect(definition.questions.length).toBeGreaterThanOrEqual(3)
  })

  it('rejects missing required fields', () => {
    expect(() => validateTestDefinition({ version: 1 })).toThrow(DefinitionValidationError)
    expect(() => validateTestDefinition({ version: 1 })).toThrow(/name must be a non-empty string/)
  })

  it('rejects both or neither initial-avatar selectors', () => {
    expect(() =>
      validateTestDefinition(validDefinitionWith({ initialAvatarId: 'avatar_1' })),
    ).toThrow(/Exactly one of initialAvatarId or initialAvatarName/)
    expect(() =>
      validateTestDefinition(
        validDefinitionWith({ initialAvatarName: undefined, initialAvatarId: undefined }),
      ),
    ).toThrow(/Exactly one of initialAvatarId or initialAvatarName/)
  })

  it('rejects unknown fields and malformed model metadata without echoing values', () => {
    expect(() => validateTestDefinition(validDefinitionWith({ apiKey: 'secret-value' }))).toThrow(
      /definition\.apiKey is not supported/,
    )
    expect(() =>
      validateTestDefinition(validDefinitionWith({ model: { provider: 'openai' } })),
    ).toThrow(/model must be a non-empty string/)
    expect(() =>
      validateTestDefinition(validDefinitionWith({ apiKey: 'secret-value' })),
    ).not.toThrow(/secret-value/)
  })

  it('rejects empty questions and duplicate question text', () => {
    expect(() => validateTestDefinition(validDefinitionWith({ questions: [] }))).toThrow(
      /questions must be a non-empty array/,
    )
    expect(() =>
      validateTestDefinition(
        validDefinitionWith({
          questions: [validDefinition.questions[0], validDefinition.questions[0]],
        }),
      ),
    ).toThrow(/duplicate questions are not allowed/)
  })

  it('rejects malformed structured evaluation criteria', () => {
    expect(() =>
      validateTestDefinition(
        validDefinitionWith({
          questions: [{ ...validDefinition.questions[0], requiredFacts: [] }],
        }),
      ),
    ).toThrow(/requiredFacts must be a non-empty array/)
    expect(() =>
      validateTestDefinition(
        validDefinitionWith({
          questions: [{ ...validDefinition.questions[0], forbiddenClaims: [''] }],
        }),
      ),
    ).toThrow(/forbiddenClaims must be a non-empty array/)
  })

  it('rejects Avatar retrieval options outside the API limits', () => {
    expect(() =>
      validateTestDefinition(
        validDefinitionWith({ avatarOptions: { retrieval: { maxChunks: 10 } } }),
      ),
    ).toThrow(/maxChunks must be an integer between 1 and 9/)
    expect(() =>
      validateTestDefinition(
        validDefinitionWith({
          avatarOptions: { retrieval: { minimumChunksBySource: { last_user_input: -1 } } },
        }),
      ),
    ).toThrow(/last_user_input must be an integer between 0 and 9/)
  })

  it('accepts comparison model selectors including repeated runs', () => {
    expect(
      validateTestDefinition(
        validDefinitionWith({
          models: ['openai/gpt-5.4', 'openai/gpt-5.4', 'xai/grok-4.3'],
          model: undefined,
        }),
      ),
    ).toMatchObject({
      models: ['openai/gpt-5.4', 'openai/gpt-5.4', 'xai/grok-4.3'],
    })
    expect(() =>
      validateTestDefinition(
        validDefinitionWith({ models: ['openai/gpt-5.4'], model: 'openai/gpt-5.4' }),
      ),
    ).toThrow(/model and models cannot both be provided/)
    expect(() => validateTestDefinition(validDefinitionWith({ models: ['gpt-5.4'] }))).toThrow(
      /must use provider\/model notation/,
    )
  })

  it('does not print a missing definition path', async () => {
    await expect(loadTestDefinition('/path/that/does/not/exist')).rejects.toThrow(
      DefinitionLoadError,
    )
    await expect(loadTestDefinition('/path/that/does/not/exist')).rejects.toThrow(
      'Unable to read the evaluation definition file.',
    )
  })
})

function validDefinitionWith(overrides: Record<string, unknown>): Record<string, unknown> {
  return { ...validDefinition, ...overrides }
}
