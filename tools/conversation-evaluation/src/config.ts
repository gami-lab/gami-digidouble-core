import { randomUUID } from 'node:crypto'

export type EvaluationConfig = {
  definitionPath: string
  avatarApiBaseUrl: string
  apiKey: string
  judgeBaseUrl?: string
  outputPath: string
  timeoutMs: number
  userId: string
}

export type EvaluationCliOptions = {
  definition?: string
  'avatar-api-base-url'?: string
  'api-key'?: string
  'judge-base-url'?: string
  output?: string
  'timeout-ms'?: string
  'user-id'?: string
  help?: boolean
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

export type EvaluationEnvironment = Readonly<Record<string, string | undefined>>
type ValueOptionName = Exclude<keyof EvaluationCliOptions, 'help'>
type ParsedToken = {
  name: ValueOptionName | 'help'
  inlineValue?: string
}

const OPTION_NAMES = new Set([
  'definition',
  'avatar-api-base-url',
  'api-key',
  'judge-base-url',
  'output',
  'timeout-ms',
  'user-id',
  'help',
])

function readOptionValue(options: EvaluationCliOptions, name: ValueOptionName): string | undefined {
  const value = options[name]
  return typeof value === 'string' ? value : undefined
}

function requireNonEmpty(value: string | undefined, message: string): string {
  if (value === undefined || value.trim().length === 0) throw new ConfigurationError(message)
  return value.trim()
}

function readUrl(value: string | undefined, label: string, required: true): string
function readUrl(value: string | undefined, label: string, required: false): string | undefined
function readUrl(value: string | undefined, label: string, required: boolean): string | undefined {
  if (value === undefined || value.trim().length === 0) {
    if (required) throw new ConfigurationError(`Missing ${label}.`)
    return undefined
  }

  const normalized = value.trim()
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new ConfigurationError(`${label} must be a valid http or https URL.`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ConfigurationError(`${label} must be a valid http or https URL.`)
  }
  return normalized.replace(/\/$/, '')
}

function readTimeout(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) return 30_000
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ConfigurationError('timeout-ms must be a positive integer.')
  }
  return parsed
}

export function parseCliArgs(argv: readonly string[]): EvaluationCliOptions {
  const options: EvaluationCliOptions = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const parsedToken = parseToken(token)
    if (parsedToken.name === 'help') {
      options.help = true
      continue
    }

    const value = parsedToken.inlineValue ?? readNextValue(argv, index, parsedToken.name)
    if (parsedToken.inlineValue === undefined) {
      index += 1
    }
    options[parsedToken.name] = value
  }
  return options
}

function parseToken(token: string | undefined): ParsedToken {
  if (token === undefined || !token.startsWith('--')) {
    throw new ConfigurationError('Arguments must use named --options.')
  }

  const separatorIndex = token.indexOf('=')
  const name = separatorIndex >= 0 ? token.slice(2, separatorIndex) : token.slice(2)
  if (!OPTION_NAMES.has(name)) throw new ConfigurationError(`Unknown option --${name}.`)
  if (name === 'help' && separatorIndex >= 0) {
    throw new ConfigurationError('--help does not accept a value.')
  }

  return {
    name: name as ParsedToken['name'],
    ...(separatorIndex >= 0 ? { inlineValue: token.slice(separatorIndex + 1) } : {}),
  }
}

function readNextValue(argv: readonly string[], index: number, optionName: string): string {
  const next = argv[index + 1]
  if (next === undefined || next.startsWith('--')) {
    throw new ConfigurationError(`Option --${optionName} requires a value.`)
  }
  return next
}

export function createRunScopedUserId(): string {
  return `evaluation-${randomUUID()}`
}

export function loadEvaluationConfig(
  argv: readonly string[] = [],
  environment: EvaluationEnvironment = process.env,
): EvaluationConfig {
  const options = parseCliArgs(argv)
  const definitionPath = requireNonEmpty(
    resolveValue(options, 'definition', environment, 'EVALUATION_DEFINITION_PATH'),
    'Missing definition path. Use --definition or EVALUATION_DEFINITION_PATH.',
  )
  const avatarApiBaseUrl = readUrl(
    resolveValue(options, 'avatar-api-base-url', environment, 'AVATAR_API_BASE_URL'),
    'Avatar API base URL',
    true,
  )
  const apiKey = requireNonEmpty(
    resolveValue(options, 'api-key', environment, 'EVALUATION_API_KEY', 'API_KEY'),
    'Missing API key. Use --api-key, EVALUATION_API_KEY, or API_KEY.',
  )
  const judgeBaseUrl = readUrl(
    resolveValue(options, 'judge-base-url', environment, 'JUDGE_API_BASE_URL'),
    'Judge base URL',
    false,
  )
  const outputPath = requireNonEmpty(
    resolveValue(options, 'output', environment, 'EVALUATION_OUTPUT_PATH') ??
      'evaluation-report.json',
    'Output path must be a non-empty string.',
  )
  const timeoutMs = readTimeout(
    resolveValue(options, 'timeout-ms', environment, 'EVALUATION_TIMEOUT_MS'),
  )
  const configuredUserId = resolveValue(options, 'user-id', environment, 'EVALUATION_USER_ID')
  const userId =
    configuredUserId === undefined
      ? createRunScopedUserId()
      : requireNonEmpty(configuredUserId, 'User ID must be a non-empty string.')

  return {
    definitionPath,
    avatarApiBaseUrl,
    apiKey,
    ...(judgeBaseUrl !== undefined ? { judgeBaseUrl } : {}),
    outputPath,
    timeoutMs,
    userId,
  }
}

function resolveValue(
  options: EvaluationCliOptions,
  optionName: ValueOptionName,
  environment: EvaluationEnvironment,
  ...environmentNames: readonly string[]
): string | undefined {
  const optionValue = readOptionValue(options, optionName)
  if (optionValue !== undefined) return optionValue
  for (const environmentName of environmentNames) {
    const environmentValue = environment[environmentName]
    if (environmentValue !== undefined) return environmentValue
  }
  return undefined
}
