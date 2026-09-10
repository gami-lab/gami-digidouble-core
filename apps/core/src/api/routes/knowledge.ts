import type { FastifyInstance, FastifyPluginCallback } from 'fastify'
import {
  INGESTION_CHUNK_SIZE_MAX,
  INGESTION_CHUNK_SIZE_MIN,
  KNOWLEDGE_TYPE_INPUTS,
  fail,
  ok,
} from '@gami/shared'
import crypto from 'node:crypto'
import type {
  CreateKnowledgeSourceRequest,
  CreateKnowledgeSourceResponse,
  DeleteKnowledgeSourceResponse,
  GetIngestionJobResponse,
  ListIngestionJobsResponse,
  ListKnowledgeChunksResponse,
  ListKnowledgeSourcesQuery,
  ListKnowledgeSourcesResponse,
  QueryKnowledgeRetrievalRequest,
  QueryKnowledgeRetrievalResponse,
  TriggerIngestionRequest,
  TriggerIngestionResponse,
  UpdateKnowledgeSourceRequest,
  UpdateKnowledgeSourceResponse,
  UploadKnowledgeSourceRequest,
  UploadKnowledgeSourceResponse,
} from '@gami/shared'
import type { IIngestionJobRepository } from '../../application/ports/IIngestionJobRepository.js'
import type { IKnowledgeChunkRepository } from '../../application/ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeCorpusRepository } from '../../application/ports/IKnowledgeCorpusRepository.js'
import type { IKnowledgeSourceRepository } from '../../application/ports/IKnowledgeSourceRepository.js'
import type { IEmbeddingAdapter } from '../../application/ports/IEmbeddingAdapter.js'
import type { IKnowledgeSourceContentLoader } from '../../application/ports/IKnowledgeSourceContentLoader.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import { KnowledgeIngestionService } from '../../application/services/knowledge/knowledge-ingestion.service.js'
import type { TypedRetrievalService } from '../../application/services/knowledge/typed-retrieval.service.js'
import { CreateKnowledgeSourceUseCase } from '../../application/use-cases/create-knowledge-source/create-knowledge-source.use-case.js'
import { DeleteKnowledgeSourceUseCase } from '../../application/use-cases/delete-knowledge-source/delete-knowledge-source.use-case.js'
import { GetIngestionJobUseCase } from '../../application/use-cases/get-ingestion-job/get-ingestion-job.use-case.js'
import { GetTypedRetrievalUseCase } from '../../application/use-cases/get-typed-retrieval/get-typed-retrieval.use-case.js'
import { ListKnowledgeChunksUseCase } from '../../application/use-cases/list-knowledge-chunks/list-knowledge-chunks.use-case.js'
import { ListKnowledgeSourcesUseCase } from '../../application/use-cases/list-knowledge-sources/list-knowledge-sources.use-case.js'
import { TriggerIngestionUseCase } from '../../application/use-cases/trigger-ingestion/trigger-ingestion.use-case.js'
import { UpdateKnowledgeSourceUseCase } from '../../application/use-cases/update-knowledge-source/update-knowledge-source.use-case.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import {
  buildUploadedKnowledgeSourceUpdate,
  toKnowledgeSourceUpdateInput,
  validateUploadedKnowledgeSource,
} from './knowledge-upload.request.js'
import { presentKnowledgeRetrieval } from './knowledge-retrieval.presenter.js'
import { normalizeKnowledgeTypeAtBoundary } from './knowledge-type-input.js'
import { handleKnowledgeRouteError } from './knowledge-route-error.js'

export type KnowledgeRouteOptions = {
  config: Config
  sourceRepository: IKnowledgeSourceRepository
  chunkRepository: IKnowledgeChunkRepository
  knowledgeCorpusRepository: IKnowledgeCorpusRepository
  ingestionJobRepository: IIngestionJobRepository
  sourceContentLoader: IKnowledgeSourceContentLoader
  embeddingAdapter: IEmbeddingAdapter
  eventLogRepository: IEventLogRepository
  typedRetrievalService?: TypedRetrievalService
}

type ScenarioParams = { scenarioId: string }
type SourceParams = { sourceId: string }
type JobParams = { ingestionJobId: string }

type UseCases = {
  createSourceUseCase: CreateKnowledgeSourceUseCase
  listSourcesUseCase: ListKnowledgeSourcesUseCase
  updateSourceUseCase: UpdateKnowledgeSourceUseCase
  deleteSourceUseCase: DeleteKnowledgeSourceUseCase
  triggerIngestionUseCase: TriggerIngestionUseCase
  getIngestionJobUseCase: GetIngestionJobUseCase
  getTypedRetrievalUseCase?: GetTypedRetrievalUseCase
  listChunksUseCase: ListKnowledgeChunksUseCase
  sourceRepository: IKnowledgeSourceRepository
  eventLogRepository: IEventLogRepository
}

