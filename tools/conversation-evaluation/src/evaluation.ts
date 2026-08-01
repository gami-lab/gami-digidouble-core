import type { EvaluationError, QuestionResult, RunReport, TestDefinition } from './contracts.js'
import { CoreApiClient, CoreApiError } from './core-api-client.js'
import { JudgeClientError, SemanticJudgeClient } from './judge.js'
import {
  buildReportFromExecution,
  buildRunReport,
  createRunReport,
  renderConsoleSummary,
  ReportWriteError,
  writeReportAtomically,
} from './report.js'
import { runSequentialConversation } from './sequential-runner.js'
import { collectRuntimeUsage, emptyRuntimeUsage } from './runtime-usage.js'

export const INTER_QUESTION_DELAY_MS = 5000

export type EvaluationRunInput = {
  definition: TestDefinition
  userId: string
  avatarModel?: string
  avatarClient: CoreApiClient
  judgeClient: SemanticJudgeClient
  outputPath?: string
  signal?: AbortSignal
  startedAt?: string
  now?: () => string
  writeReport?: (report: RunReport) => Promise<void>
  onProgress?: (message: string) => void
  interQuestionDelayMs?: number
  waitBetweenQuestions?: (durationMs: number, signal?: AbortSignal) => Promise<void>
}

export type EvaluationRunOutput = {
  report: RunReport
  consoleSummary: string
}

type EvaluationRuntime = {
  onProgress: (message: string) => void
  interQuestionDelayMs: number
  waitBetweenQuestions: (durationMs: number, signal?: AbortSignal) => Promise<void>
}

export const MAX_JUDGE_ATTEMPTS = 3

function createEvaluationRuntime(input: EvaluationRunInput): EvaluationRuntime {
  return {
    onProgress: input.onProgress ?? (() => undefined),
    interQuestionDelayMs: input.interQuestionDelayMs ?? 0,
    waitBetweenQuestions: input.waitBetweenQuestions ?? wait,
  }
}

function toEvaluationError(error: unknown, kind: EvaluationError['kind']): EvaluationError {
  if (error instanceof ReportWriteError) {
    return { kind, message: error.message, phase: 'report_persistence' }
  }
  if (error instanceof CoreApiError || error instanceof JudgeClientError) {
    return {
      kind,
      message: error.safeMessage,
      code: error.code,
      ...(error.phase === undefined ? {} : { phase: error.phase }),
      ...(error.status === null ? {} : { status: error.status }),
    }
  }
  return {
    kind,
    message: kind === 'judge_error' ? 'Judge request failed.' : 'Core API request failed.',
  }
}

function qualityOutcome(score: 1 | 2 | 3 | 4 | 5): 'passed' | 'partial' | 'failed' {
  if (score >= 4) return 'passed'
  if (score === 3) return 'partial'
  return 'failed'
}

// eslint-disable-next-line complexity
async function judgeQuestion(
  judgeClient: SemanticJudgeClient,
  result: QuestionResult,
  signal: AbortSignal | undefined,
  onProgress: (message: string) => void,
  questionCount: number,
): Promise<void> {
  if (result.status !== 'completed' || result.actualResponse === null) return
  for (let attempt = 1; attempt <= MAX_JUDGE_ATTEMPTS; attempt += 1) {
    try {
      const evaluation = await judgeClient.evaluate(
        {
          question: result.question,
          expectedResponse: result.expectedResponse,
          ...(result.requiredFacts === undefined ? {} : { requiredFacts: result.requiredFacts }),
          ...(result.acceptedAlternatives === undefined
            ? {}
            : { acceptedAlternatives: result.acceptedAlternatives }),
          ...(result.forbiddenClaims === undefined
            ? {}
            : { forbiddenClaims: result.forbiddenClaims }),
          actualResponse: result.actualResponse,
        },
        signal === undefined ? undefined : { signal },
      )
      result.judge = evaluation.result
      result.judgeModel = evaluation.metrics.model
      result.judgeMetrics = evaluation.metrics
      result.status = qualityOutcome(evaluation.result.score)
      result.error = null
      return
    } catch (error: unknown) {
      const message = toEvaluationError(error, 'judge_error').message
      if (attempt < MAX_JUDGE_ATTEMPTS && signal?.aborted !== true) {
        onProgress(
          `Question ${String(result.questionNumber)}/${String(questionCount)}: judge attempt ${String(attempt)}/${String(MAX_JUDGE_ATTEMPTS)} failed (${message}); retrying.`,
        )
        continue
      }
      onProgress(
        `Question ${String(result.questionNumber)}/${String(questionCount)}: judge failed after ${String(MAX_JUDGE_ATTEMPTS)} attempts (${message}).`,
      )
      result.status = 'judge_error'
      result.judge = null
      result.judgeModel = null
      result.judgeMetrics = null
      result.error = toEvaluationError(error, 'judge_error')
    }
  }
}

