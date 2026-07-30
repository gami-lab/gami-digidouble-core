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

export type EvaluationRunInput = {
  definition: TestDefinition
  userId: string
  avatarClient: CoreApiClient
  judgeClient: SemanticJudgeClient
  outputPath?: string
  signal?: AbortSignal
  startedAt?: string
  now?: () => string
  writeReport?: (report: RunReport) => Promise<void>
}

export type EvaluationRunOutput = {
  report: RunReport
  consoleSummary: string
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

async function judgeQuestion(
  judgeClient: SemanticJudgeClient,
  result: QuestionResult,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (result.status !== 'completed' || result.actualResponse === null) return
  try {
    const evaluation = await judgeClient.evaluate(
      {
        question: result.question,
        expectedResponse: result.expectedResponse,
        actualResponse: result.actualResponse,
      },
      signal === undefined ? undefined : { signal },
    )
    result.judge = evaluation.result
    result.judgeModel = evaluation.metrics.model
    result.judgeMetrics = evaluation.metrics
    result.status = evaluation.result.passed ? 'passed' : 'failed'
    result.error = null
  } catch (error: unknown) {
    result.status = 'judge_error'
    result.judge = null
    result.judgeModel = null
    result.judgeMetrics = null
    result.error = toEvaluationError(error, 'judge_error')
  }
}

export async function runEvaluation(input: EvaluationRunInput): Promise<EvaluationRunOutput> {
  const startedAt = input.startedAt ?? new Date().toISOString()
  const now = input.now ?? (() => new Date().toISOString())
  const writeReport =
    input.writeReport ??
    (input.outputPath === undefined
      ? (): Promise<void> => Promise.resolve()
      : (report: RunReport): Promise<void> =>
          writeReportAtomically(input.outputPath as string, report))

  let report = createRunReport(input.definition, startedAt)
  await writeReport(report)

  try {
    const execution = await runSequentialConversation(input.avatarClient, {
      definition: input.definition,
      userId: input.userId,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      onResult: async (result) => {
        await judgeQuestion(input.judgeClient, result, input.signal)
        report = buildRunReport({
          definition: input.definition,
          startedAt,
          finishedAt: null,
          results: [...report.questions, result],
          sessionId: result.sessionId,
          conversationId: result.conversationId,
        })
        await writeReport(report)
      },
    })
    report = buildReportFromExecution(input.definition, startedAt, execution, now())
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
