import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { KnowledgeChunk, KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'
import { KnowledgeQueryEmbeddingService } from '../../application/services/knowledge/knowledge-query-embedding.service.js'
import { TypedRetrievalService } from '../../application/services/knowledge/typed-retrieval.service.js'
import { InMemoryKnowledgeChunkRepository } from '../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeCorpusRepository } from '../../infrastructure/db/in-memory-knowledge-corpus.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { createEmbeddingAdapter } from '../../infrastructure/knowledge/openai-embedding.adapter.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/null.adapter.js'
import {
  DEFAULT_EMBEDDING_BATCH_SIZE,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
} from '../../config.js'
import {
  RETRIEVAL_QUALITY_CHUNKS,
  RETRIEVAL_QUALITY_FIXTURES,
  RETRIEVAL_QUALITY_SCENARIO_ID,
  RETRIEVAL_QUALITY_VERSION,
} from './fixtures.js'
import { scoreRetrievalFixtures, type RetrievalQualityReport } from './scorer.js'

const DEFAULT_OUTPUT_PATH = 'apps/core/src/tools/retrieval-quality/baseline-before.json'
const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../')

type CliOptions = Readonly<{
  live: boolean
  outputPath: string
}>

function loadRootEnv(): void {
  try {
    process.loadEnvFile(resolve(ROOT_DIRECTORY, '.env'))
  } catch {
    // Shell and CI environment variables remain the source of truth when .env is absent.
  }
}

function parseArgs(argv: readonly string[]): CliOptions {
  let live = false
  let outputPath = process.env['RETRIEVAL_QUALITY_REPORT_PATH'] ?? DEFAULT_OUTPUT_PATH
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--live') {
      live = true
      continue
    }
    if (argument === '--output') {
      const value = argv[index + 1]
      if (value === undefined || value.trim().length === 0) {
        throw new Error('--output requires a non-empty path.')
      }
      outputPath = value
      index += 1
      continue
    }
    if (argument === '--help') {
      printUsage()
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${argument ?? 'undefined'}`)
  }
  return { live, outputPath }
}

function printUsage(): void {
  console.log(`Usage: pnpm --filter @gami/core retrieval-quality -- --live [--output PATH]

Runs the versioned retrieval fixtures with OpenAI embeddings and the current production profile.
--live is required because this command can incur provider charges.`)
}

function buildSources(): KnowledgeSource[] {
  const sourceIds = new Set(RETRIEVAL_QUALITY_CHUNKS.map((chunk) => chunk.sourceId))
  return [...sourceIds].map((sourceId) => {
    const chunk = RETRIEVAL_QUALITY_CHUNKS.find((candidate) => candidate.sourceId === sourceId)
    if (chunk === undefined) throw new Error(`Missing source metadata for ${sourceId}.`)
    return {
      sourceId,
      scenarioId: chunk.scenarioId,
      name: sourceId,
      knowledgeType: chunk.knowledgeType,
      format: 'markdown',
      uriOrPath: `seed://murder-party/${sourceId}.md`,
      status: 'ready',
      visibilityPolicy: 'all',
      createdAt: '2026-09-13T00:00:00.000Z',
      updatedAt: '2026-09-13T00:00:00.000Z',
    }
  })
}

async function buildRetrievalService(): Promise<TypedRetrievalService> {
  const apiKey = process.env['OPENAI_API_KEY']
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error('Missing OPENAI_API_KEY. Pass it through the environment for --live.')
  }
  const model = process.env['EMBEDDING_MODEL'] ?? DEFAULT_EMBEDDING_MODEL
  const dimensions = Number(process.env['EMBEDDING_DIMENSIONS'] ?? DEFAULT_EMBEDDING_DIMENSIONS)
  if (dimensions !== DEFAULT_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Baseline requires the current ${String(DEFAULT_EMBEDDING_DIMENSIONS)}-dimension profile; received ${String(dimensions)}.`,
    )
  }

  const observability = new NullObservabilityAdapter()
  const embeddingAdapter = createEmbeddingAdapter(
    {
      provider: 'openai',
      model,
      dimensions,
      maxBatchSize: DEFAULT_EMBEDDING_BATCH_SIZE,
      openaiApiKey: apiKey,
    },
    observability,
  )
  const profile = {
    provider: 'openai',
    model,
    dimensions,
  } as const
  const activeCorpus = {
    embeddingProfileId: 'embedding_profile_retrieval_quality',
    corpusGenerationId: 'corpus_generation_retrieval_quality',
    profile,
  } as const
  const sourceRepository = new InMemoryKnowledgeSourceRepository(buildSources())
  const chunkEmbeddings = await embeddingAdapter.embed({
    inputs: RETRIEVAL_QUALITY_CHUNKS.map((chunk) => chunk.content),
  })
  const chunks: KnowledgeChunk[] = RETRIEVAL_QUALITY_CHUNKS.map((chunk, index) => {
    const embedding = chunkEmbeddings.vectors[index]
    if (embedding === undefined) throw new Error(`Missing embedding for ${chunk.chunkId}.`)
    return {
      ...chunk,
      embedding,
      embeddingProfileId: activeCorpus.embeddingProfileId,
      corpusGenerationId: activeCorpus.corpusGenerationId,
      createdAt: '2026-09-13T00:00:00.000Z',
    }
  })
  const chunkRepository = new InMemoryKnowledgeChunkRepository(chunks, sourceRepository)
  const corpusRepository = new InMemoryKnowledgeCorpusRepository(chunkRepository, activeCorpus)
  const queryEmbeddingService = new KnowledgeQueryEmbeddingService(
    corpusRepository,
    embeddingAdapter,
    observability,
  )

  return new TypedRetrievalService(sourceRepository, chunkRepository, queryEmbeddingService)
}

async function writeReport(outputPath: string, report: RetrievalQualityReport): Promise<void> {
  const targetPath = resolve(ROOT_DIRECTORY, outputPath)
  const temporaryPath = `${targetPath}.tmp`
  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, targetPath)
}

async function main(): Promise<void> {
  loadRootEnv()
  const options = parseArgs(process.argv.slice(2))
  if (!options.live) {
    throw new Error(
      'This command requires --live; deterministic scoring belongs in the unit tests.',
    )
  }
  const service = await buildRetrievalService()
  const report = await scoreRetrievalFixtures(service, RETRIEVAL_QUALITY_FIXTURES, {
    version: RETRIEVAL_QUALITY_VERSION,
  })
  await writeReport(options.outputPath, report)

  console.log(
    `Retrieval quality baseline written to ${resolve(ROOT_DIRECTORY, options.outputPath)}`,
  )
  console.log(`Scenario: ${RETRIEVAL_QUALITY_SCENARIO_ID}`)
  console.log(`Fixtures: ${String(report.fixtureCount)}`)
  console.log(`Recall@k: ${JSON.stringify(report.recallAtK)}`)
  console.log(`MRR: ${report.meanReciprocalRank.toFixed(6)}`)
  for (const fixture of report.fixtures) {
    console.log(
      `${fixture.fixtureId}: rank=${fixture.firstRelevantRank === null ? 'miss' : String(fixture.firstRelevantRank)} hits=${JSON.stringify(fixture.hitsAtK)}`,
    )
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
