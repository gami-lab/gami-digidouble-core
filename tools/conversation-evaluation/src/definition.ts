import { readFile } from 'node:fs/promises'

import type { TestDefinition, TestQuestion } from './contracts.js'

const DEFINITION_KEYS = new Set([
  'version',
  'name',
  'scenarioId',
  'initialAvatarId',
  'initialAvatarName',
  'model',
  'judgeModel',
  'questions',
])

const QUESTION_KEYS = new Set(['question', 'expectedResponse'])

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
  if (question === undefined || expectedResponse === undefined) return undefined

  return { question, expectedResponse }
}

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
    ...(fields.judgeModel !== undefined ? { judgeModel: fields.judgeModel } : {}),
    questions,
  }
}

type DefinitionFields = {
  name: string | undefined
  scenarioId: string | undefined
  initialAvatarId?: string
  initialAvatarName?: string
  model?: string
  judgeModel?: string
}

function readDefinitionFields(value: Record<string, unknown>, issues: string[]): DefinitionFields {
  if (value['version'] !== 1) issues.push('version must be 1.')
  const name = readRequiredString(value, 'name', issues)
  const scenarioId = readRequiredString(value, 'scenarioId', issues)
  const initialAvatarId = readOptionalString(value, 'initialAvatarId', issues)
  const initialAvatarName = readOptionalString(value, 'initialAvatarName', issues)
  const model = readOptionalString(value, 'model', issues)
  const judgeModel = readOptionalString(value, 'judgeModel', issues)
  if ((initialAvatarId !== undefined) === (initialAvatarName !== undefined)) {
    issues.push('Exactly one of initialAvatarId or initialAvatarName must be provided.')
  }

  return {
    name,
    scenarioId,
    ...(initialAvatarId !== undefined ? { initialAvatarId } : {}),
    ...(initialAvatarName !== undefined ? { initialAvatarName } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(judgeModel !== undefined ? { judgeModel } : {}),
  }
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