// eslint-disable-next-line complexity
export async function runEvaluation(input: EvaluationRunInput): Promise<EvaluationRunOutput> {
  const startedAt = input.startedAt ?? new Date().toISOString()
  const now = input.now ?? (() => new Date().toISOString())
  const writeReport =
    input.writeReport ??
    (input.outputPath === undefined
      ? (): Promise<void> => Promise.resolve()
      : (report: RunReport): Promise<void> =>
          writeReportAtomically(input.outputPath as string, report))
  const runtime = createEvaluationRuntime(input)

  let report = createRunReport(input.definition, startedAt)
  runtime.onProgress(`Starting evaluation: ${input.definition.name}.`)
  await writeReport(report)

  try {
    const execution = await runSequentialConversation(input.avatarClient, {
      definition: input.definition,
      userId: input.userId,
      ...(input.avatarModel === undefined ? {} : { modelOverride: input.avatarModel }),
      onProgress: runtime.onProgress,
      interQuestionDelayMs: runtime.interQuestionDelayMs,
      waitBetweenQuestions: runtime.waitBetweenQuestions,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      onResult: async (result) => {
        runtime.onProgress(
          `Question ${String(result.questionNumber)}/${String(input.definition.questions.length)}: judging Avatar response.`,
        )
        await judgeQuestion(
          input.judgeClient,
          result,
          input.signal,
          runtime.onProgress,
          input.definition.questions.length,
        )
        report = buildRunReport({
          definition: input.definition,
          startedAt,
          finishedAt: null,
          results: [...report.questions, result],
          sessionId: result.sessionId,
          conversationId: result.conversationId,
        })
        await writeReport(report)
        runtime.onProgress(
          `Question ${String(result.questionNumber)}/${String(input.definition.questions.length)}: ${result.status}.`,
        )
      },
    })
    runtime.onProgress(
      'Waiting for asynchronous Game Master and memory work before collecting usage.',
    )
    await runtime.waitBetweenQuestions(runtime.interQuestionDelayMs, input.signal)
    let runtimeUsage = emptyRuntimeUsage('unavailable')
    try {
      runtimeUsage = await collectRuntimeUsage(
        input.avatarClient,
        execution.sessionId,
        input.signal === undefined ? undefined : { signal: input.signal },
      )
    } catch (error: unknown) {
      runtime.onProgress(
        `Unable to collect asynchronous runtime usage (${error instanceof Error ? error.message : 'unknown error'}).`,
      )
    }
    report = buildReportFromExecution(input.definition, startedAt, execution, now(), runtimeUsage)
    await writeReport(report)
    return { report, consoleSummary: renderConsoleSummary(report) }
  } catch (error: unknown) {
    const kind: EvaluationError['kind'] =
      error instanceof JudgeClientError ? 'judge_error' : 'api_error'
    report = buildRunReport({
      definition: input.definition,
      startedAt,
      finishedAt: now(),
      results: report.questions,
      sessionId: report.sessionId,
      conversationId: report.conversationId,
      error: toEvaluationError(error, kind),
    })
    await writeReport(report)
    return { report, consoleSummary: renderConsoleSummary(report) }
  }
}

function wait(durationMs: number, signal?: AbortSignal): Promise<void> {
  if (durationMs <= 0 || signal?.aborted === true) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, durationMs)
    signal?.addEventListener('abort', finish, { once: true })
  })
}
