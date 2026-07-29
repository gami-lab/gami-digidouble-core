#!/usr/bin/env node

import { pathToFileURL } from 'node:url'

import { loadEvaluationConfig, type EvaluationConfig } from './config.js'
import { loadTestDefinition } from './definition.js'
import type { TestDefinition } from './contracts.js'

export type CliIo = {
  log(message: string): void
  error(message: string): void
}

export async function runCli(
  argv: readonly string[] = process.argv.slice(2),
  environment: Readonly<Record<string, string | undefined>> = process.env,
  io: CliIo = { log: console.log, error: console.error },
): Promise<number> {
  try {
    if (argv.includes('--help')) {
      printHelp(io)
      return 0
    }

    const config = loadEvaluationConfig(argv, environment)
    const definition = await loadTestDefinition(config.definitionPath)

    io.log(JSON.stringify(createRunPlan(config, definition), null, 2))
    return 0
  } catch (error: unknown) {
    io.error(`[conversation-evaluation] ${getErrorMessage(error)}`)
    return 1
  }
}

function createRunPlan(
  config: EvaluationConfig,
  definition: TestDefinition,
): Record<string, unknown> {
  return {
    definition: {
      name: definition.name,
      scenarioId: definition.scenarioId,
      initialAvatarId: definition.initialAvatarId ?? null,
      initialAvatarName: definition.initialAvatarName ?? null,
      declaredModel: definition.model ?? null,
      declaredJudgeModel: definition.judgeModel ?? null,
      questions: definition.questions.length,
    },
    configuration: {
      avatarApiBaseUrl: config.avatarApiBaseUrl,
      judgeBaseUrl: config.judgeBaseUrl ?? null,
      outputPath: config.outputPath,
      timeoutMs: config.timeoutMs,
      userId: config.userId,
    },
    networkRequests: 0,
  }
}

function printHelp(io: CliIo): void {
  io.log(
    [
      'Conversation evaluation foundation',
      '',
      'Validates a JSON definition and resolves local run configuration.',
      'This foundation command does not make network requests.',
      '',
      'Usage:',
      '  pnpm --filter @gami/conversation-evaluation evaluate -- --definition <path>',
      '',
      'Options:',
      '  --definition <path>              or EVALUATION_DEFINITION_PATH',
      '  --avatar-api-base-url <url>      or AVATAR_API_BASE_URL',
      '  --api-key <key>                  or EVALUATION_API_KEY / API_KEY',
      '  --judge-base-url <url>           or JUDGE_API_BASE_URL',
      '  --output <path>                  or EVALUATION_OUTPUT_PATH',
      '  --timeout-ms <milliseconds>      or EVALUATION_TIMEOUT_MS',
      '  --user-id <id>                   or EVALUATION_USER_ID',
    ].join('\n'),
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown evaluation configuration error.'
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCli().then(
    (exitCode) => {
      process.exitCode = exitCode
    },
    (error: unknown) => {
      console.error(`[conversation-evaluation] ${getErrorMessage(error)}`)
      process.exitCode = 1
    },
  )
}
