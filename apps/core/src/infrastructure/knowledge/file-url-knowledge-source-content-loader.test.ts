import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'
import { FileUrlKnowledgeSourceContentLoader } from './file-url-knowledge-source-content-loader.js'

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: 'knowledge_source_1',
    scenarioId: 'scenario_1',
    name: 'Lore',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: '/tmp/lore.txt',
    status: 'pending',
    createdAt: '2026-05-11T08:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

function fakeFetch(body: string, init: { ok?: boolean; status?: number } = {}): typeof fetch {
  return (() =>
    Promise.resolve({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      text: () => Promise.resolve(body),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer),
    })) as unknown as typeof fetch
}

describe('FileUrlKnowledgeSourceContentLoader', () => {
  it('honors metadata.inlineText as an override, skipping any fetch', async () => {
    const loader = new FileUrlKnowledgeSourceContentLoader()
    const result = await loader.load(
      makeSource({ metadata: { inlineText: 'Inline override text' }, uriOrPath: '/nope' }),
    )

    expect(result.content).toBe('Inline override text')
  })

  it('produces a description for media sources without fetching', async () => {
    const loader = new FileUrlKnowledgeSourceContentLoader()
    const result = await loader.load(
      makeSource({ format: 'media', uriOrPath: 's3://bucket/clip.mp3' }),
    )

    expect(result.content).toBe('Media reference: s3://bucket/clip.mp3')
  })

  it('fetches text content for url sources over HTTP(S)', async () => {
    const loader = new FileUrlKnowledgeSourceContentLoader({
      fetchImpl: fakeFetch('Remote world lore.'),
    })

    const result = await loader.load(
      makeSource({ format: 'url', uriOrPath: 'https://example.com/lore.txt' }),
    )

    expect(result.content).toBe('Remote world lore.')
  })

  it('throws when the URL fetch fails', async () => {
    const loader = new FileUrlKnowledgeSourceContentLoader({
      fetchImpl: fakeFetch('', { ok: false, status: 404 }),
    })

    await expect(
      loader.load(makeSource({ format: 'url', uriOrPath: 'https://example.com/missing.txt' })),
    ).rejects.toThrow(/HTTP 404/)
  })

  it('extracts text from PDF sources via the injected parser', async () => {
    const pdfBytes = '%PDF-1.4 raw bytes'
    const loader = new FileUrlKnowledgeSourceContentLoader({
      fetchImpl: fakeFetch(pdfBytes),
      pdfParseImpl: (buffer) => Promise.resolve({ text: `parsed:${buffer.length.toString()}` }),
    })

    const result = await loader.load(
      makeSource({ format: 'pdf', uriOrPath: 'https://example.com/doc.pdf' }),
    )

    expect(result.content).toBe(`parsed:${Buffer.byteLength(pdfBytes, 'utf8').toString()}`)
  })

  describe('local file access', () => {
    let dir: string

    beforeEach(async () => {
      dir = await mkdtemp(path.join(tmpdir(), 'knowledge-loader-'))
    })

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true })
    })

    it('reads local text files within an allowed root', async () => {
      const filePath = path.join(dir, 'lore.txt')
      await writeFile(filePath, 'Local lore content.', 'utf8')
      const loader = new FileUrlKnowledgeSourceContentLoader({ allowedRoots: [dir] })

      const result = await loader.load(makeSource({ format: 'text', uriOrPath: filePath }))

      expect(result.content).toBe('Local lore content.')
    })

    it('rejects local file access when no roots are allowed', async () => {
      const filePath = path.join(dir, 'lore.txt')
      await writeFile(filePath, 'Local lore content.', 'utf8')
      const loader = new FileUrlKnowledgeSourceContentLoader()

      await expect(
        loader.load(makeSource({ format: 'text', uriOrPath: filePath })),
      ).rejects.toThrow(/Local file access is disabled/)
    })

    it('rejects paths outside the allowed roots', async () => {
      const outsidePath = path.join(tmpdir(), 'outside-lore.txt')
      const loader = new FileUrlKnowledgeSourceContentLoader({ allowedRoots: [dir] })

      await expect(
        loader.load(makeSource({ format: 'text', uriOrPath: outsidePath })),
      ).rejects.toThrow(/not within an allowed root/)
    })
  })
})
