import { readFile } from 'node:fs/promises'
import { AVATAR_RETRIEVAL_MAX_CHUNKS, AVATAR_RETRIEVAL_MINIMUM_CHUNKS } from '@gami/shared'

import type { TestDefinition, TestQuestion } from './contracts.js'

const DEFINITION_KEYS = new Set([
  'version',
  'name',
  'scenarioId',
  'initialAvatarId',
  'initialAvatarName',
  'model',
  'models',
  'judgeModel',
  'avatarOptions',
  'questions',
])

const QUESTION_KEYS = new Set([
  'question',
  'expectedResponse',
  'requiredFacts',
  'acceptedAlternatives',
  'forbiddenClaims',
])

export class DefinitionValidationError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`Invalid evaluation definition: ${issues.join(' ')}`)
    this.name = 'DefinitionValidationError'
    this.issues = issues
  }
}

export class DefinitionLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DefinitionLoadError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRequiredString(
  record: Record<string, unknown>,
  field: string,
  issues: string[],
): string | undefined {
  const value = record[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string.`)
    return undefined
  }
  return value
}

function readOptionalString(
  record: Record<string, unknown>,
  field: string,
  issues: string[],
): string | undefined {
  const value = record[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string when provided.`)
    return undefined
  }
  return value
}

function addUnknownFieldIssues(
  record: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  location: string,
  issues: string[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) issues.push(`${location}.${key} is not supported.`)
  }
}

function validateQuestion(
  value: unknown,
  index: number,
  issues: string[],
): TestQuestion | undefined {
  const location = `questions[${String(index)}]`
  if (!isRecord(value)) {
    issues.push(`${location} must be an object.`)
    return undefined
  }

  addUnknownFieldIssues(value, QUESTION_KEYS, location, issues)
  const question = readRequiredString(value, 'question', issues)
  const expectedResponse = readRequiredString(value, 'expectedResponse', issues)
  const requiredFacts = readOptionalStringArray(value, 'requiredFacts', location, issues)
  const acceptedAlternatives = readOptionalStringArray(
    value,
    'acceptedAlternatives',
    location,
    issues,
  )
  const forbiddenClaims = readOptionalStringArray(value, 'forbiddenClaims', location, issues)
  if (question === undefined || expectedResponse === undefined) return undefined

  return {
    question,
    expectedResponse,
    ...(requiredFacts === undefined ? {} : { requiredFacts }),
    ...(acceptedAlternatives === undefined ? {} : { acceptedAlternatives }),
    ...(forbiddenClaims === undefined ? {} : { forbiddenClaims }),
  }
}

function readOptionalStringArray(
  record: Record<string, unknown>,
  field: string,
  location: string,
  issues: string[],
): string[] | undefined {
  const value = record[field]
  if (value === undefined) return undefined
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'string' || item.trim().length === 0)
  ) {
    issues.push(
      `${location}.${field} must be a non-empty array of non-empty strings when provided.`,
    )
    return undefined
  }
  return value.map((item) => (item as string).trim())
}

// eslint-disable-next-line complexity
export function validateTestDefinition(value: unknown): TestDefinition {
  if (!isRecord(value)) {
    throw new DefinitionValidationError(['The root value must be a JSON object.'])
  }

  const issues: string[] = []
  addUnknownFieldIssues(value, DEFINITION_KEYS, 'definition', issues)
  const fields = readDefinitionFields(value, issues)
  const questions = readQuestions(value, issues)
  addDuplicateQuestionIssues(questions, issues)

  if (issues.length > 0 || fields.name === undefined || fields.scenarioId === undefined) {
    throw new DefinitionValidationError(issues)
  }

  return {
    version: 1,
    name: fields.name,
    scenarioId: fields.scenarioId,
    ...(fields.initialAvatarId !== undefined ? { initialAvatarId: fields.initialAvatarId } : {}),
    ...(fields.initialAvatarName !== undefined
      ? { initialAvatarName: fields.initialAvatarName }
      : {}),
    ...(fields.model !== undefined ? { model: fields.model } : {}),
    ...(fields.models !== undefined ? { models: fields.models } : {}),
    ...(fields.judgeModel !== undefined ? { judgeModel: fields.judgeModel } : {}),
    ...(fields.avatarOptions !== undefined ? { avatarOptions: fields.avatarOptions } : {}),
    questions,
  }
}

type DefinitionFields = {
  name: string | undefined
  scenarioId: string | undefined
  initialAvatarId?: string
  initialAvatarName?: string
  model?: string
  models?: string[]
  judgeModel?: string
  avatarOptions?: TestDefinition['avatarOptions']
}

