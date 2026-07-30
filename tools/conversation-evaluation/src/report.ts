import { mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

import type {
  ConversationExecution,
  EvaluationError,
  ModelMismatch,
  QuestionResult,
  RunReport,
  RunSummary,
  TestDefinition,
} from './contracts.js'

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function sumMetrics(
  results: readonly QuestionResult[],
  selector: (result: QuestionResult) => number,
): number {
  return results.reduce((total, result) => {
    return result.metrics === null ? total : total + selector(result)
  }, 0)
}

function sumJudgeMetrics(
  results: readonly QuestionResult[],
  selector: (result: QuestionResult) => number,
): number {
  return results.reduce((total, result) => {
    return result.judgeMetrics === null ? total : total + selector(result)
  }, 0)
}

export function aggregateRunSummary(
  questionCount: number,
  results: readonly QuestionResult[],
): RunSummary {
  const evaluated = results.filter((result) => result.judge !== null).length
  const passed = results.filter((result) => result.status === 'passed').length
  const partial = results.filter((result) => result.status === 'partial').length
  const failed = results.filter((result) => result.status === 'failed').length
  const avatarResults = results.filter((result) => result.metrics !== null)
  const hasCompleteAvatarCost =
    questionCount > 0 &&
    results.length === questionCount &&
    results.every((result) => result.metrics !== null && result.metrics.costUsd !== null)

  return {
    questions: questionCount,
    evaluated,
    passed,
    partial,
    failed,
    passRate: evaluated === 0 ? null : passed / evaluated,
    totalLatencyMs: sumMetrics(results, (result) => result.metrics?.latencyMs ?? 0),
    totalInputTokens: sumMetrics(results, (result) => result.metrics?.inputTokens ?? 0),
    totalOutputTokens: sumMetrics(results, (result) => result.metrics?.outputTokens ?? 0),
    totalTokens: sumMetrics(results, (result) => result.metrics?.totalTokens ?? 0),
    totalCostUsd: hasCompleteAvatarCost
      ? avatarResults.reduce((total, result) => total + (result.metrics?.costUsd ?? 0), 0)
      : null,
    totalJudgeLatencyMs: sumJudgeMetrics(results, (result) => result.judgeMetrics?.latencyMs ?? 0),
    totalJudgeInputTokens: sumJudgeMetrics(
      results,
      (result) => result.judgeMetrics?.inputTokens ?? 0,
    ),
    totalJudgeOutputTokens: sumJudgeMetrics(
      results,
      (result) => result.judgeMetrics?.outputTokens ?? 0,
    ),
    totalJudgeTokens: sumJudgeMetrics(results, (result) => result.judgeMetrics?.totalTokens ?? 0),
    observedAvatarModels: uniqueStrings(
      avatarResults.flatMap((result) => (result.metrics === null ? [] : [result.metrics.model])),
    ),
    observedJudgeModels: uniqueStrings(
      results.flatMap((result) => (result.judgeModel === null ? [] : [result.judgeModel])),
    ),
  }
}

function findModelMismatches(
  definition: TestDefinition,
  results: readonly QuestionResult[],
): ModelMismatch[] {
  const mismatches: ModelMismatch[] = []
  results.forEach((result) => {
    const observedAvatarModel = result.metrics?.model
    if (
      definition.model !== undefined &&
      observedAvatarModel !== undefined &&
      definition.model !== observedAvatarModel
    ) {
      mismatches.push({
        role: 'avatar',
        questionNumber: result.questionNumber,
        declaredModel: definition.model,
        observedModel: observedAvatarModel,
      })
    }
    if (
      definition.judgeModel !== undefined &&
      result.judgeModel !== null &&
      definition.judgeModel !== result.judgeModel
    ) {
      mismatches.push({
        role: 'judge',
        questionNumber: result.questionNumber,
        declaredModel: definition.judgeModel,
        observedModel: result.judgeModel,
      })
    }
  })
  return mismatches
}

function reportStatus(
  results: readonly QuestionResult[],
  error: EvaluationError | null,
): RunReport['status'] {
  if (error?.kind === 'api_error' || results.some((result) => result.status === 'api_error')) {
    return 'api_error'
  }
  if (error?.kind === 'judge_error' || results.some((result) => result.status === 'judge_error')) {
    return 'judge_error'
  }
  return 'completed'
}

export function createRunReport(definition: TestDefinition, startedAt: string): RunReport {
  return {
    version: 1,
    testName: definition.name,
    scenarioId: definition.scenarioId,
    declaredModel: definition.model ?? null,
    declaredJudgeModel: definition.judgeModel ?? null,
    status: 'completed',
    sessionId: null,
    conversationId: null,
    startedAt,
    finishedAt: null,
    questions: [],
    summary: aggregateRunSummary(definition.questions.length, []),
    modelMismatches: [],
    error: null,
  }
}

export function buildRunReport(options: {
  definition: TestDefinition
  startedAt: string
  finishedAt: string | null
  results: readonly QuestionResult[]
  sessionId?: string | null
  conversationId?: string | null
  error?: EvaluationError | null
}): RunReport {
  const error = options.error ?? null
  return {
    version: 1,
    testName: options.definition.name,
    scenarioId: options.definition.scenarioId,
    declaredModel: options.definition.model ?? null,
    declaredJudgeModel: options.definition.judgeModel ?? null,
    status: reportStatus(options.results, error),
    sessionId: options.sessionId ?? null,
    conversationId: options.conversationId ?? null,
    startedAt: options.startedAt,
    finishedAt: options.finishedAt,
    questions: [...options.results],
    summary: aggregateRunSummary(options.definition.questions.length, options.results),
    modelMismatches: findModelMismatches(options.definition, options.results),
    error,
  }
}

export function buildReportFromExecution(
  definition: TestDefinition,
  startedAt: string,
  execution: ConversationExecution,
  finishedAt: string | null,
): RunReport {
  return buildRunReport({
    definition,
    startedAt,
    finishedAt,
    results: execution.results,
    sessionId: execution.sessionId,
    conversationId: execution.conversationId,
  })
}

export class ReportWriteError extends Error {
  constructor() {
    super('Unable to write the evaluation report.')
    this.name = 'ReportWriteError'
  }
}

export async function writeReportAtomically(outputPath: string, report: RunReport): Promise<void> {
  const targetPath = isAbsolute(outputPath) ? outputPath : resolve(outputPath)
  const targetDirectory = dirname(targetPath)
  const temporaryPath = join(
    targetDirectory,
    `.${basename(targetPath)}.${String(process.pid)}.${randomUUID()}.tmp`,
  )
  try {
    await mkdir(targetDirectory, { recursive: true })
    await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, targetPath)
  } catch {
    try {
      await unlink(temporaryPath)
    } catch {
      // The temporary file may not have been created or may already have been renamed.
    }
    throw new ReportWriteError()
  }
}

