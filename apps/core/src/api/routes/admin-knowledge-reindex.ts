import type { FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { IEmbeddingAdapter } from '../../application/ports/IEmbeddingAdapter.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import type { IKnowledgeCorpusRepository } from '../../application/ports/IKnowledgeCorpusRepository.js'
import type { IKnowledgeSourceContentLoader } from '../../application/ports/IKnowledgeSourceContentLoader.js'
import type { IKnowledgeSourceRepository } from '../../application/ports/IKnowledgeSourceRepository.js'
import {
  GetKnowledgeReindexUseCase,
  RetryKnowledgeReindexUseCase,
  StartKnowledgeReindexUseCase,
} from '../../application/use-cases/knowledge-reindex/knowledge-reindex.use-cases.js'
import { KnowledgeReindexService } from '../../application/services/knowledge/knowledge-reindex.service.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type AdminKnowledgeReindexRouteOptions = {
  config: Config
  sourceRepository: IKnowledgeSourceRepository
  corpusRepository: IKnowledgeCorpusRepository
  sourceContentLoader: IKnowledgeSourceContentLoader
  embeddingAdapter: IEmbeddingAdapter
  eventLogRepository: IEventLogRepository
}

type ReindexParams = { reindexOperationId: string }

const reindexParamsSchema = {
  type: 'object',
  required: ['reindexOperationId'],
  properties: {
    reindexOperationId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const emptyBodySchema = {
  type: 'object',
  maxProperties: 0,
  additionalProperties: false,
} as const

export const adminKnowledgeReindexRoute: FastifyPluginCallback<
  AdminKnowledgeReindexRouteOptions
> = (app, options) => {
  const reindexService = new KnowledgeReindexService(
    options.sourceRepository,
    options.corpusRepository,
    options.sourceContentLoader,
    options.embeddingAdapter,
    options.eventLogRepository,
    {
      provider: options.config.embeddingProvider,
      model: options.config.embeddingModel,
      dimensions: options.config.embeddingDimensions,
    },
  )
  const startUseCase = new StartKnowledgeReindexUseCase(reindexService, options.corpusRepository)
  const retryUseCase = new RetryKnowledgeReindexUseCase(reindexService, options.corpusRepository)
  const getUseCase = new GetKnowledgeReindexUseCase(options.corpusRepository)

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))

  app.addHook('onReady', async () => {
    const interruptedOperationIds = await options.corpusRepository.recoverRunningReindexOperations()
    for (const operationId of interruptedOperationIds) {
      void reindexService.run(operationId).catch((error: unknown) => {
        console.error('[knowledge-reindex] Recovery execution failed:', error)
      })
    }
  })

  app.post('/knowledge/reindex', { schema: { body: emptyBodySchema } }, async (_request, reply) => {
    try {
      const output = await startUseCase.execute()
      return await reply.status(output.status === 'already_active' ? 200 : 202).send(ok(output))
    } catch (error) {
      return await mapDomainError(error, reply)
    }
  })

  app.get<{ Params: ReindexParams }>(
    '/knowledge/reindex/:reindexOperationId',
    { schema: { params: reindexParamsSchema } },
    async (request, reply) => {
      try {
        const output = await getUseCase.execute(request.params.reindexOperationId)
        return await reply.status(200).send(ok(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )

  app.post<{ Params: ReindexParams }>(
    '/knowledge/reindex/:reindexOperationId/retry',
    { schema: { params: reindexParamsSchema, body: emptyBodySchema } },
    async (request, reply) => {
      try {
        const output = await retryUseCase.execute(request.params.reindexOperationId)
        return await reply.status(202).send(ok(output))
      } catch (error) {
        return await mapDomainError(error, reply)
      }
    },
  )
}

async function mapDomainError(error: unknown, reply: FastifyReply): Promise<FastifyReply> {
  if (error instanceof DomainError) {
    if (error.code === 'NOT_FOUND')
      return await reply.status(404).send(fail('NOT_FOUND', error.message))
    if (error.code === 'CONFLICT')
      return await reply.status(409).send(fail('CONFLICT', error.message))
  }
  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}
