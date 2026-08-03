import { readFile } from 'node:fs/promises'

import type {
  DeclaredModel,
  ModelComparisonReport,
  ModelComparisonRun,
  RunReport,
  TestDefinition,
} from './contracts.js'
import { writeJsonAtomically } from './report.js'

export class ModelComparisonReportLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelComparisonReportLoadError'
  }
}

export function createModelRunDefinition(
  definition: TestDefinition,
  model: DeclaredModel,
): TestDefinition {
  const baseDefinition = { ...definition }
  delete baseDefinition.models
  return { ...baseDefinition, model }
}

export function modelRunKey(
  model: DeclaredModel,
  occurrence: number,
  totalOccurrences: number,
): string {
  return totalOccurrences > 1 && occurrence > 0 ? `${model}#${String(occurrence + 1)}` : model
}

export function nextModelRunKey(
  model: DeclaredModel,
  existingRuns: readonly ModelComparisonRun[],
): string {
  const highestOccurrence = existingRuns.reduce((highest, run) => {
    if (run.model !== model) return highest
    return Math.max(highest, runOccurrence(run))
  }, 0)
  const nextOccurrence = highestOccurrence + 1
  return nextOccurrence === 1 ? model : `${model}#${String(nextOccurrence)}`
}

export function createModelComparisonReport(
  definition: TestDefinition,
  runs: readonly ModelComparisonRun[] = [],
): ModelComparisonReport {
  return {
    version: 1,
    reportType: 'model_comparison',
    testName: definition.name,
    scenarioId: definition.scenarioId,
    generatedAt: new Date().toISOString(),
    runs: [...runs],
  }
}

export async function writeModelComparisonReport(
  outputPath: string,
  report: ModelComparisonReport,
): Promise<void> {
  await writeJsonAtomically(outputPath, report)
}

export async function writeModelComparisonSnapshot(args: {
  comparisonOutputPath: string
  comparison: ModelComparisonReport
  model: DeclaredModel
  runKey?: string
  report: RunReport
}): Promise<ModelComparisonReport> {
  const updatedComparison = upsertModelRun(
    args.comparison,
    modelRunEntry(args.model, args.report, args.runKey),
  )
  await writeModelComparisonReport(args.comparisonOutputPath, updatedComparison)
  return updatedComparison
}

export async function loadModelComparisonReport(
  outputPath: string,
): Promise<ModelComparisonReport | null> {
  let content: string
  try {
    content = await readFile(outputPath, 'utf8')
  } catch (error: unknown) {
    if (isFileNotFound(error)) return null
    throw new ModelComparisonReportLoadError('Unable to read the existing comparison report.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new ModelComparisonReportLoadError('The existing comparison report is invalid JSON.')
  }
  if (!isModelComparisonReport(parsed)) {
    throw new ModelComparisonReportLoadError(
      'The existing output is not a valid model comparison report.',
    )
  }
  return parsed
}

export function upsertModelRun(
  report: ModelComparisonReport,
  entry: ModelComparisonRun,
): ModelComparisonReport {
  const entryKey = entry.runKey ?? entry.model
  const existingIndex = report.runs.findIndex((run) => (run.runKey ?? run.model) === entryKey)
  const runs = [...report.runs]
  if (existingIndex >= 0) runs[existingIndex] = entry
  else runs.push(entry)
  return { ...report, generatedAt: new Date().toISOString(), runs }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function isModelComparisonReport(value: unknown): value is ModelComparisonReport {
  if (!isRecord(value)) return false
  if (
    value['version'] !== 1 ||
    value['reportType'] !== 'model_comparison' ||
    typeof value['testName'] !== 'string' ||
    typeof value['scenarioId'] !== 'string' ||
    typeof value['generatedAt'] !== 'string' ||
    !Array.isArray(value['runs'])
  ) {
    return false
  }
  return value['runs'].every((run) => {
    if (!isRecord(run)) return false
    return (
      typeof run['model'] === 'string' &&
      (run['runKey'] === undefined || typeof run['runKey'] === 'string') &&
      (run['reportPath'] === undefined || typeof run['reportPath'] === 'string') &&
      isRecord(run['report'])
    )
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function renderModelComparisonSummary(report: ModelComparisonReport): string {
  const lines = [
    `Model comparison: ${report.testName}`,
    'Model | Status | Passed | Partial | Failed | Pass rate | Estimated cost',
  ]
  report.runs.forEach((run) => {
    const { report: runReport } = run
    const summary = runReport.summary
    const cost = runReport.costEstimate.totalCostUsd
    lines.push(
      `${modelRunLabel(run)} | ${runReport.status} | ${String(summary.passed)} | ${String(summary.partial)} | ${String(summary.failed)} | ${summary.passRate === null ? 'n/a' : `${(summary.passRate * 100).toFixed(1)}%`} | ${cost === null ? 'unavailable' : `$${cost.toFixed(6)}`}`,
    )
  })
  return lines.join('\n')
}

export function modelRunEntry(
  model: DeclaredModel,
  report: RunReport,
  runKey?: string,
): ModelComparisonRun {
  return {
    model,
    ...(runKey !== undefined ? { runKey } : {}),
    report,
  }
}

function modelRunLabel(run: ModelComparisonRun): string {
  if (run.runKey === undefined || run.runKey === run.model) return run.model
  return `${run.model} (run ${run.runKey.slice(run.model.length + 1)})`
}

function runOccurrence(run: ModelComparisonRun): number {
  if (run.runKey === undefined || run.runKey === run.model) return 1
  const suffix = run.runKey.slice(run.model.length + 1)
  const occurrence = Number.parseInt(suffix, 10)
  return Number.isInteger(occurrence) && occurrence > 1 ? occurrence : 1
}
