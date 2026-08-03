import { mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

import type {
  ConversationExecution,
  EvaluationError,
  HumanReview,
  ModelMismatch,
  QuestionResult,
  RunReport,
  RunCostEstimate,
  RunSummary,
  RuntimeRoleUsage,
  TestDefinition,
} from './contracts.js'
import { estimateTokenCost } from './pricing.js'
import { baseDeclaredModel } from './model-selection.js'
import { emptyRuntimeUsage, type RuntimeUsage } from './runtime-usage.js'

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function estimateRunCost(definition: TestDefinition, summary: RunSummary): RunCostEstimate {
  const avatarModel = definition.model ?? summary.observedAvatarModels[0]
  const avatar =
    avatarModel === undefined
      ? null
      : estimateTokenCost(avatarModel, summary.totalInputTokens, summary.totalOutputTokens)
  const gameMaster = estimateRoleCost(summary.gameMasterUsage)
  const memory = estimateRoleCost(summary.memoryUsage)
  const unavailableModels = unavailableCostModels(avatarModel, avatar, summary, gameMaster, memory)
  const totalCostUsd = canEstimateFullCost(summary, avatar, gameMaster, memory)
    ? avatar.totalCostUsd + (gameMaster?.totalCostUsd ?? 0) + (memory?.totalCostUsd ?? 0)
    : null
  return {
    avatar,
    gameMaster,
    memory,
    totalCostUsd,
    unavailableModels,
  }
}

function unavailableCostModels(
  avatarModel: string | undefined,
  avatar: RunCostEstimate['avatar'],
  summary: RunSummary,
  gameMaster: RunCostEstimate['gameMaster'],
  memory: RunCostEstimate['memory'],
): string[] {
  const models = avatar === null && avatarModel !== undefined ? [avatarModel] : []
  if (summary.runtimeUsageStatus !== 'complete') models.push('runtime-usage')
  appendUnavailableRole(models, 'game-master', summary.gameMasterUsage, gameMaster)
  appendUnavailableRole(models, 'memory', summary.memoryUsage, memory)
  return models
}

function canEstimateFullCost(
  summary: RunSummary,
  avatar: RunCostEstimate['avatar'],
  gameMaster: RunCostEstimate['gameMaster'],
  memory: RunCostEstimate['memory'],
): avatar is NonNullable<RunCostEstimate['avatar']> {
  return (
    summary.runtimeUsageStatus === 'complete' &&
    avatar !== null &&
    (summary.gameMasterUsage.calls === 0 || gameMaster !== null) &&
    (summary.memoryUsage.calls === 0 || memory !== null)
  )
}

function estimateRoleCost(usage: RuntimeRoleUsage) {
  if (usage.calls === 0 || usage.observedModels.length !== 1) return null
  return estimateTokenCost(usage.observedModels[0] ?? '', usage.inputTokens, usage.outputTokens)
}

function appendUnavailableRole(
  unavailableModels: string[],
  role: string,
  usage: RuntimeRoleUsage,
  estimate: ReturnType<typeof estimateRoleCost>,
): void {
  if (usage.calls === 0 || estimate !== null) return
  unavailableModels.push(...(usage.observedModels.length > 0 ? usage.observedModels : [role]))
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
  runtimeUsage: RuntimeUsage = emptyRuntimeUsage('pending'),
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
    totalRunInputTokens:
      sumMetrics(results, (result) => result.metrics?.inputTokens ?? 0) +
      runtimeUsage.gameMaster.inputTokens +
      runtimeUsage.memory.inputTokens,
    totalRunOutputTokens:
      sumMetrics(results, (result) => result.metrics?.outputTokens ?? 0) +
      runtimeUsage.gameMaster.outputTokens +
      runtimeUsage.memory.outputTokens,
    totalRunTokens:
      sumMetrics(results, (result) => result.metrics?.totalTokens ?? 0) +
      runtimeUsage.gameMaster.totalTokens +
      runtimeUsage.memory.totalTokens,
    totalJudgeLatencyMs: sumJudgeMetrics(results, (result) => result.judgeMetrics?.latencyMs ?? 0),
    gameMasterUsage: runtimeUsage.gameMaster,
    memoryUsage: runtimeUsage.memory,
    runtimeUsageStatus: runtimeUsage.status,
    observedAvatarModels: uniqueStrings(
      avatarResults.flatMap((result) => (result.metrics === null ? [] : [result.metrics.model])),
    ),
    observedJudgeModels: uniqueStrings(
      results.flatMap((result) => (result.judgeModel === null ? [] : [result.judgeModel])),
    ),
  }
}

