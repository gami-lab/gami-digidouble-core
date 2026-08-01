import { describe, expect, it } from 'vitest'

import type { RunReport, TestDefinition } from './contracts.js'
import {
  createModelComparisonReport,
  createModelRunDefinition,
  modelReportPath,
  renderModelComparisonSummary,
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

describe('model comparison reports', () => {
  it('creates an independent run definition and deterministic report path', () => {
    expect(createModelRunDefinition(definition, 'openai/gpt-5.4')).toEqual({
      version: 1,
      name: definition.name,
      scenarioId: definition.scenarioId,
      initialAvatarId: definition.initialAvatarId,
      questions: definition.questions,
      model: 'openai/gpt-5.4',
    })
    expect(modelReportPath('./evaluation-report.json', 'openai/gpt-5.4')).toContain(
      'evaluation-report.openai-gpt-5-4.json',
    )
  })

  it('renders comparable pass and cost columns', () => {
    const comparison = createModelComparisonReport(definition, [
      { model: 'openai/gpt-5.4', report: report('openai/gpt-5.4'), reportPath: 'one.json' },
    ])
    expect(renderModelComparisonSummary(comparison)).toContain(
      'Model | Status | Passed | Partial | Failed | Pass rate | Estimated cost',
    )
    expect(renderModelComparisonSummary(comparison)).toContain('openai/gpt-5.4')
  })
})
