import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { QuestionResult, TestDefinition } from './contracts.js'
import { buildRunReport } from './report.js'
import { startReportViewer } from './viewer.js'

const definition: TestDefinition = {
  version: 1,
  name: 'Viewer test',
  scenarioId: 'scenario_1',
  initialAvatarId: 'avatar_1',
  model: 'openai/gpt-5.4',
  questions: [{ question: 'Q1', expectedResponse: 'A1' }],
}

const question: QuestionResult = {
  questionNumber: 1,
  question: 'Q1',
  expectedResponse: 'A1',
  actualResponse: 'answer',
  sessionId: 'session_1',
  conversationId: 'conversation_1',
  avatarId: 'avatar_1',
  metrics: {
    model: 'openai/gpt-5.4',
    latencyMs: 10,
    inputTokens: 2,
    outputTokens: 3,
    totalTokens: 5,
    costUsd: 0.1,
  },
  judgeModel: 'openai/gpt-5.4-mini',
  judgeMetrics: { model: 'openai/gpt-5.4-mini', latencyMs: 5 },
  judge: {
    passed: true,
    score: 5,
    reason: 'Correct.',
    missingElements: [],
    contradictions: [],
  },
  status: 'passed',
  error: null,
}

function createViewerReport() {
  return buildRunReport({
    definition,
    startedAt: '2026-07-29T00:00:00.000Z',
    finishedAt: '2026-07-29T00:01:00.000Z',
    results: [question],
  })
}

// eslint-disable-next-line max-lines-per-function
describe('report viewer', () => {
  it('serves the dashboard and the current report without exposing other paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-viewer-'))
    const reportPath = join(directory, 'evaluation-report.json')
    await writeFile(reportPath, JSON.stringify({ testName: 'Viewer test', questions: [] }), 'utf8')
    const viewer = await startReportViewer({ reportPath, port: 0 })

    try {
      const page = await fetch(viewer.url)
      expect(page.status).toBe(200)
      const pageHtml = await page.text()
      expect(pageHtml).toContain('Conversation evaluation report')
      expect(pageHtml).toContain('Model comparison')
      expect(pageHtml).toContain('Provider comparison')
      expect(pageHtml).toContain('modelNameOf')
      expect(pageHtml).toContain('Question difficulty')
      expect(pageHtml).toContain('across models')
      expect(pageHtml).toContain('Questions')
      expect(pageHtml).toContain('selectedQuestion')
      expect(pageHtml).toContain("selectedQuestion = '1'")
      expect(pageHtml).toContain('overviewFilter')
      expect(pageHtml).toContain('questionFilter')
      expect(pageHtml).toContain("activeTab === 'overview'")
      expect(pageHtml).toContain("activeTab === 'questions'")
      expect(pageHtml).toContain('Sort by ')
      expect(pageHtml).toContain('modelSortColumn')
      expect(pageHtml).toContain('questionSortState')
      expect(pageHtml).toContain('Print current model')
      expect(pageHtml).toContain('Print all models')
      expect(pageHtml).toContain('Download corrected JSON')
      expect(pageHtml).toContain('Correct judge:')
      expect(pageHtml).toContain('humanReview.originalStatus')
      expect(pageHtml).not.toContain('Refresh now')
      expect(pageHtml).toContain('reportFingerprint')
      expect(pageHtml).toContain('@media print')
      expect(pageHtml).not.toContain('totalJudgeTokens')
      expect(pageHtml).toContain('avatarCost')
      expect(pageHtml).toContain('gameMasterUsage')
      expect(pageHtml).toContain('memoryUsage')
      expect(pageHtml).toContain('runCost')
      expect(pageHtml).toContain('Tokens (send/receive)')
      expect(pageHtml).toContain('Median latency')
      expect(pageHtml).toContain('P90 latency')
      expect(pageHtml).not.toContain('Max latency')
      expect(pageHtml).toContain('latencyStats')
      expect(pageHtml).toContain('cents')
      expect(pageHtml).toContain("run.report.status === 'completed'")

      const report = await fetch(`${viewer.url}/report.json`)
      expect(report.status).toBe(200)
      await expect(report.json()).resolves.toEqual({ testName: 'Viewer test', questions: [] })

      const missing = await fetch(`${viewer.url}/missing`)
      expect(missing.status).toBe(404)
    } finally {
      await viewer.close()
    }
  })

  it('reads updated report content on each request for incremental runs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-viewer-'))
    const reportPath = join(directory, 'evaluation-report.json')
    await writeFile(reportPath, JSON.stringify({ status: 'completed', questions: [] }), 'utf8')
    const viewer = await startReportViewer({ reportPath, port: 0 })

    try {
      await writeFile(
        reportPath,
        JSON.stringify({ status: 'api_error', questions: [{ status: 'api_error' }] }),
        'utf8',
      )
      await expect((await fetch(`${viewer.url}/report.json`)).json()).resolves.toEqual({
        status: 'api_error',
        questions: [{ status: 'api_error' }],
      })
    } finally {
      await viewer.close()
    }
  })

  it('persists a human review and recomputed statistics for a single report', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-viewer-'))
    const reportPath = join(directory, 'evaluation-report.json')
    await writeFile(reportPath, JSON.stringify(createViewerReport()), 'utf8')
    const viewer = await startReportViewer({ reportPath, port: 0 })

    try {
      const response = await fetch(`${viewer.url}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionNumber: 1, status: 'failed' }),
      })
      expect(response.status).toBe(200)
      const saved = JSON.parse(await readFile(reportPath, 'utf8')) as ReturnType<
        typeof createViewerReport
      >
      expect(saved.questions[0]).toMatchObject({
        status: 'failed',
        humanReview: { status: 'failed', originalStatus: 'passed' },
      })
      expect(saved.summary).toMatchObject({ passed: 0, failed: 1, passRate: 0 })
    } finally {
      await viewer.close()
    }
  })

  it('persists a human review in both comparison and model reports', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'conversation-evaluation-viewer-'))
    const reportPath = join(directory, 'evaluation-report.json')
    const modelReportPath = join(directory, 'model.json')
    const runReport = createViewerReport()
    const comparison = {
      version: 1 as const,
      reportType: 'model_comparison' as const,
      testName: definition.name,
      scenarioId: definition.scenarioId,
      generatedAt: '2026-07-29T00:00:00.000Z',
      runs: [
        {
          model: 'openai/gpt-5.4',
          runKey: 'openai/gpt-5.4',
          report: runReport,
          reportPath: modelReportPath,
        },
      ],
    }
    await writeFile(reportPath, JSON.stringify(comparison), 'utf8')
    await writeFile(modelReportPath, JSON.stringify(runReport), 'utf8')
    const viewer = await startReportViewer({ reportPath, port: 0 })

    try {
      const response = await fetch(`${viewer.url}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runKey: 'openai/gpt-5.4', questionNumber: 1, status: 'partial' }),
      })
      expect(response.status).toBe(200)
      const savedComparison = JSON.parse(await readFile(reportPath, 'utf8')) as typeof comparison
      const savedModel = JSON.parse(await readFile(modelReportPath, 'utf8')) as ReturnType<
        typeof createViewerReport
      >
      expect(savedComparison.runs[0]?.report.questions[0]?.status).toBe('partial')
      expect(savedModel.questions[0]).toMatchObject({ status: 'partial' })
      expect(savedComparison.runs[0]?.report.summary).toMatchObject({ partial: 1, passRate: 0 })
    } finally {
      await viewer.close()
    }
  })
})
