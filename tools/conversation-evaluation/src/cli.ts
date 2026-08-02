#!/usr/bin/env node

import { pathToFileURL } from 'node:url'

import { loadEvaluationConfig } from './config.js'
import {
  createModelComparisonReport,
  createModelRunDefinition,
  loadModelComparisonReport,
  modelReportPath,
  modelRunKey,
  renderModelComparisonSummary,
  writeModelComparisonReport,
  writeModelComparisonSnapshot,
} from './comparison.js'
import { CoreApiClient } from './core-api-client.js'
import { loadTestDefinition } from './definition.js'
import { INTER_QUESTION_DELAY_MS, runEvaluation } from './evaluation.js'
import { SemanticJudgeClient } from './judge.js'
import type { RunReportStatus } from './contracts.js'

export type CliIo = {
  log(message: string): void
  error(message: string): void
}

export const MAX_CONSECUTIVE_MODEL_FAILURES = 3

export function countConsecutiveModelFailures(
  status: RunReportStatus,
  previousCount: number,
): number {
  return status === 'completed' ? 0 : previousCount + 1
}

// eslint-disable-next-line complexity, max-lines-per-function
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
    const progress = (message: string): void => {
      io.log(`[conversation-evaluation] ${message}`)
    }
    if (config.append && definition.models === undefined) {
      throw new Error('--append requires a definition with multiple models.')
    }
    if (definition.models === undefined) {
      const output = await runEvaluation({
        definition,
        userId: config.userId,
        avatarClient,
        judgeClient,
        outputPath: config.outputPath,
        signal: interruption.signal,
        interQuestionDelayMs: INTER_QUESTION_DELAY_MS,
        onProgress: progress,
      }).finally(() => process.removeListener('SIGINT', onInterrupt))
      io.log(output.consoleSummary)
      return output.report.status === 'completed' ? 0 : 1
    }

    const existingComparison = config.append
      ? await loadModelComparisonReport(config.outputPath)
      : null
    let comparison = existingComparison ?? createModelComparisonReport(definition)
    if (
      comparison.testName !== definition.name ||
      comparison.scenarioId !== definition.scenarioId
    ) {
      throw new Error('The existing comparison report belongs to a different definition.')
    }
    let consecutiveFailures = 0
    const modelTotals = countModelOccurrences(definition.models)
    const modelOccurrences = new Map<string, number>()
    try {
      if (existingComparison === null) {
        await writeModelComparisonReport(config.outputPath, comparison)
      }
      for (const model of definition.models) {
        const occurrence = modelOccurrences.get(model) ?? 0
        modelOccurrences.set(model, occurrence + 1)
        const runKey = modelRunKey(model, occurrence, modelTotals.get(model) ?? 1)
        const modelDefinition = createModelRunDefinition(definition, model)
        const reportPath = modelReportPath(config.outputPath, model, runKey)
        progress(`Starting model comparison run for ${modelRunLabel(model, runKey)}.`)
        const output = await runEvaluation({
          definition: modelDefinition,
          userId: `${config.userId}-${runKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          avatarClient,
          judgeClient,
          avatarModel: model,
          writeReport: async (report) => {
            comparison = await writeModelComparisonSnapshot({
              comparisonOutputPath: config.outputPath,
              comparison,
              model,
              runKey,
              report,
              reportPath,
            })
          },
          signal: interruption.signal,
          interQuestionDelayMs: INTER_QUESTION_DELAY_MS,
          onProgress: progress,
        })
        consecutiveFailures = countConsecutiveModelFailures(
          output.report.status,
          consecutiveFailures,
        )
        if (consecutiveFailures >= MAX_CONSECUTIVE_MODEL_FAILURES) {
          progress(
            `Stopping model comparison after ${String(MAX_CONSECUTIVE_MODEL_FAILURES)} consecutive failed runs.`,
          )
          break
        }
      }
    } finally {
      process.removeListener('SIGINT', onInterrupt)
    }
    io.log(renderModelComparisonSummary(comparison))
    return comparison.runs.every(({ report }) => report.status === 'completed') ? 0 : 1
  } catch (error: unknown) {
    io.error(`[conversation-evaluation] ${getErrorMessage(error)}`)
    return 1
  }
}

function countModelOccurrences(models: readonly string[]): Map<string, number> {
  const totals = new Map<string, number>()
  models.forEach((model) => totals.set(model, (totals.get(model) ?? 0) + 1))
  return totals
}

function modelRunLabel(model: string, runKey: string): string {
  if (runKey === model) return model
  return `${model} (run ${runKey.slice(model.length + 1)})`
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
      '  --append                         preserve and update an existing model comparison report',
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
