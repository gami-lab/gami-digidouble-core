import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { ModelComparisonReport, QualityOutcome, RunReport } from './contracts.js'
import { applyHumanReview, writeJsonAtomically } from './report.js'
import { REPORT_VIEWER_HTML } from './viewer-page.js'

export type ReportViewerOptions = {
  reportPath: string
  host?: string
  port?: number
}

export type ReportViewer = {
  reportPath: string
  url: string
  close: () => Promise<void>
}

type ReviewRequest = {
  runKey?: string
  questionNumber: number
  status: QualityOutcome
}

const MAX_REVIEW_REQUEST_BYTES = 16_384

function send(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  })
  response.end(body)
}

// eslint-disable-next-line complexity
async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  reportPath: string,
): Promise<void> {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  if (request.method === 'POST' && pathname === '/review') {
    try {
      const correction = parseReviewRequest(JSON.parse(await readRequestBody(request)) as unknown)
      const updatedReport = await applyReview(reportPath, correction)
      send(response, 200, 'application/json; charset=utf-8', JSON.stringify(updatedReport))
    } catch (error: unknown) {
      send(
        response,
        400,
        'application/json; charset=utf-8',
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unable to save review.',
        }),
      )
    }
    return
  }
  if (request.method !== 'GET') {
    send(response, 405, 'text/plain; charset=utf-8', 'Method not allowed')
    return
  }

  if (pathname === '/' || pathname === '/index.html') {
    send(response, 200, 'text/html; charset=utf-8', REPORT_VIEWER_HTML)
    return
  }
  if (pathname === '/report.json') {
    try {
      const report = await readFile(reportPath, 'utf8')
      send(response, 200, 'application/json; charset=utf-8', report)
    } catch {
      send(response, 404, 'application/json; charset=utf-8', '{"error":"Report file not found."}')
    }
    return
  }
  send(response, 404, 'text/plain; charset=utf-8', 'Not found')
}

async function applyReview(reportPath: string, correction: ReviewRequest): Promise<unknown> {
  const parsed: unknown = JSON.parse(await readFile(reportPath, 'utf8'))
  if (isModelComparisonReport(parsed)) {
    if (correction.runKey === undefined) {
      throw new Error('A runKey is required when reviewing a model comparison report.')
    }
    const run = parsed.runs.find(
      (candidate) => (candidate.runKey ?? candidate.model) === correction.runKey,
    )
    if (run === undefined) throw new Error('The selected model run was not found.')
    const updatedRun = applyHumanReview(run.report, correction.questionNumber, correction.status)
    const updatedComparison: ModelComparisonReport = {
      ...parsed,
      generatedAt: new Date().toISOString(),
      runs: parsed.runs.map((candidate) =>
        candidate === run ? { ...candidate, report: updatedRun } : candidate,
      ),
    }
    await writeJsonAtomically(reportPath, updatedComparison)
    return updatedComparison
  }
  if (!isRunReport(parsed)) throw new Error('The report is not a supported evaluation report.')
  if (correction.runKey !== undefined) {
    throw new Error('runKey is only valid for model comparison reports.')
  }
  const updatedReport = applyHumanReview(parsed, correction.questionNumber, correction.status)
  await writeJsonAtomically(reportPath, updatedReport)
  return updatedReport
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  return await new Promise<string>((resolveBody, rejectBody) => {
    let size = 0
    const chunks: string[] = []
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      size += Buffer.byteLength(chunk)
      if (size > MAX_REVIEW_REQUEST_BYTES) {
        rejectBody(new Error('Review request is too large.'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      resolveBody(chunks.join(''))
    })
    request.on('error', rejectBody)
  })
}

// eslint-disable-next-line complexity
function parseReviewRequest(value: unknown): ReviewRequest {
  if (!isRecord(value)) throw new Error('Review request must be a JSON object.')
  const questionNumber = value['questionNumber']
  const status = value['status']
  const runKey = value['runKey']
  if (
    typeof questionNumber !== 'number' ||
    !Number.isInteger(questionNumber) ||
    questionNumber < 1
  ) {
    throw new Error('questionNumber must be a positive integer.')
  }
  if (status !== 'passed' && status !== 'partial' && status !== 'failed') {
    throw new Error('status must be passed, partial, or failed.')
  }
  if (runKey !== undefined && (typeof runKey !== 'string' || runKey.length === 0)) {
    throw new Error('runKey must be a non-empty string when provided.')
  }
  return {
    questionNumber,
    status,
    ...(runKey === undefined ? {} : { runKey }),
  }
}

function isModelComparisonReport(value: unknown): value is ModelComparisonReport {
  return (
    isRecord(value) &&
    value['reportType'] === 'model_comparison' &&
    Array.isArray(value['runs']) &&
    value['runs'].every(
      (run) =>
        isRecord(run) &&
        typeof run['model'] === 'string' &&
        (run['reportPath'] === undefined || typeof run['reportPath'] === 'string') &&
        isRunReport(run['report']),
    )
  )
}

function isRunReport(value: unknown): value is RunReport {
  return (
    isRecord(value) &&
    value['version'] === 1 &&
    typeof value['testName'] === 'string' &&
    typeof value['scenarioId'] === 'string' &&
    Array.isArray(value['questions']) &&
    isRecord(value['summary'])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function startReportViewer(options: ReportViewerOptions): Promise<ReportViewer> {
  const reportPath = resolve(options.reportPath)
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 4173
  const server = createServer((request, response) => {
    void handleRequest(request, response, reportPath)
  })

  await new Promise<void>((resolveServer, rejectServer) => {
    const onError = (error: Error): void => {
      server.removeListener('listening', onListening)
      rejectServer(error)
    }
    const onListening = (): void => {
      server.removeListener('error', onError)
      resolveServer()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })

  const address = server.address()
  if (address === null || typeof address === 'string') {
    await closeServer(server)
    throw new Error('Unable to determine the report viewer address.')
  }
  const displayHost = address.address === '::' ? 'localhost' : address.address
  return {
    reportPath,
    url: `http://${displayHost}:${String(address.port)}`,
    close: () => closeServer(server),
  }
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error === undefined) {
        resolveClose()
      } else {
        rejectClose(error)
      }
    })
  })
}
