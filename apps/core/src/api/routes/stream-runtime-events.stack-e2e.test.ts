import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return { 'x-api-key': apiKey, 'content-type': 'application/json' }
}

async function createScenarioAndSession(): Promise<{ sessionId: string }> {
  const scenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name: `Runtime stream stack scenario ${Date.now().toString()}` }),
  })
  expect(scenarioRes.status).toBe(201)
  const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
    scenario: { scenarioId: string }
  }>
  const scenarioId = scenarioBody.data?.scenario.scenarioId
  if (typeof scenarioId !== 'string' || scenarioId.length === 0) {
    throw new Error('Missing scenarioId')
  }

  const sessionRes = await fetch(`${APP_URL}/v1/sessions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ userId: `user_${Date.now().toString()}`, scenarioId }),
  })
  expect(sessionRes.status).toBe(201)
  const sessionBody = (await sessionRes.json()) as ApiResponse<{
    session: { sessionId: string }
  }>
  const sessionId = sessionBody.data?.session.sessionId
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('Missing sessionId')
  }

  return { sessionId }
}

async function openSseAndReadFirstChunk(path: string): Promise<{
  statusCode: number
  contentType: string
  firstChunk: string
}> {
  const url = new URL(path, APP_URL)
  const client = url.protocol === 'https:' ? https : http

  return await new Promise((resolve, reject) => {
    const request = client.request(
      {
        method: 'GET',
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: { 'x-api-key': API_KEY },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0
        const contentType = normalizeHeaderValue(response.headers['content-type'])
        response.once('data', (chunk: Buffer) => {
          const firstChunk = chunk.toString('utf8')
          response.destroy()
          resolve({
            statusCode,
            contentType,
            firstChunk,
          })
        })
      },
    )

    request.setTimeout(500, () => {
      request.destroy(new Error('SSE read timeout'))
    })
    request.on('error', reject)
    request.end()
  })
}

function normalizeHeaderValue(header: unknown): string {
  if (typeof header === 'string') return header
  if (Array.isArray(header)) return typeof header[0] === 'string' ? header[0] : ''
  return ''
}

describe('Stack E2E — GET /v1/sessions/:sessionId/events/stream auth', () => {
  it('returns 401 UNAUTHORIZED when API key is missing', async () => {
    const response = await fetch(`${APP_URL}/v1/sessions/session_1/events/stream`)

    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 UNAUTHORIZED when API key is wrong', async () => {
    const response = await fetch(`${APP_URL}/v1/sessions/session_1/events/stream`, {
      headers: authHeaders('wrong-key'),
    })

    expect(response.status).toBe(401)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('Stack E2E — GET /v1/sessions/:sessionId/events/stream behavior', () => {
  it('returns 404 NOT_FOUND for unknown sessionId', async () => {
    const response = await fetch(`${APP_URL}/v1/sessions/session_unknown/events/stream`, {
      headers: authHeaders(),
    })

    expect(response.status).toBe(404)
    const body = (await response.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })

  it('returns event-stream headers and initial keepalive frame', async () => {
    const { sessionId } = await createScenarioAndSession()

    const streamResult = await openSseAndReadFirstChunk(`/v1/sessions/${sessionId}/events/stream`)

    expect(streamResult.statusCode).toBe(200)
    expect(streamResult.contentType).toContain('text/event-stream')
    expect(streamResult.firstChunk).toContain(': keepalive')

    // TODO(epic-4-5): add full live event frame assertion by triggering a GM runtime event in stack-e2e.
  })
})