// eslint-disable-next-line complexity
function readDefinitionFields(value: Record<string, unknown>, issues: string[]): DefinitionFields {
  if (value['version'] !== 1) issues.push('version must be 1.')
  const name = readRequiredString(value, 'name', issues)
  const scenarioId = readRequiredString(value, 'scenarioId', issues)
  const initialAvatarId = readOptionalString(value, 'initialAvatarId', issues)
  const initialAvatarName = readOptionalString(value, 'initialAvatarName', issues)
  const model = readOptionalString(value, 'model', issues)
  const models = readOptionalStringArray(value, 'models', 'definition', issues)
  const judgeModel = readOptionalString(value, 'judgeModel', issues)
  const avatarOptions = readAvatarOptions(value['avatarOptions'], issues)
  if (models !== undefined) {
    if (model !== undefined) issues.push('model and models cannot both be provided.')
    models.forEach((candidate, index) => {
      if (!isProviderModelSelector(candidate)) {
        issues.push(`models[${String(index)}] must use provider/model notation.`)
      }
    })
    if (new Set(models).size !== models.length) issues.push('models must not contain duplicates.')
  }
  if ((initialAvatarId !== undefined) === (initialAvatarName !== undefined)) {
    issues.push('Exactly one of initialAvatarId or initialAvatarName must be provided.')
  }

  return {
    name,
    scenarioId,
    ...(initialAvatarId !== undefined ? { initialAvatarId } : {}),
    ...(initialAvatarName !== undefined ? { initialAvatarName } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(models !== undefined ? { models } : {}),
    ...(judgeModel !== undefined ? { judgeModel } : {}),
    ...(avatarOptions !== undefined ? { avatarOptions } : {}),
  }
}

function readAvatarOptions(
  value: unknown,
  issues: string[],
): TestDefinition['avatarOptions'] | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    issues.push('avatarOptions must be an object when provided.')
    return undefined
  }
  addUnknownFieldIssues(value, new Set(['retrieval']), 'definition.avatarOptions', issues)
  const retrievalValue = value['retrieval']
  if (retrievalValue === undefined) return {}
  if (!isRecord(retrievalValue)) {
    issues.push('definition.avatarOptions.retrieval must be an object when provided.')
    return undefined
  }
  addUnknownFieldIssues(
    retrievalValue,
    new Set(['maxChunks', 'minimumChunksBySource']),
    'definition.avatarOptions.retrieval',
    issues,
  )
  const maxChunks = readOptionalInteger(
    retrievalValue,
    'maxChunks',
    1,
    AVATAR_RETRIEVAL_MAX_CHUNKS,
    issues,
    'definition.avatarOptions.retrieval',
  )
  const minimumChunksBySource = readMinimumChunksBySource(
    retrievalValue['minimumChunksBySource'],
    issues,
  )
  return {
    retrieval: {
      ...(maxChunks === undefined ? {} : { maxChunks }),
      ...(minimumChunksBySource === undefined ? {} : { minimumChunksBySource }),
    },
  }
}

function readMinimumChunksBySource(
  value: unknown,
  issues: string[],
):
  | NonNullable<NonNullable<TestDefinition['avatarOptions']>['retrieval']>['minimumChunksBySource']
  | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    issues.push('definition.avatarOptions.retrieval.minimumChunksBySource must be an object.')
    return undefined
  }
  const allowedSources = ['gm_required_fact', 'gm_retrieval_query', 'last_user_input'] as const
  addUnknownFieldIssues(
    value,
    new Set(allowedSources),
    'definition.avatarOptions.retrieval.minimumChunksBySource',
    issues,
  )
  const parsed: Record<string, number> = {}
  for (const source of allowedSources) {
    const minimum = readOptionalInteger(
      value,
      source,
      AVATAR_RETRIEVAL_MINIMUM_CHUNKS,
      AVATAR_RETRIEVAL_MAX_CHUNKS,
      issues,
      'definition.avatarOptions.retrieval.minimumChunksBySource',
    )
    if (minimum !== undefined) parsed[source] = minimum
  }
  return parsed
}

function readOptionalInteger(
  record: Record<string, unknown>,
  field: string,
  minimum: number,
  maximum: number,
  issues: string[],
  location: string,
): number | undefined {
  const value = record[field]
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    issues.push(
      `${location}.${field} must be an integer between ${String(minimum)} and ${String(maximum)}.`,
    )
    return undefined
  }
  return value as number
}

function isProviderModelSelector(value: string): boolean {
  const separatorIndex = value.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return false
  const provider = value.slice(0, separatorIndex)
  return (
    provider === 'openai' ||
    provider === 'anthropic' ||
    provider === 'mistral' ||
    provider === 'xai'
  )
}

function readQuestions(value: Record<string, unknown>, issues: string[]): TestQuestion[] {
  const rawQuestions = value['questions']
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    issues.push('questions must be a non-empty array.')
    return []
  }

  const questions: TestQuestion[] = []
  rawQuestions.forEach((question, index) => {
    const validated = validateQuestion(question, index, issues)
    if (validated !== undefined) questions.push(validated)
  })
  return questions
}

function addDuplicateQuestionIssues(questions: readonly TestQuestion[], issues: string[]): void {
  const seenQuestions = new Map<string, number>()
  questions.forEach((question, index) => {
    const normalizedQuestion = question.question.trim()
    const previousIndex = seenQuestions.get(normalizedQuestion)
    if (previousIndex !== undefined) {
      issues.push(
        `questions[${String(index)}].question duplicates questions[${String(previousIndex)}].question; duplicate questions are not allowed.`,
      )
      return
    }
    seenQuestions.set(normalizedQuestion, index)
  })
}

export async function loadTestDefinition(filePath: string): Promise<TestDefinition> {
  let contents: string
  try {
    contents = await readFile(filePath, 'utf8')
  } catch {
    throw new DefinitionLoadError('Unable to read the evaluation definition file.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(contents) as unknown
  } catch {
    throw new DefinitionLoadError('The evaluation definition file is not valid JSON.')
  }

  return validateTestDefinition(parsed)
}
