import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

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

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  reportPath: string,
): Promise<void> {
  if (request.method !== 'GET') {
    send(response, 405, 'text/plain; charset=utf-8', 'Method not allowed')
    return
  }

  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
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
