import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { startReportViewer } from './viewer.js'

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
      expect(pageHtml).toContain('Sort by ')
      expect(pageHtml).toContain('modelSortColumn')
      expect(pageHtml).toContain('Print current model')
      expect(pageHtml).toContain('Print all models')
      expect(pageHtml).toContain('@media print')
      expect(pageHtml).not.toContain('totalJudgeTokens')
      expect(pageHtml).toContain('avatarCost')

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
})
