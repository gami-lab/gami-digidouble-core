import { describe, expect, it } from 'vitest'

import type {
  RetrievedKnowledgeItem,
  TypedRetrievalResult,
} from '../../domain/knowledge/knowledge.types.js'
import { KnowledgeQueryEmbeddingService } from '../../application/services/knowledge/knowledge-query-embedding.service.js'
import { TypedRetrievalService } from '../../application/services/knowledge/typed-retrieval.service.js'
import { InMemoryKnowledgeChunkRepository } from '../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeCorpusRepository } from '../../infrastructure/db/in-memory-knowledge-corpus.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { SemanticFixtureEmbeddingAdapter } from '../../infrastructure/knowledge/test-support/semantic-fixture-embedding.adapter.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/null.adapter.js'
import {
  buildRetrievalQualityReport,
  scoreRetrievalFixture,
  scoreRetrievalFixtures,
} from './scorer.js'

function item(
  chunkId: string,
  knowledgeType: RetrievedKnowledgeItem['knowledgeType'],
): RetrievedKnowledgeItem {
  return {
    chunkId,
    sourceId: `source-${knowledgeType}`,
    knowledgeType,
    content: 'fixture content',
  }
}

function retrieval(items: RetrievedKnowledgeItem[]): TypedRetrievalResult {
  return {
    avatar_knowledge: items.filter((entry) => entry.knowledgeType === 'avatar_knowledge'),
    world: items.filter((entry) => entry.knowledgeType === 'world'),
    media: items.filter((entry) => entry.knowledgeType === 'media'),
    trace: {} as TypedRetrievalResult['trace'],
  }
}

// eslint-disable-next-line max-lines-per-function
describe('retrieval-quality scorer', () => {
  it('scores a hit at every requested cutoff and uses the first relevant rank for MRR', () => {
    const fixture = {
      fixtureId: 'multi-answer',
      scenarioId: 'scenario_1',
      knowledgeType: 'world' as const,
      query: 'query',
      expectedChunkIds: ['expected-late', 'expected-first'],
      rationale: 'test',
    }

    const score = scoreRetrievalFixture(
      fixture,
      retrieval([
        item('distractor', 'world'),
        item('expected-first', 'world'),
        item('expected-late', 'world'),
      ]),
    )

    expect(score.firstRelevantRank).toBe(2)
    expect(score.reciprocalRank).toBe(0.5)
    expect(score.hitsAtK).toEqual({ '3': true, '7': true, '9': true })
  })

  it('aggregates recall as fixture hit rate and MRR over fixture scores', () => {
    const report = buildRetrievalQualityReport(
      [
        {
          fixtureId: 'hit',
          expectedCount: 1,
          retrievedChunkIds: ['expected'],
          firstRelevantRank: 1,
          hitsAtK: { '3': true, '7': true, '9': true },
          reciprocalRank: 1,
        },
        {
          fixtureId: 'miss',
          expectedCount: 1,
          retrievedChunkIds: ['other'],
          firstRelevantRank: null,
          hitsAtK: { '3': false, '7': false, '9': false },
          reciprocalRank: 0,
        },
      ],
      { version: 1 },
    )

    expect(report.fixtureCount).toBe(2)
    expect(report.recallAtK).toEqual({ '3': 0.5, '7': 0.5, '9': 0.5 })
    expect(report.meanReciprocalRank).toBe(0.5)
  })

  it('scores the result returned by TypedRetrievalService with a deterministic adapter', async () => {
    const profile = { provider: 'fixture', model: 'semantic-groups-v1', dimensions: 2 } as const
    const activeCorpus = {
      embeddingProfileId: 'profile_retrieval_quality_test',
      corpusGenerationId: 'generation_retrieval_quality_test',
      profile,
    } as const
    const source = {
      sourceId: 'source_world',
      scenarioId: 'scenario_1',
      name: 'World',
      knowledgeType: 'world' as const,
      format: 'text' as const,
      uriOrPath: 'fixture://world',
      status: 'ready' as const,
      visibilityPolicy: 'all' as const,
      createdAt: '2026-09-13T00:00:00.000Z',
      updatedAt: '2026-09-13T00:00:00.000Z',
    }
    const adapter = new SemanticFixtureEmbeddingAdapter(
      profile,
      new Map([
        ['Which harbor is safe?', [1, 0]],
        ['The east harbor is safe for docking.', [1, 0]],
        ['The western pier is closed.', [0, 1]],
      ]),
    )
    const sourceRepository = new InMemoryKnowledgeSourceRepository([source])
    const chunkRepository = new InMemoryKnowledgeChunkRepository(
      [
        {
          chunkId: 'expected-harbor',
          sourceId: source.sourceId,
          content: 'The east harbor is safe for docking.',
          chunkIndex: 0,
          embedding: [1, 0],
          embeddingProfileId: activeCorpus.embeddingProfileId,
          corpusGenerationId: activeCorpus.corpusGenerationId,
          createdAt: source.createdAt,
        },
        {
          chunkId: 'other-pier',
          sourceId: source.sourceId,
          content: 'The western pier is closed.',
          chunkIndex: 1,
          embedding: [0, 1],
          embeddingProfileId: activeCorpus.embeddingProfileId,
          corpusGenerationId: activeCorpus.corpusGenerationId,
          createdAt: source.createdAt,
        },
      ],
      sourceRepository,
    )
    const corpusRepository = new InMemoryKnowledgeCorpusRepository(chunkRepository, activeCorpus)
    const queryEmbeddingService = new KnowledgeQueryEmbeddingService(
      corpusRepository,
      adapter,
      new NullObservabilityAdapter(),
    )
    const service = new TypedRetrievalService(
      sourceRepository,
      chunkRepository,
      queryEmbeddingService,
    )

    const report = await scoreRetrievalFixtures(
      service,
      [
        {
          fixtureId: 'harbor',
          scenarioId: 'scenario_1',
          knowledgeType: 'world',
          query: 'Which harbor is safe?',
          expectedChunkIds: ['expected-harbor'],
          rationale: 'test',
        },
      ],
      { version: 1 },
    )

    expect(report.recallAtK).toEqual({ '3': 1, '7': 1, '9': 1 })
    expect(report.meanReciprocalRank).toBe(1)
    expect(report.fixtures[0]?.retrievedChunkIds[0]).toBe('expected-harbor')
  })
})