const VISIBILITY_POLICY_ENUM = ['all', 'avatars', 'none'] as const

const sourceBodySchema = {
  type: 'object',
  required: ['scenarioId', 'name', 'knowledgeType', 'format', 'uriOrPath'],
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    knowledgeType: { type: 'string', enum: KNOWLEDGE_TYPE_INPUTS },
    format: { type: 'string', enum: ['pdf', 'text', 'markdown', 'url', 'media'] },
    uriOrPath: { type: 'string', minLength: 1 },
    metadata: { type: 'object' },
    visibilityPolicy: { type: 'string', enum: VISIBILITY_POLICY_ENUM },
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
    knowledgeType: { type: 'string', enum: KNOWLEDGE_TYPE_INPUTS },
    status: { type: 'string', enum: ['pending', 'ready', 'error', 'blocked'] },
  },
  additionalProperties: false,
} as const

const sourceParamsSchema = {
  type: 'object',
  required: ['sourceId'],
  properties: { sourceId: { type: 'string', minLength: 1 } },
  additionalProperties: false,
} as const

// All fields are optional — the empty-body guard (at least one field required)
// is enforced in UpdateKnowledgeSourceUseCase, not at the schema level.
const updateSourceBodySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    uriOrPath: { type: 'string', minLength: 1 },
    metadata: { type: 'object' },
    content: { type: 'string', minLength: 1 },
    filename: { type: 'string', minLength: 1 },
    visibilityPolicy: { type: 'string', enum: VISIBILITY_POLICY_ENUM },
    visibleToAvatarIds: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
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
  properties: {
    correlationId: { type: 'string', minLength: 1 },
    chunkSize: {
      type: 'integer',
      minimum: INGESTION_CHUNK_SIZE_MIN,
      maximum: INGESTION_CHUNK_SIZE_MAX,
    },
  },
  additionalProperties: false,
} as const

const uploadBodySchema = {
  type: 'object',
  required: ['scenarioId', 'name', 'knowledgeType', 'content', 'filename'],
  properties: {
    scenarioId: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    knowledgeType: { type: 'string', enum: KNOWLEDGE_TYPE_INPUTS },
    content: { type: 'string', minLength: 1 },
    filename: { type: 'string', minLength: 1 },
    visibilityPolicy: { type: 'string', enum: VISIBILITY_POLICY_ENUM },
    visibleToAvatarIds: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
  },
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
  registerUploadSourceRoute(app, useCases)
  registerListSourcesRoute(app, useCases)
  registerUpdateSourceRoute(app, useCases)
  registerDeleteSourceRoute(app, useCases)
  registerTriggerIngestionRoute(app, useCases)
  registerListIngestionJobsRoute(app, useCases)
  registerGetIngestionJobRoute(app, useCases)
  registerListChunksRoute(app, useCases)
  if (useCases.getTypedRetrievalUseCase !== undefined) {
    registerRetrievalRoute(app, {
      ...useCases,
      getTypedRetrievalUseCase: useCases.getTypedRetrievalUseCase,
    })
  }
}

function buildUseCases(options: KnowledgeRouteOptions): UseCases {
  const ingestionService = new KnowledgeIngestionService(
    options.sourceRepository,
    options.chunkRepository,
    options.ingestionJobRepository,
    options.sourceContentLoader,
    options.embeddingAdapter,
    options.eventLogRepository,
    options.knowledgeCorpusRepository,
  )

  return {
    createSourceUseCase: new CreateKnowledgeSourceUseCase(options.sourceRepository),
    listSourcesUseCase: new ListKnowledgeSourcesUseCase(options.sourceRepository),
    updateSourceUseCase: new UpdateKnowledgeSourceUseCase(options.sourceRepository),
    deleteSourceUseCase: new DeleteKnowledgeSourceUseCase(
      options.sourceRepository,
      options.chunkRepository,
    ),
    triggerIngestionUseCase: new TriggerIngestionUseCase(
      options.sourceRepository,
      options.ingestionJobRepository,
      ingestionService,
    ),
    getIngestionJobUseCase: new GetIngestionJobUseCase(options.ingestionJobRepository),
    ...(options.typedRetrievalService !== undefined
      ? { getTypedRetrievalUseCase: new GetTypedRetrievalUseCase(options.typedRetrievalService) }
      : {}),
    listChunksUseCase: new ListKnowledgeChunksUseCase(
      options.sourceRepository,
      options.chunkRepository,
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
        const output = await useCases.createSourceUseCase.execute({
          ...request.body,
          knowledgeType: await normalizeKnowledgeTypeAtBoundary(
            useCases.eventLogRepository,
            request.body.knowledgeType,
          ),
        })
        return await reply.status(201).send(ok<CreateKnowledgeSourceResponse>(output))
      } catch (error) {
        return await handleKnowledgeRouteError(error, reply)
      }
    },
  )
}

