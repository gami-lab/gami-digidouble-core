#!/usr/bin/env node

import { pathToFileURL } from 'node:url'

import { loadEvaluationConfig } from './config.js'
import { CoreApiClient } from './core-api-client.js'
import { loadTestDefinition } from './definition.js'
import { INTER_QUESTION_DELAY_MS, runEvaluation } from './evaluation.js'
import { SemanticJudgeClient } from './judge.js'

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

    const avatarClient = new CoreApiClient({
      baseUrl: config.avatarApiBaseUrl,
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs,
    })
    const judgeClient = new SemanticJudgeClient({
      baseUrl: config.judgeBaseUrl ?? config.avatarApiBaseUrl,
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs,
      ...(definition.judgeModel === undefined ? {} : { model: definition.judgeModel }),
    })
    const interruption = new AbortController()
    const onInterrupt = (): void => {
      interruption.abort()
    }
    process.once('SIGINT', onInterrupt)
    const output = await runEvaluation({
      definition,
      userId: config.userId,
      avatarClient,
      judgeClient,
      outputPath: config.outputPath,
      signal: interruption.signal,
      interQuestionDelayMs: INTER_QUESTION_DELAY_MS,
      onProgress: (message) => {
        io.log(`[conversation-evaluation] ${message}`)
      },
    }).finally(() => process.removeListener('SIGINT', onInterrupt))
    io.log(output.consoleSummary)
    return output.report.status === 'completed' ? 0 : 1
  } catch (error: unknown) {
    io.error(`[conversation-evaluation] ${getErrorMessage(error)}`)
    return 1
  }
}

function printHelp(io: CliIo): void {
  io.log(
    [
      'Conversation evaluation',
      '',
      'Runs a sequential scripted conversation and semantically judges each Avatar response.',
      '',
      'Usage:',
      '  pnpm --filter @gami/conversation-evaluation evaluate --definition <path>',
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
