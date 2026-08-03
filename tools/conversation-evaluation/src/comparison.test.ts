import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { RunReport, TestDefinition } from './contracts.js'
import {
  createModelComparisonReport,
  createModelRunDefinition,
  loadModelComparisonReport,
  modelRunKey,
  nextModelRunKey,
  renderModelComparisonSummary,
  upsertModelRun,
  writeModelComparisonSnapshot,
} from './comparison.js'

const definition: TestDefinition = {
  version: 1,
  name: 'Comparison test',
  scenarioId: 'scenario_1',
  initialAvatarId: 'avatar_1',
  models: ['openai/gpt-5.4', 'xai/grok-4.3'],
  questions: [{ question: 'Q1', expectedResponse: 'A1' }],
}

function report(model: string): RunReport {
  return {
    version: 1,
    testName: definition.name,
    scenarioId: definition.scenarioId,
    declaredModel: model,
    declaredJudgeModel: null,
    status: 'completed',
    sessionId: 'session_1',
    conversationId: 'conversation_1',
    startedAt: '2026-07-30T00:00:00.000Z',
    finishedAt: '2026-07-30T00:01:00.000Z',
    questions: [],
    summary: {
      questions: 1,
      evaluated: 1,
      passed: 1,
      partial: 0,
      failed: 0,
      passRate: 1,
      totalLatencyMs: 1,
      totalInputTokens: 10,
      totalOutputTokens: 10,
      totalTokens: 20,
      totalCostUsd: null,
      totalRunInputTokens: 10,
      totalRunOutputTokens: 10,
      totalRunTokens: 20,
      totalJudgeLatencyMs: 1,
      gameMasterUsage: {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        observedModels: [],
      },
      memoryUsage: {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        observedModels: [],
      },
      runtimeUsageStatus: 'complete',
      observedAvatarModels: [model],
      observedJudgeModels: [],
    },
    modelMismatches: [],
    error: null,
    costEstimate: {
      avatar: null,
      gameMaster: null,
      memory: null,
      totalCostUsd: null,
      unavailableModels: [],
    },
  }
}

// eslint-disable-next-line max-lines-per-function
describe('model comparison reports', () => {
  it('creates an independent run definition and stable run keys', () => {
    expect(createModelRunDefinition(definition, 'openai/gpt-5.4')).toEqual({
      version: 1,
      name: definition.name,
      scenarioId: definition.scenarioId,
      initialAvatarId: definition.initialAvatarId,
      questions: definition.questions,
      model: 'openai/gpt-5.4',
    })
    const secondRunKey = modelRunKey('openai/gpt-5.4', 1, 2)
    expect(secondRunKey).toBe('openai/gpt-5.4#2')
  })

  it('renders comparable pass and cost columns', () => {
    const comparison = createModelComparisonReport(definition, [
      { model: 'openai/gpt-5.4', report: report('openai/gpt-5.4') },
    ])
    expect(renderModelComparisonSummary(comparison)).toContain(
      'Model | Status | Passed | Partial | Failed | Pass rate | Estimated cost',
    )
    expect(renderModelComparisonSummary(comparison)).toContain('openai/gpt-5.4')
  })

  it('upserts a rerun while preserving models from the existing comparison', () => {
    const first = report('openai/gpt-5.4')
    const second = report('xai/grok-4.3')
    const comparison = createModelComparisonReport(definition, [
      { model: first.declaredModel ?? 'openai/gpt-5.4', report: first },
      { model: second.declaredModel ?? 'xai/grok-4.3', report: second },
    ])
    const rerun = { ...first, status: 'judge_error' as const }

    const updated = upsertModelRun(comparison, {
      model: 'openai/gpt-5.4',
      report: rerun,
    })

    expect(updated.runs).toHaveLength(2)
    expect(updated.runs[0]).toMatchObject({ model: 'openai/gpt-5.4', report: rerun })
    expect(updated.runs[1]).toMatchObject({ model: 'xai/grok-4.3', report: second })
  })

  it('keeps repeated runs of the same model as separate comparison entries', () => {
    const first = report('openai/gpt-5.4')
    const second = { ...first, sessionId: 'session_2' }
    const comparison = createModelComparisonReport(definition, [
      {
        model: 'openai/gpt-5.4',
        runKey: 'openai/gpt-5.4',
        report: first,
      },
      {
        model: 'openai/gpt-5.4',
        runKey: 'openai/gpt-5.4#2',
        report: second,
      },
    ])

    const rerun = { ...second, status: 'judge_error' as const }
    const updated = upsertModelRun(comparison, {
      model: 'openai/gpt-5.4',
      runKey: 'openai/gpt-5.4#2',
      report: rerun,
    })

    expect(updated.runs).toHaveLength(2)
    expect(updated.runs[0]?.report).toBe(first)
    expect(updated.runs[1]).toMatchObject({ runKey: 'openai/gpt-5.4#2', report: rerun })
  })

  it('allocates the next run key without replacing existing runs', () => {
    const first = report('openai/gpt-5.4')
    const second = { ...first, sessionId: 'session_2' }
    const comparison = createModelComparisonReport(definition, [
      {
        model: 'openai/gpt-5.4',
        report: first,
      },
      {
        model: 'openai/gpt-5.4',
        runKey: 'openai/gpt-5.4#2',
        report: second,
      },
    ])

    expect(nextModelRunKey('openai/gpt-5.4', [])).toBe('openai/gpt-5.4')
    expect(nextModelRunKey('openai/gpt-5.4', comparison.runs)).toBe('openai/gpt-5.4#3')
    expect(nextModelRunKey('xai/grok-4.3', comparison.runs)).toBe('xai/grok-4.3')
  })

  it('writes the comparison report for each progress snapshot', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-comparison-'))
    const comparisonPath = join(directory, 'comparison.json')
    const snapshot = report('openai/gpt-5.4')
    snapshot.finishedAt = null

    const updated = await writeModelComparisonSnapshot({
      comparisonOutputPath: comparisonPath,
      comparison: createModelComparisonReport(definition),
      model: 'openai/gpt-5.4',
      report: snapshot,
    })

    const storedComparison = JSON.parse(await readFile(comparisonPath, 'utf8')) as {
      runs: Array<{ report: RunReport }>
    }
    expect(storedComparison.runs[0]?.report.finishedAt).toBeNull()
    expect(updated.runs).toHaveLength(1)
    expect(updated.runs[0]?.report.finishedAt).toBeNull()
  })

  it('loads a valid existing comparison and returns null when it does not exist', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-comparison-'))
    const outputPath = join(directory, 'comparison.json')
    const comparison = createModelComparisonReport(definition, [
      { model: 'openai/gpt-5.4', report: report('openai/gpt-5.4') },
    ])
    await writeFile(outputPath, `${JSON.stringify(comparison)}\n`, 'utf8')

    await expect(loadModelComparisonReport(outputPath)).resolves.toEqual(comparison)
    await expect(loadModelComparisonReport(join(directory, 'missing.json'))).resolves.toBeNull()
    await expect(readFile(outputPath, 'utf8')).resolves.toContain('model_comparison')
  })

  it('rejects malformed existing comparison reports', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-comparison-'))
    const outputPath = join(directory, 'comparison.json')
    await writeFile(outputPath, '{"reportType":"run"}', 'utf8')

    await expect(loadModelComparisonReport(outputPath)).rejects.toThrow(
      'not a valid model comparison report',
    )
  })
})