function registerUploadSourceRoute(app: FastifyInstance, useCases: UseCases): void {
  app.post<{ Body: UploadKnowledgeSourceRequest }>(
    '/v1/knowledge-sources/upload',
    { schema: { body: uploadBodySchema } },
    async (request, reply) => {
      try {
        const {
          scenarioId,
          name,
          knowledgeType,
          content,
          filename,
          visibilityPolicy,
          visibleToAvatarIds,
        } = request.body

        const uploaded = await validateUploadedKnowledgeSource(content, filename)
        if (!uploaded.success) {
          return await reply.status(400).send(fail('VALIDATION_ERROR', uploaded.message))
        }

        const output = await useCases.createSourceUseCase.execute({
          scenarioId,
          name,
          knowledgeType: await normalizeKnowledgeTypeAtBoundary(
            useCases.eventLogRepository,
            knowledgeType,
          ),
          format: uploaded.value.format,
          uriOrPath: uploaded.value.filename,
          metadata: { inlineText: uploaded.value.text },
          ...(visibilityPolicy !== undefined ? { visibilityPolicy } : {}),
          ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
        })

        return await reply.status(201).send(ok<UploadKnowledgeSourceResponse>(output))
      } catch (error) {
        return await handleKnowledgeRouteError(error, reply)
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
            ? {
                knowledgeType: await normalizeKnowledgeTypeAtBoundary(
                  useCases.eventLogRepository,
                  request.query.knowledgeType,
                ),
              }
            : {}),
          ...(request.query.status !== undefined ? { status: request.query.status } : {}),
        })
        return await reply.send(ok<ListKnowledgeSourcesResponse>(output))
      } catch (error) {
        return await handleKnowledgeRouteError(error, reply)
      }
    },
  )
}

function registerUpdateSourceRoute(app: FastifyInstance, useCases: UseCases): void {
  app.patch<{ Params: SourceParams; Body: UpdateKnowledgeSourceRequest }>(
    '/v1/knowledge-sources/:sourceId',
    { schema: { params: sourceParamsSchema, body: updateSourceBodySchema } },
    async (request, reply) => {
      try {
        const { metadata, uriOrPath, content, filename } = request.body
        const uploadedUpdate = await buildUploadedKnowledgeSourceUpdate({
          content,
          filename,
          metadata,
          uriOrPath,
        })
        if (!uploadedUpdate.success) {
          return await reply.status(400).send(fail('VALIDATION_ERROR', uploadedUpdate.message))
        }
        const output = await useCases.updateSourceUseCase.execute(
          toKnowledgeSourceUpdateInput(request.params.sourceId, request.body, uploadedUpdate.value),
        )
        return await reply.send(ok<UpdateKnowledgeSourceResponse>(output))
      } catch (error) {
        return await handleKnowledgeRouteError(error, reply)
      }
    },
  )
}

function registerDeleteSourceRoute(app: FastifyInstance, useCases: UseCases): void {
  app.delete<{ Params: SourceParams }>(
    '/v1/knowledge-sources/:sourceId',
    { schema: { params: sourceParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCases.deleteSourceUseCase.execute({
          sourceId: request.params.sourceId,
        })
        return await reply.send(ok<DeleteKnowledgeSourceResponse>(output))
      } catch (error) {
        return await handleKnowledgeRouteError(error, reply)
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
          ...(request.body.chunkSize !== undefined ? { chunkSize: request.body.chunkSize } : {}),
        })
        return await reply.status(202).send(ok<TriggerIngestionResponse>(output))
      } catch (error) {
        return await handleKnowledgeRouteError(error, reply)
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
        return await handleKnowledgeRouteError(error, reply)
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
        return await handleKnowledgeRouteError(error, reply)
      }
    },
  )
}

function registerListChunksRoute(app: FastifyInstance, useCases: UseCases): void {
  app.get<{ Params: SourceParams }>(
    '/v1/knowledge-sources/:sourceId/chunks',
    { schema: { params: sourceParamsSchema } },
    async (request, reply) => {
      try {
        const output = await useCases.listChunksUseCase.execute({
          sourceId: request.params.sourceId,
        })
        return await reply.send(ok<ListKnowledgeChunksResponse>(output))
      } catch (error) {
        return await handleKnowledgeRouteError(error, reply)
      }
    },
  )
}

function registerRetrievalRoute(
  app: FastifyInstance,
  useCases: UseCases & { getTypedRetrievalUseCase: GetTypedRetrievalUseCase },
): void {
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
              avatar_knowledge: bounded.retrieval.avatar_knowledge.length,
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
        return await handleKnowledgeRouteError(error, reply)
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
