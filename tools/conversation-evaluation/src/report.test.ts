import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { QuestionResult, TestDefinition } from './contracts.js'
import {
  aggregateRunSummary,
  applyHumanReview,
  renderConsoleSummary,
  writeReportAtomically,
  createRunReport,
  buildRunReport,
} from './report.js'
import { emptyRuntimeUsage } from './runtime-usage.js'

const definition: TestDefinition = {
  version: 1,
  name: 'Report test',
  scenarioId: 'scenario_1',
  initialAvatarId: 'avatar_1',
  model: 'declared-avatar',
  judgeModel: 'declared-judge',
  questions: [
    { question: 'Q1', expectedResponse: 'E1' },
    { question: 'Q2', expectedResponse: 'E2' },
    { question: 'Q3', expectedResponse: 'E3' },
  ],
}

// eslint-disable-next-line complexity
function result(
  questionNumber: number,
  status: QuestionResult['status'],
  costUsd: number | undefined,
): QuestionResult {
  return {
    questionNumber,
    question: `Q${String(questionNumber)}`,
    expectedResponse: `E${String(questionNumber)}`,
    actualResponse: status === 'api_error' ? null : 'answer',
    sessionId: 'session_1',
    conversationId: 'conversation_1',
    avatarId: 'avatar_1',
    metrics:
      status === 'api_error'
        ? null
        : {
            model: 'observed-avatar',
            latencyMs: 10,
            inputTokens: 2,
            outputTokens: 3,
            totalTokens: 5,
            costUsd: costUsd ?? null,
          },
    judgeMetrics:
      status === 'passed' || status === 'partial' || status === 'failed'
        ? {
            model: 'observed-judge',
            latencyMs: 8,
          }
        : null,
    judgeModel: status === 'judge_error' ? null : 'observed-judge',
    judge:
      status === 'passed' || status === 'partial' || status === 'failed'
        ? {
            passed: status === 'passed',
            score: status === 'passed' ? 5 : status === 'partial' ? 3 : 2,
            reason: status === 'partial' ? 'Only the main event is correct.' : 'Reason',
            missingElements: status === 'partial' ? ['the date'] : [],
            contradictions: status === 'partial' ? ['claims the wrong witness'] : [],
          }
        : null,
    status,
    error:
      status === 'api_error'
        ? { kind: 'api_error', message: 'API failed.' }
        : status === 'judge_error'
          ? { kind: 'judge_error', message: 'Judge failed.' }
          : null,
  }
}

