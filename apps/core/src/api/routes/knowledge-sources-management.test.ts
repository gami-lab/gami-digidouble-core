import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'
import { InMemoryKnowledgeChunkRepository } from '../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: 'knowledge_source_1',
    scenarioId: 'scenario_1',
    name: 'Lore',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: '/tmp/lore.txt',
    status: 'ready',
    createdAt: '2026-05-11T08:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

function makeApp({
  sources = [],
}: {
  sources?: KnowledgeSource[]
} = {}) {
  return createServer(TEST_CONFIG, {
    knowledgeSourceRepository: new InMemoryKnowledgeSourceRepository(sources),
    knowledgeChunkRepository: new InMemoryKnowledgeChunkRepository(),
  })
}

describe('PATCH /v1/knowledge-sources/:sourceId', () => {
  it('updates only the provided fields', async () => {
    const app = makeApp({ sources: [makeSource()] })

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/knowledge-sources/knowledge_source_1',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'Updated Lore' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ source: { name: string; status: string } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.source.name).toBe('Updated Lore')
    expect(body.data?.source.status).toBe('ready')
  })

  it('resets status to pending when metadata changes', async () => {
    const app = makeApp({ sources: [makeSource()] })

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/knowledge-sources/knowledge_source_1',
      headers: { 'x-api-key': 'test-secret' },
      payload: { metadata: { inlineText: 'New content' } },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ source: { status: string } }>>()
    expect(body.data?.source.status).toBe('pending')
  })

  it('persists visibilityPolicy update', async () => {
    const app = makeApp({ sources: [makeSource()] })

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/knowledge-sources/knowledge_source_1',
      headers: { 'x-api-key': 'test-secret' },
      payload: { visibilityPolicy: 'none' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ source: { visibilityPolicy: string } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.source.visibilityPolicy).toBe('none')
  })

  it('returns 400 when body is empty', async () => {
    const app = makeApp({ sources: [makeSource()] })

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/knowledge-sources/knowledge_source_1',
      headers: { 'x-api-key': 'test-secret' },
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when source does not exist', async () => {
    const response = await makeApp().inject({
      method: 'PATCH',
      url: '/v1/knowledge-sources/knowledge_source_missing',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'New Name' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('DELETE /v1/knowledge-sources/:sourceId', () => {
  it('deletes an existing source', async () => {
    const app = makeApp({ sources: [makeSource()] })

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/knowledge-sources/knowledge_source_1',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ sourceId: string; deleted: true }>>()
    expect(body.error).toBeNull()
    expect(body.data).toEqual({ sourceId: 'knowledge_source_1', deleted: true })
  })

  it('returns 404 when source does not exist', async () => {
    const response = await makeApp().inject({
      method: 'DELETE',
      url: '/v1/knowledge-sources/knowledge_source_missing',
      headers: { 'x-api-key': 'test-secret' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('POST /v1/knowledge-sources/upload — success', () => {
  it('creates a text source from base64-encoded TXT content', async () => {
    const app = makeApp()
    const text = 'Kingdom timeline and history.'
    const content = Buffer.from(text).toString('base64')

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge-sources/upload',
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        scenarioId: 'scenario_1',
        name: 'Kingdom lore',
        knowledgeType: 'world',
        content,
        filename: 'lore.txt',
      },
    })

    expect(response.statusCode).toBe(201)
    const body =
      response.json<
        ApiResponse<{
          source: { format: string; status: string; metadata?: Record<string, unknown> }
        }>
      >()
    expect(body.error).toBeNull()
    expect(body.data?.source.format).toBe('text')
    expect(body.data?.source.status).toBe('pending')
    expect(body.data?.source.metadata?.inlineText).toBe(text)
  })

  it('creates a source with visibilityPolicy none from upload', async () => {
    const app = makeApp()
    const content = Buffer.from('GM-only secret hint.').toString('base64')

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge-sources/upload',
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        scenarioId: 'scenario_1',
        name: 'GM secret',
        knowledgeType: 'world',
        content,
        filename: 'hint.txt',
        visibilityPolicy: 'none',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json<ApiResponse<{ source: { visibilityPolicy: string } }>>()
    expect(body.data?.source.visibilityPolicy).toBe('none')
  })
})

describe('POST /v1/knowledge-sources/upload — validation', () => {
  it('returns 400 for unsupported file extension', async () => {
    const app = makeApp()
    const content = Buffer.from('some content').toString('base64')

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge-sources/upload',
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        scenarioId: 'scenario_1',
        name: 'Bad file',
        knowledgeType: 'world',
        content,
        filename: 'document.docx',
      },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when content is empty after decoding', async () => {
    const app = makeApp()
    const content = Buffer.from('   ').toString('base64')

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge-sources/upload',
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        scenarioId: 'scenario_1',
        name: 'Empty file',
        knowledgeType: 'world',
        content,
        filename: 'empty.txt',
      },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when required fields are missing', async () => {
    const app = makeApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge-sources/upload',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'Missing fields' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 when API key is missing', async () => {
    const app = makeApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge-sources/upload',
      payload: {
        scenarioId: 's',
        name: 'x',
        knowledgeType: 'world',
        content: 'dGVzdA==',
        filename: 'x.txt',
      },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /v1/knowledge-sources — visibilityPolicy', () => {
  it('persists visibilityPolicy on create', async () => {
    const app = makeApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge-sources',
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        scenarioId: 'scenario_1',
        name: 'GM lore',
        knowledgeType: 'world',
        format: 'text',
        uriOrPath: '/tmp/gm-lore.txt',
        visibilityPolicy: 'none',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json<ApiResponse<{ source: { visibilityPolicy: string } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.source.visibilityPolicy).toBe('none')
  })
})
