import type { FastifyInstance, FastifyPluginCallback, FastifyReply } from 'fastify'
import { fail, ok } from '@gami/shared'
import crypto from 'node:crypto'
import type {
  CreateKnowledgeSourceRequest,
  CreateKnowledgeSourceResponse,
  GetIngestionJobResponse,
  ListIngestionJobsResponse,
  ListKnowledgeSourcesQuery,
  ListKnowledgeSourcesResponse,
  QueryKnowledgeRetrievalRequest,
  QueryKnowledgeRetrievalResponse,
  TriggerIngestionRequest,
  TriggerIngestionResponse,
} from '@gami/shared'
import type { IIngestionJobRepository } from '../../application/ports/IIngestionJobRepository.js'
import type { IKnowledgeChunkRepository } from '../../application/ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeSourceRepository } from '../../application/ports/IKnowledgeSourceRepository.js'
import type { IEmbeddingAdapter } from '../../application/ports/IEmbeddingAdapter.js'
import type { IKnowledgeSourceContentLoader } from '../../application/ports/IKnowledgeSourceContentLoader.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import { KnowledgeIngestionService } from '../../application/services/knowledge/knowledge-ingestion.service.js'
import { TypedRetrievalService } from '../../application/services/knowledge/typed-retrieval.service.js'
import { CreateKnowledgeSourceUseCase } from '../../application/use-cases/create-knowledge-source/create-knowledge-source.use-case.js'
import { GetIngestionJobUseCase } from '../../application/use-cases/get-ingestion-job/get-ingestion-job.use-case.js'
import { GetTypedRetrievalUseCase } from '../../application/use-cases/get-typed-retrieval/get-typed-retrieval.use-case.js'
import { ListKnowledgeSourcesUseCase } from '../../application/use-cases/list-knowledge-sources/list-knowledge-sources.use-case.js'
import { TriggerIngestionUseCase } from '../../application/use-cases/trigger-ingestion/trigger-ingestion.use-case.js'
import type { Config } from '../../config.js'
import { DomainError } from '../../domain/errors.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import { presentKnowledgeRetrieval } from './knowledge-retrieval.presenter.js'

export type KnowledgeRouteOptions = {
  config: Config
  sourceRepository: IKnowledgeSourceRepository
  chunkRepository: IKnowledgeChunkRepository
  ingestionJobRepository: IIngestionJobRepository
  sourceContentLoader: IKnowledgeSourceContentLoader
  embeddingAdapter: IEmbeddingAdapter
  eventLogRepository: IEventLogRepository
}

type ScenarioParams = { scenarioId: string }
type SourceParams = { sourceId: string }
type JobParams = { ingestionJobId: string }

type UseCases = {
  createSourceUseCase: CreateKnowledgeSourceUseCase
  listSourcesUseCase: ListKnowledgeSourcesUseCase
  triggerIngestionUseCase: TriggerIngestionUseCase
  getIngestionJobUseCase: GetIngestionJobUseCase
  getTypedRetrievalUseCase: GetTypedRetrievalUseCase
  sourceRepository: IKnowledgeSourceRepository
  eventLogRepository: IEventLogRepository
}

const sourceBodySchema = {
  type: 'object',
  required: ['scenarioId', 'name', 'knowledgeType', 'format', 'uriOrPath'],
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    knowledgeType: { type: 'string', enum: ['memory', 'world', 'media'] },
    format: { type: 'string', enum: ['pdf', 'text', 'markdown', 'url', 'media'] },
    uriOrPath: { type: 'string', minLength: 1 },
    metadata: { type: 'object' },
    visibleToAvatarIds: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
  additionalProperties: false,
} as const

const listQuerySchema = {
  type: 'object',
  properties: {
    knowledgeType: { type: 'string', enum: ['memory', 'world', 'media'] },
    status: { type: 'string', enum: ['pending', 'ready', 'error'] },
  },
  additionalProperties: false,
} as const

const sourceParamsSchema = {
  type: 'object',
  required: ['sourceId'],
  properties: { sourceId: { type: 'string', minLength: 1 } },
  additionalProperties: false,
} as const

const scenarioParamsSchema = {
  type: 'object',
  required: ['scenarioId'],
  properties: { scenarioId: { type: 'string', minLength: 1 } },
  additionalProperties: false,
} as const