// eslint-disable-next-line max-lines-per-function
describe('evaluation reports', () => {
  it('uses evaluated judge results as the pass-rate denominator', () => {
    const results = [
      result(1, 'passed', 0.1),
      result(2, 'failed', 0.2),
      result(3, 'judge_error', 0.3),
    ]
    expect(aggregateRunSummary(3, results)).toMatchObject({
      questions: 3,
      evaluated: 2,
      passed: 1,
      partial: 0,
      failed: 1,
      passRate: 0.5,
      totalLatencyMs: 30,
      totalTokens: 15,
      totalJudgeLatencyMs: 16,
    })
    expect(aggregateRunSummary(3, results).totalCostUsd).toBeCloseTo(0.6)
  })

  it('counts score-three results as partial without passing them', () => {
    expect(aggregateRunSummary(1, [result(1, 'partial', 0.1)])).toMatchObject({
      evaluated: 1,
      passed: 0,
      partial: 1,
      failed: 0,
      passRate: 0,
    })
  })

  it('recomputes statistics while retaining the original judge outcome', () => {
    const report = buildRunReport({
      definition: { ...definition, questions: definition.questions.slice(0, 2) },
      startedAt: '2026-07-29T00:00:00.000Z',
      finishedAt: '2026-07-29T00:01:00.000Z',
      results: [result(1, 'failed', 0.1), result(2, 'passed', 0.1)],
    })

    const reviewed = applyHumanReview(report, 1, 'passed', '2026-07-29T00:02:00.000Z')

    expect(report.questions[0]?.status).toBe('failed')
    expect(reviewed.questions[0]).toMatchObject({
      status: 'passed',
      humanReview: {
        status: 'passed',
        originalStatus: 'failed',
        reviewedAt: '2026-07-29T00:02:00.000Z',
      },
    })
    expect(reviewed.summary).toMatchObject({ passed: 2, partial: 0, failed: 0, passRate: 1 })
  })

  it('keeps cost unavailable when any successful Avatar response omits cost', () => {
    const results = [result(1, 'passed', undefined), result(2, 'passed', 0.2)]
    expect(aggregateRunSummary(2, results).totalCostUsd).toBeNull()
    expect(aggregateRunSummary(2, []).passRate).toBeNull()
  })

  // eslint-disable-next-line complexity
  it('includes Avatar, Game Master, and memory usage while excluding judge cost', () => {
    const runtimeUsage = emptyRuntimeUsage('complete')
    runtimeUsage.gameMaster = {
      calls: 1,
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      observedModels: ['openai/gpt-5.4'],
    }
    runtimeUsage.memory = {
      calls: 1,
      inputTokens: 4,
      outputTokens: 6,
      totalTokens: 10,
      observedModels: ['openai/gpt-5.4'],
    }
    const report = buildRunReport({
      definition: { ...definition, model: 'openai/gpt-5.4', judgeModel: 'unknown/judge' },
      startedAt: '2026-07-29T00:00:00.000Z',
      finishedAt: '2026-07-29T00:01:00.000Z',
      results: [result(1, 'passed', 0.1)],
      runtimeUsage,
    })

    expect(report.summary.totalRunTokens).toBe(30)
    expect(
      (report.costEstimate.gameMaster?.inputTokens ?? 0) +
        (report.costEstimate.gameMaster?.outputTokens ?? 0),
    ).toBe(15)
    expect(
      (report.costEstimate.memory?.inputTokens ?? 0) +
        (report.costEstimate.memory?.outputTokens ?? 0),
    ).toBe(10)
    expect(report.costEstimate.totalCostUsd).toBe(
      (report.costEstimate.avatar?.totalCostUsd ?? 0) +
        (report.costEstimate.gameMaster?.totalCostUsd ?? 0) +
        (report.costEstimate.memory?.totalCostUsd ?? 0),
    )
    expect(report.costEstimate).not.toHaveProperty('judge')
  })

  it('writes a valid atomically replaced JSON report and renders a bounded summary', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-report-'))
    const outputPath = join(directory, 'nested', 'report.json')
    const report = buildRunReport({
      definition,
      startedAt: '2026-07-29T00:00:00.000Z',
      finishedAt: '2026-07-29T00:01:00.000Z',
      results: [result(1, 'passed', 0.1)],
      sessionId: 'session_1',
      conversationId: 'conversation_1',
    })
    await writeReportAtomically(outputPath, report)
    const written = JSON.parse(await readFile(outputPath, 'utf8')) as typeof report
    expect(written).toEqual(report)
    const summary = renderConsoleSummary(report)
    expect(summary).toContain('Question 1: passed | score=5')
    expect(summary).toContain('Reason: Reason')
    expect(summary).toContain('Judge latency:')
    expect(summary).not.toContain('Judge totals:')
    expect(summary).not.toContain('What happened')
    expect(summary).not.toContain('answer')
  })

  it('keeps the full cost unavailable until runtime usage is collected', () => {
    const report = buildRunReport({
      definition: {
        ...definition,
        model: 'openai/gpt-5.4',
        judgeModel: 'unknown/judge',
      },
      startedAt: '2026-07-29T00:00:00.000Z',
      finishedAt: '2026-07-29T00:01:00.000Z',
      results: [result(1, 'passed', 0.1)],
    })

    expect(report.costEstimate).not.toHaveProperty('judge')
    expect(report.costEstimate.avatar?.totalCostUsd).toBeGreaterThan(0)
    expect(report.costEstimate.totalCostUsd).toBeNull()
    expect(report.costEstimate.unavailableModels).toContain('runtime-usage')
  })

  it('creates a stable initial report with nullable execution identifiers', () => {
    expect(createRunReport(definition, '2026-07-29T00:00:00.000Z')).toMatchObject({
      sessionId: null,
      conversationId: null,
      finishedAt: null,
      summary: { questions: 3, evaluated: 0, passRate: null },
    })
  })
})
