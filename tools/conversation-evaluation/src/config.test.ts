import { describe, expect, it } from 'vitest'

import {
  ConfigurationError,
  createRunScopedUserId,
  loadEvaluationConfig,
  parseCliArgs,
} from './config.js'

const environment = {
  EVALUATION_DEFINITION_PATH: './definition.json',
  AVATAR_API_BASE_URL: 'http://localhost:3000/',
  EVALUATION_API_KEY: 'secret-api-key',
}

describe('evaluation configuration', () => {
  it('loads flags with precedence over environment and normalizes URLs', () => {
    const config = loadEvaluationConfig(
      [
        '--definition',
        './from-cli.json',
        '--avatar-api-base-url=http://localhost:4000/',
        '--api-key',
        'cli-secret',
        '--judge-base-url',
        'https://judge.example/',
        '--output',
        './reports/run.json',
        '--timeout-ms=1200',
      ],
      environment,
    )
    expect(config).toMatchObject({
      definitionPath: './from-cli.json',
      avatarApiBaseUrl: 'http://localhost:4000',
      apiKey: 'cli-secret',
      judgeBaseUrl: 'https://judge.example',
      outputPath: './reports/run.json',
      timeoutMs: 1200,
    })
    expect(config.userId).toMatch(/^evaluation-/)
  })

  it('generates a different run-scoped user ID by default and accepts explicit continuity IDs', () => {
    expect(createRunScopedUserId()).not.toBe(createRunScopedUserId())
    expect(
      loadEvaluationConfig([], { ...environment, EVALUATION_USER_ID: 'controlled-user' }).userId,
    ).toBe('controlled-user')
  })

  it('rejects missing secrets without including the secret in the error', () => {
    expect(() =>
      loadEvaluationConfig([], { ...environment, EVALUATION_API_KEY: undefined }),
    ).toThrow(ConfigurationError)
    expect(() =>
      loadEvaluationConfig([], { ...environment, EVALUATION_API_KEY: undefined }),
    ).toThrow('Missing API key.')
    expect(() =>
      loadEvaluationConfig(['--api-key=secret-value'], {
        ...environment,
        AVATAR_API_BASE_URL: undefined,
      }),
    ).toThrow('Missing Avatar API base URL.')
    expect(() =>
      loadEvaluationConfig(['--api-key=secret-value'], {
        ...environment,
        AVATAR_API_BASE_URL: undefined,
      }),
    ).not.toThrow(/secret-value/)
  })

  it('rejects invalid URLs and timeout values', () => {
    expect(() =>
      loadEvaluationConfig([], { ...environment, AVATAR_API_BASE_URL: 'ftp://localhost' }),
    ).toThrow(/valid http or https URL/)
    expect(() => loadEvaluationConfig(['--timeout-ms', '0'], environment)).toThrow(
      /positive integer/,
    )
  })

  it('rejects unknown options and options without values', () => {
    expect(() => parseCliArgs(['--unknown', 'value'])).toThrow(/Unknown option --unknown/)
    expect(() => parseCliArgs(['--definition'])).toThrow(/requires a value/)
  })
})