export function renderConsoleSummary(report: RunReport): string {
  const lines = [
    `Evaluation: ${report.testName}`,
    `Status: ${report.status} | Questions: ${String(report.summary.questions)} | Evaluated: ${String(report.summary.evaluated)} | Passed: ${String(report.summary.passed)} | Partial: ${String(report.summary.partial)} | Failed: ${String(report.summary.failed)}`,
    `Pass rate: ${report.summary.passRate === null ? 'n/a' : `${(report.summary.passRate * 100).toFixed(1)}%`}`,
    `Avatar model: declared=${report.declaredModel ?? 'n/a'} observed=${report.summary.observedAvatarModels.join(', ') || 'n/a'}`,
    `Judge model: declared=${report.declaredJudgeModel ?? 'n/a'} observed=${report.summary.observedJudgeModels.join(', ') || 'n/a'}`,
  ]
  report.questions.forEach((question) => {
    const score = question.judge === null ? 'n/a' : String(question.judge.score)
    const metrics =
      question.metrics === null
        ? 'no Avatar metrics'
        : `${String(question.metrics.latencyMs)}ms/${String(question.metrics.totalTokens)} tokens`
    lines.push(
      `Question ${String(question.questionNumber)}: ${question.status} | score=${score} | ${metrics}`,
    )
    if (question.judge !== null) {
      lines.push(`  Reason: ${singleLine(question.judge.reason)}`)
      if (question.judge.missingElements.length > 0) {
        lines.push(`  Missing: ${question.judge.missingElements.map(singleLine).join('; ')}`)
      }
      if (question.judge.contradictions.length > 0) {
        lines.push(`  Contradictions: ${question.judge.contradictions.map(singleLine).join('; ')}`)
      }
    }
  })
  lines.push(
    `Totals: ${String(report.summary.totalLatencyMs)}ms/${String(report.summary.totalTokens)} tokens | cost=${report.summary.totalCostUsd === null ? 'unavailable' : String(report.summary.totalCostUsd)}`,
    `Judge totals: ${String(report.summary.totalJudgeLatencyMs)}ms/${String(report.summary.totalJudgeTokens)} tokens`,
  )
  if (report.modelMismatches.length > 0) {
    lines.push(`Model mismatches: ${String(report.modelMismatches.length)}`)
  }
  if (report.error !== null) lines.push(`Error: ${report.error.message}`)
  return lines.join('\n')
}

function singleLine(value: string): string {
  const normalized = value.replace(/[\r\n\t]+/g, ' ').trim()
  return normalized.length <= 300 ? normalized : `${normalized.slice(0, 299)}…`
}
