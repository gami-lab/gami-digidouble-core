import { basename, dirname, extname, join, resolve } from 'node:path'

import type {
  DeclaredModel,
  ModelComparisonReport,
  ModelComparisonRun,
  RunReport,
  TestDefinition,
} from './contracts.js'
import { writeJsonAtomically } from './report.js'

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

export function renderModelComparisonSummary(report: ModelComparisonReport): string {
  const lines = [
    `Model comparison: ${report.testName}`,
    'Model | Status | Passed | Partial | Failed | Pass rate | Estimated cost',
  ]
  report.runs.forEach(({ model, report: runReport }) => {
    const summary = runReport.summary
    const cost = runReport.costEstimate.avatar?.totalCostUsd ?? null
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