const jobParamsSchema = {
  type: 'object',
  required: ['ingestionJobId'],
  properties: { ingestionJobId: { type: 'string', minLength: 1 } },
  additionalProperties: false,
} as const

const triggerBodySchema = {
  type: 'object',
  properties: { correlationId: { type: 'string', minLength: 1 } },
  additionalProperties: false,
} as const

const retrievalBodySchema = {
  type: 'object',
  required: ['scenarioId', 'query'],
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
    query: { type: 'string', minLength: 1 },
    sessionId: { type: 'string', minLength: 1 },
    userId: { type: 'string', minLength: 1 },
    conversationId: { type: 'string', minLength: 1 },
    activeAvatarId: { type: 'string', minLength: 1 },
    limitPerType: { type: 'integer', minimum: 1, maximum: 20 },
  },
  additionalProperties: false,
} as const

export const knowledgeRoute: FastifyPluginCallback<KnowledgeRouteOptions> = (app, options) => {
  app.addHook('preValidation', authenticateApiKey(options.config.apiKeySecret))
  const useCases = buildUseCases(options)
  registerCreateSourceRoute(app, useCases)
  registerListSourcesRoute(app, useCases)
  registerTriggerIngestionRoute(app, useCases)
  registerListIngestionJobsRoute(app, useCases)
  registerGetIngestionJobRoute(app, useCases)
  registerRetrievalRoute(app, useCases)
}

function buildUseCases(options: KnowledgeRouteOptions): UseCases {
  const ingestionService = new KnowledgeIngestionService(
    options.sourceRepository,
    options.chunkRepository,
    options.ingestionJobRepository,
    options.sourceContentLoader,
    options.embeddingAdapter,
    options.eventLogRepository,
  )

  return {
    createSourceUseCase: new CreateKnowledgeSourceUseCase(options.sourceRepository),
    listSourcesUseCase: new ListKnowledgeSourcesUseCase(options.sourceRepository),
    triggerIngestionUseCase: new TriggerIngestionUseCase(
      options.sourceRepository,
      options.ingestionJobRepository,
      ingestionService,
    ),
    getIngestionJobUseCase: new GetIngestionJobUseCase(options.ingestionJobRepository),
    getTypedRetrievalUseCase: new GetTypedRetrievalUseCase(
      new TypedRetrievalService(options.sourceRepository, options.chunkRepository),
    ),
    sourceRepository: options.sourceRepository,
    eventLogRepository: options.eventLogRepository,
  }
}

function registerCreateSourceRoute(app: FastifyInstance, useCases: UseCases): void {
  app.post<{ Body: CreateKnowledgeSourceRequest }>(
    '/v1/knowledge-sources',
    { schema: { body: sourceBodySchema } },
    async (request, reply) => {
      try {
        const output = await useCases.createSourceUseCase.execute(request.body)
        return await reply.status(201).send(ok<CreateKnowledgeSourceResponse>(output))
      } catch (error) {
        return await handleError(error, reply)
      }
    },
  )
}

function registerListSourcesRoute(app: FastifyInstance, useCases: UseCases): void {
  app.get<{ Params: ScenarioParams; Querystring: ListKnowledgeSourcesQuery }>(
    '/v1/scenarios/:scenarioId/knowledge-sources',
    { schema: { params: scenarioParamsSchema, querystring: listQuerySchema } },
    async (request, reply) => {
      try {
        const output = await useCases.listSourcesUseCase.execute({
          scenarioId: request.params.scenarioId,
          ...(request.query.knowledgeType !== undefined
            ? { knowledgeType: request.query.knowledgeType }
            : {}),
          ...(request.query.status !== undefined ? { status: request.query.status } : {}),
        })
        return await reply.send(ok<ListKnowledgeSourcesResponse>(output))
      } catch (error) {
        return await handleError(error, reply)
      }
    },
  )
}

