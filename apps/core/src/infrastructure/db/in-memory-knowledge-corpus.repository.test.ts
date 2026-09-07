import { describe, expect, it } from 'vitest'
import type { EmbeddingProfile } from '../../application/ports/IEmbeddingAdapter.js'
import { InMemoryKnowledgeChunkRepository } from './in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeCorpusRepository } from './in-memory-knowledge-corpus.repository.js'

const profile: EmbeddingProfile = {
  provider: 'test',
  model: 'test-embedding',
  dimensions: 2,
}

function stagedChunk(args: {
  sourceId: string
  profileId: string
  generationId: string
  content: string
  index?: number
}) {
  return {
    sourceId: args.sourceId,
    content: args.content,
    chunkIndex: args.index ?? 0,
    embedding: [0.1, 0.2],
    embeddingProfileId: args.profileId,
    corpusGenerationId: args.generationId,
  }
}

// eslint-disable-next-line max-lines-per-function
describe('InMemoryKnowledgeCorpusRepository', () => {
  it('keeps staged chunks isolated and atomically switches the active corpus', async () => {
    const chunks = new InMemoryKnowledgeChunkRepository()
    const repository = new InMemoryKnowledgeCorpusRepository(chunks)
    const persistedProfile = await repository.createEmbeddingProfile(profile)

    const firstOperation = await repository.createReindexOperation({
      embeddingProfileId: persistedProfile.embeddingProfileId,
      sourceIds: ['knowledge_source_1'],
    })
    const firstGenerationChunk = stagedChunk({
      sourceId: 'knowledge_source_1',
      profileId: firstOperation.embeddingProfileId,
      generationId: firstOperation.corpusGenerationId,
      content: 'first corpus',
    })
    await repository.replaceStagedSourceChunks(
      firstOperation.reindexOperationId,
      'knowledge_source_1',
      [firstGenerationChunk],
    )
    await expect(repository.listActiveChunksBySourceIds(['knowledge_source_1'])).resolves.toEqual(
      [],
    )
    await repository.promoteCorpusGeneration(firstOperation.reindexOperationId)

    const secondOperation = await repository.createReindexOperation({
      embeddingProfileId: persistedProfile.embeddingProfileId,
      sourceIds: ['knowledge_source_1'],
    })
    await repository.replaceStagedSourceChunks(
      secondOperation.reindexOperationId,
      'knowledge_source_1',
      [
        stagedChunk({
          sourceId: 'knowledge_source_1',
          profileId: secondOperation.embeddingProfileId,
          generationId: secondOperation.corpusGenerationId,
          content: 'second corpus',
        }),
      ],
    )

    await expect(chunks.listBySourceId('knowledge_source_1')).resolves.toMatchObject([
      { content: 'first corpus' },
    ])
    await repository.promoteCorpusGeneration(secondOperation.reindexOperationId)
    await expect(chunks.listBySourceId('knowledge_source_1')).resolves.toMatchObject([
      { content: 'second corpus' },
    ])
  })

  it('replaces a source idempotently and rejects incomplete promotion', async () => {
    const chunks = new InMemoryKnowledgeChunkRepository()
    const repository = new InMemoryKnowledgeCorpusRepository(chunks)
    const persistedProfile = await repository.createEmbeddingProfile(profile)
    const operation = await repository.createReindexOperation({
      embeddingProfileId: persistedProfile.embeddingProfileId,
      sourceIds: ['knowledge_source_1', 'knowledge_source_2'],
    })
    const replacement = stagedChunk({
      sourceId: 'knowledge_source_1',
      profileId: operation.embeddingProfileId,
      generationId: operation.corpusGenerationId,
      content: 'replacement',
    })

    await repository.replaceStagedSourceChunks(operation.reindexOperationId, 'knowledge_source_1', [
      stagedChunk({
        sourceId: 'knowledge_source_1',
        profileId: operation.embeddingProfileId,
        generationId: operation.corpusGenerationId,
        content: 'partial',
      }),
    ])
    await repository.replaceStagedSourceChunks(operation.reindexOperationId, 'knowledge_source_1', [
      replacement,
    ])

    await expect(
      repository.validateCorpusGeneration(operation.reindexOperationId),
    ).resolves.toMatchObject({
      valid: false,
      completedSourceCount: 1,
      actualChunkCount: 1,
      nonNullVectorCount: 1,
    })
    await expect(repository.promoteCorpusGeneration(operation.reindexOperationId)).rejects.toThrow(
      'Generation is incomplete',
    )
    await expect(repository.getActiveCorpus()).resolves.toBeNull()
    await expect(chunks.listBySourceId('knowledge_source_1')).resolves.toEqual([])
  })

  it('rejects staged vectors with the wrong profile dimension', async () => {
    const chunks = new InMemoryKnowledgeChunkRepository()
    const repository = new InMemoryKnowledgeCorpusRepository(chunks)
    const persistedProfile = await repository.createEmbeddingProfile(profile)
    const operation = await repository.createReindexOperation({
      embeddingProfileId: persistedProfile.embeddingProfileId,
      sourceIds: ['knowledge_source_1'],
    })

    await expect(
      repository.replaceStagedSourceChunks(operation.reindexOperationId, 'knowledge_source_1', [
        {
          ...stagedChunk({
            sourceId: 'knowledge_source_1',
            profileId: operation.embeddingProfileId,
            generationId: operation.corpusGenerationId,
            content: 'bad vector',
          }),
          embedding: [0.1],
        },
      ]),
    ).rejects.toThrow('dimension')
  })
})