export function applyHumanReview(
  report: RunReport,
  questionNumber: number,
  status: HumanReview['status'],
  reviewedAt: string = new Date().toISOString(),
): RunReport {
  const existingQuestion = report.questions.find(
    (question) => question.questionNumber === questionNumber,
  )
  if (existingQuestion === undefined) {
    throw new Error(`Question ${String(questionNumber)} was not found in the report.`)
  }
  const questions = report.questions.map((question) => {
    if (question.questionNumber !== questionNumber) return question
    return {
      ...question,
      humanReview: {
        status,
        originalStatus: question.humanReview?.originalStatus ?? toQualityOutcome(question.status),
        reviewedAt,
      },
      status,
    }
  })

  return {
    ...report,
    questions,
    summary: aggregateRunSummary(report.summary.questions, questions, {
      status: report.summary.runtimeUsageStatus,
      gameMaster: report.summary.gameMasterUsage,
      memory: report.summary.memoryUsage,
    }),
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
      baseDeclaredModel(definition.model) !== observedAvatarModel
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
      baseDeclaredModel(definition.judgeModel) !== result.judgeModel
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
  const summary = aggregateRunSummary(definition.questions.length, [], emptyRuntimeUsage('pending'))
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
    summary,
    modelMismatches: [],
    error: null,
    costEstimate: estimateRunCost(definition, summary),
  }
}

export function buildRunReport(options: {
  definition: TestDefinition
  startedAt: string
  finishedAt: string | null
  results: readonly QuestionResult[]
  runtimeUsage?: RuntimeUsage
  sessionId?: string | null
  conversationId?: string | null
  error?: EvaluationError | null
}): RunReport {
  const error = options.error ?? null
  const summary = aggregateRunSummary(
    options.definition.questions.length,
    options.results,
    options.runtimeUsage ?? emptyRuntimeUsage('pending'),
  )
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
    summary,
    modelMismatches: findModelMismatches(options.definition, options.results),
    error,
    costEstimate: estimateRunCost(options.definition, summary),
  }
}

export function buildReportFromExecution(
  definition: TestDefinition,
  startedAt: string,
  execution: ConversationExecution,
  finishedAt: string | null,
  runtimeUsage?: RuntimeUsage,
): RunReport {
  return buildRunReport({
    definition,
    startedAt,
    finishedAt,
    results: execution.results,
    ...(runtimeUsage === undefined ? {} : { runtimeUsage }),
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
  await writeJsonAtomically(outputPath, report)
}

export async function writeJsonAtomically(outputPath: string, value: unknown): Promise<void> {
  const targetPath = isAbsolute(outputPath) ? outputPath : resolve(outputPath)
  const targetDirectory = dirname(targetPath)
  const temporaryPath = join(
    targetDirectory,
    `.${basename(targetPath)}.${String(process.pid)}.${randomUUID()}.tmp`,
  )
  try {
    await mkdir(targetDirectory, { recursive: true })
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
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
    `Totals: ${String(report.summary.totalRunTokens)} tokens | cost=${report.costEstimate.totalCostUsd === null ? 'unavailable' : String(report.costEstimate.totalCostUsd)}`,
    `Usage: Avatar ${String(report.summary.totalTokens)} · Game Master ${String(report.summary.gameMasterUsage.totalTokens)} · Memory ${String(report.summary.memoryUsage.totalTokens)}`,
    `Judge latency: ${String(report.summary.totalJudgeLatencyMs)}ms`,
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

function toQualityOutcome(status: QuestionResult['status']): HumanReview['status'] {
  if (status === 'passed' || status === 'partial' || status === 'failed') return status
  throw new Error('Only judged questions can receive a human review.')
}