function registerTriggerIngestionRoute(app: FastifyInstance, useCases: UseCases): void {
  app.post<{ Params: SourceParams; Body: TriggerIngestionRequest }>(
    '/v1/knowledge-sources/:sourceId/ingest',
    { schema: { params: sourceParamsSchema, body: triggerBodySchema } },
    async (request, reply) => {
      try {
        const output = await useCases.triggerIngestionUseCase.execute({
          sourceId: request.params.sourceId,
          ...(request.body.correlationId !== undefined
            ? { correlationId: request.body.correlationId }
            : {}),
        })
        return await reply.status(202).send(ok<TriggerIngestionResponse>(output))
      } catch (error) {
        return await handleError(error, reply)
      }
    },
  )
}

function registerListIngestionJobsRoute(app: FastifyInstance, useCases: UseCases): void {
  app.get<{ Params: SourceParams }>(
    '/v1/knowledge-sources/:sourceId/ingestion-jobs',
    { schema: { params: sourceParamsSchema } },
    async (request, reply) => {
      try {
        const source = await useCases.sourceRepository.findById(request.params.sourceId)
        if (source === null) {
          return await reply.status(404).send(fail('NOT_FOUND', 'Knowledge source not found.'))
        }
        const output = await useCases.getIngestionJobUseCase.listBySource({
          sourceId: request.params.sourceId,
        })
        return await reply.send(ok<ListIngestionJobsResponse>(output))
      } catch (error) {
        return await handleError(error, reply)
      }
    },
  )
}

function registerGetIngestionJobRoute(app: FastifyInstance, useCases: UseCases): void {
  app.get<{ Params: JobParams }>(
    '/v1/ingestion-jobs/:ingestionJobId',
    { schema: { params: jobParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCases.getIngestionJobUseCase.execute({
          ingestionJobId: request.params.ingestionJobId,
        })
        return await reply.send(ok<GetIngestionJobResponse>(output))
      } catch (error) {
        return await handleError(error, reply)
      }
    },
  )
}

function registerRetrievalRoute(app: FastifyInstance, useCases: UseCases): void {
  app.post<{ Body: QueryKnowledgeRetrievalRequest }>(
    '/v1/admin/knowledge/retrieval',
    { schema: { body: retrievalBodySchema } },
    async (request, reply) => {
      const requestId = crypto.randomUUID()
      const startedAt = Date.now()
      try {
        const output = await useCases.getTypedRetrievalUseCase.execute(request.body)
        const bounded = presentKnowledgeRetrieval(output.retrieval)
        await appendKnowledgeEvent(useCases, {
          type: 'knowledge_retrieval_completed',
          severity: 'info',
          requestId,
          payload: {
            scenarioId: request.body.scenarioId,
            sessionId: request.body.sessionId,
            conversationId: request.body.conversationId,
            counts: {
              memory: bounded.retrieval.memory.length,
              world: bounded.retrieval.world.length,
              media: bounded.retrieval.media.length,
            },
            durationMs: Date.now() - startedAt,
          },
        })
        return await reply.send(ok<QueryKnowledgeRetrievalResponse>(bounded))
      } catch (error) {
        await appendKnowledgeEvent(useCases, {
          type: 'knowledge_retrieval_failed',
          severity: 'error',
          requestId,
          payload: {
            scenarioId: request.body.scenarioId,
            sessionId: request.body.sessionId,
            conversationId: request.body.conversationId,
            durationMs: Date.now() - startedAt,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        })
        return await handleError(error, reply)
      }
    },
  )
}

async function appendKnowledgeEvent(
  useCases: UseCases,
  args: Parameters<IEventLogRepository['append']>[0],
): Promise<void> {
  try {
    await useCases.eventLogRepository.append(args)
  } catch {
    // Avoid coupling admin-debug endpoint availability to observability writes.
  }
}

async function handleError(error: unknown, reply: FastifyReply): Promise<FastifyReply> {
  if (error instanceof DomainError && error.code === 'NOT_FOUND') {
    return await reply.status(404).send(fail('NOT_FOUND', error.message))
  }
  if (
    error instanceof DomainError &&
    (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_INPUT')
  ) {
    return await reply.status(400).send(fail('VALIDATION_ERROR', error.message))
  }
  if (error instanceof DomainError && error.code === 'CONFLICT') {
    return await reply.status(409).send(fail('CONFLICT', error.message))
  }
  return await reply.status(500).send(fail('INTERNAL_ERROR', 'Internal server error'))
}
