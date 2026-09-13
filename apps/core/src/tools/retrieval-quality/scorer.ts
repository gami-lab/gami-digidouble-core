import type { TypedRetrievalResult } from '../../domain/knowledge/knowledge.types.js'
import type { TypedRetrievalService } from '../../application/services/knowledge/typed-retrieval.service.js'
import { RETRIEVAL_QUALITY_K_VALUES, type RetrievalQualityFixture } from './fixtures.js'

export type RetrievalQualityK = (typeof RETRIEVAL_QUALITY_K_VALUES)[number]

export type RetrievalFixtureScore = Readonly<{
  fixtureId: string
  expectedCount: number
  retrievedChunkIds: readonly string[]
  firstRelevantRank: number | null
  hitsAtK: Readonly<Record<string, boolean>>
  reciprocalRank: number
}>

export type RetrievalQualityReport = Readonly<{
  version: number
  fixtureCount: number
  recallAtK: Readonly<Record<string, number>>
  meanReciprocalRank: number
  fixtures: readonly RetrievalFixtureScore[]
  embeddingProfile?: Readonly<{
    provider: string
    model: string
    dimensions: number
  }>
}>

export function scoreRetrievalFixture(
  fixture: RetrievalQualityFixture,
  retrieval: TypedRetrievalResult,
  kValues: readonly number[] = RETRIEVAL_QUALITY_K_VALUES,
): RetrievalFixtureScore {
  const retrievedChunkIds = retrieval[fixture.knowledgeType].map((item) => item.chunkId)
  const expectedChunkIds = new Set(fixture.expectedChunkIds)
  const firstRelevantIndex = retrievedChunkIds.findIndex((chunkId) => expectedChunkIds.has(chunkId))
  const firstRelevantRank = firstRelevantIndex === -1 ? null : firstRelevantIndex + 1

  return {
    fixtureId: fixture.fixtureId,
    expectedCount: fixture.expectedChunkIds.length,
    retrievedChunkIds,
    firstRelevantRank,
    hitsAtK: Object.fromEntries(
      kValues.map((k) => [
        String(k),
        retrievedChunkIds.slice(0, k).some((id) => expectedChunkIds.has(id)),
      ]),
    ),
    reciprocalRank: firstRelevantRank === null ? 0 : 1 / firstRelevantRank,
  }
}

export function buildRetrievalQualityReport(
  fixtureScores: readonly RetrievalFixtureScore[],
  options: {
    version: number
    kValues?: readonly number[]
    embeddingProfile?: RetrievalQualityReport['embeddingProfile']
  },
): RetrievalQualityReport {
  const kValues = options.kValues ?? RETRIEVAL_QUALITY_K_VALUES
  const fixtureCount = fixtureScores.length
  const recallAtK = Object.fromEntries(
    kValues.map((k) => {
      const hitCount = fixtureScores.filter((score) => score.hitsAtK[String(k)] === true).length
      return [String(k), fixtureCount === 0 ? 0 : hitCount / fixtureCount]
    }),
  )
  const reciprocalRankTotal = fixtureScores.reduce(
    (total, score) => total + score.reciprocalRank,
    0,
  )

  return {
    version: options.version,
    fixtureCount,
    recallAtK,
    meanReciprocalRank: fixtureCount === 0 ? 0 : reciprocalRankTotal / fixtureCount,
    fixtures: fixtureScores,
    ...(options.embeddingProfile === undefined
      ? {}
      : { embeddingProfile: options.embeddingProfile }),
  }
}

export async function scoreRetrievalFixtures(
  service: TypedRetrievalService,
  fixtures: readonly RetrievalQualityFixture[],
  options: {
    version: number
    kValues?: readonly number[]
  },
): Promise<RetrievalQualityReport> {
  const kValues = options.kValues ?? RETRIEVAL_QUALITY_K_VALUES
  const limitPerType = Math.max(...kValues)
  const retrievals = await Promise.all(
    fixtures.map((fixture) =>
      service.retrieve({
        scenarioId: fixture.scenarioId,
        query: fixture.query,
        bypassVisibilityFilter: true,
        limitPerType,
      }),
    ),
  )
  const fixtureScores = fixtures.map((fixture, index) => {
    const retrieval = retrievals[index]
    if (retrieval === undefined) throw new Error(`Missing retrieval for ${fixture.fixtureId}.`)
    return scoreRetrievalFixture(fixture, retrieval, kValues)
  })
  const profile = retrievals.find((retrieval) => retrieval.trace.embeddingProfile !== undefined)
    ?.trace.embeddingProfile

  return buildRetrievalQualityReport(fixtureScores, {
    ...options,
    ...(profile === undefined
      ? {}
      : {
          embeddingProfile: {
            provider: profile.provider,
            model: profile.model,
            dimensions: profile.dimensions,
          },
        }),
  })
}
