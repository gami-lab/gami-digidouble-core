import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { QuestionResult, TestDefinition } from './contracts.js'
import {
  aggregateRunSummary,
  renderConsoleSummary,
  writeReportAtomically,
  createRunReport,
  buildRunReport,
} from './report.js'

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
    judgeModel: status === 'judge_error' ? null : 'observed-judge',
    judge:
      status === 'passed' || status === 'failed'
        ? {
            passed: status === 'passed',
            score: status === 'passed' ? 5 : 2,
            reason: 'Reason',
            missingElements: [],
            contradictions: [],
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
      failed: 1,
      passRate: 0.5,
      totalLatencyMs: 30,
      totalTokens: 15,
    })
    expect(aggregateRunSummary(3, results).totalCostUsd).toBeCloseTo(0.6)
  })

  it('keeps cost unavailable when any successful Avatar response omits cost', () => {
    const results = [result(1, 'passed', undefined), result(2, 'passed', 0.2)]
    expect(aggregateRunSummary(2, results).totalCostUsd).toBeNull()
    expect(aggregateRunSummary(2, []).passRate).toBeNull()
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
    expect(summary).not.toContain('What happened')
    expect(summary).not.toContain('answer')
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
