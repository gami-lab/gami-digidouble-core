import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'

import type {
  DeclaredModel,
  ModelComparisonReport,
  ModelComparisonRun,
  RunReport,
  TestDefinition,
} from './contracts.js'
import { writeJsonAtomically, writeReportAtomically } from './report.js'

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

export function modelReportPath(outputPath: string, model: DeclaredModel): string {
  const targetPath = resolve(outputPath)
  const extension = extname(targetPath) || '.json'
  const stem = basename(targetPath, extension)
  const slug = model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return join(dirname(targetPath), `${stem}.${slug || 'model'}${extension}`)
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
  report: RunReport
  reportPath: string
}): Promise<ModelComparisonReport> {
  await writeReportAtomically(args.reportPath, args.report)
  const updatedComparison = upsertModelRun(
    args.comparison,
    modelRunEntry(args.model, args.report, args.reportPath),
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
  const existingIndex = report.runs.findIndex((run) => run.model === entry.model)
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
      typeof run['reportPath'] === 'string' &&
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
  report.runs.forEach(({ model, report: runReport }) => {
    const summary = runReport.summary
    const cost = runReport.costEstimate.totalCostUsd
    lines.push(
      `${model} | ${runReport.status} | ${String(summary.passed)} | ${String(summary.partial)} | ${String(summary.failed)} | ${summary.passRate === null ? 'n/a' : `${(summary.passRate * 100).toFixed(1)}%`} | ${cost === null ? 'unavailable' : `$${cost.toFixed(6)}`}`,
    )
  })
  return lines.join('\n')
}

export function modelRunEntry(
  model: DeclaredModel,
  report: RunReport,
  reportPath: string,
): ModelComparisonRun {
  return { model, report, reportPath }
}
