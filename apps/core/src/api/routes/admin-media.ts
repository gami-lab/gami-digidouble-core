import type { FastifyInstance, FastifyPluginCallback, FastifyReply } from 'fastify'
import {
  MEDIA_LIMITS,
  MEDIA_MIME_TYPES,
  MEDIA_REF_PATTERN,
  MEDIA_URL_PATTERN,
  ok,
  type CreateUrlMediaAssetRequest,
  type DeleteMediaAssetResponse,
  type ListMediaAssetsResponse,
  type MediaAssetResponse,
  type UpdateMediaAssetRequest,
  type UploadMediaAssetQuery,
} from '@gami/shared'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IMediaAssetRepository } from '../../application/ports/IMediaAssetRepository.js'
import type { IMediaStorage } from '../../application/ports/IMediaStorage.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import { CreateUrlMediaAssetUseCase } from '../../application/use-cases/media-assets/create-url-media-asset.use-case.js'
import { DeleteMediaAssetUseCase } from '../../application/use-cases/media-assets/delete-media-asset.use-case.js'
import { ListMediaAssetsUseCase } from '../../application/use-cases/media-assets/list-media-assets.use-case.js'
import { UpdateMediaAssetUseCase } from '../../application/use-cases/media-assets/update-media-asset.use-case.js'
import { UploadMediaAssetUseCase } from '../../application/use-cases/media-assets/upload-media-asset.use-case.js'
import { ReadMediaFileUseCase } from '../../application/use-cases/media-assets/read-media-file.use-case.js'
import { assetFileParamsSchema, sendMediaFile } from './media-file.js'
import { mediaRefSchema } from './presentation-schema.js'
import { handleRouteError } from './route-error.js'

export type AdminMediaRouteOptions = {
  scenarioRepository: IScenarioRepository
  avatarRepository: IAvatarRepository
  mediaAssetRepository: IMediaAssetRepository
  mediaStorage: IMediaStorage
}

type ScenarioParams = { scenarioId: string }
type AssetParams = { assetId: string }

const scenarioParamsSchema = {
  type: 'object',
  required: ['scenarioId'],
  properties: { scenarioId: { type: 'string', minLength: 1 } },
  additionalProperties: false,
} as const

const assetParamsSchema = {
  type: 'object',
  required: ['assetId'],
  properties: { assetId: { type: 'string', minLength: 1 } },
  additionalProperties: false,
} as const

const description = {
  type: 'string',
  minLength: 1,
  maxLength: MEDIA_LIMITS.descriptionMaxLength,
  pattern: '\\S',
} as const
const durationMs = { type: 'integer', minimum: 0, maximum: MEDIA_LIMITS.durationMsMax } as const

const createUrlBodySchema = {
  type: 'object',
  required: ['url', 'mimeType', 'description'],
  properties: {
    url: { type: 'string', maxLength: MEDIA_LIMITS.urlMaxLength, pattern: MEDIA_URL_PATTERN },
    mimeType: { type: 'string', enum: [...MEDIA_MIME_TYPES.image, ...MEDIA_MIME_TYPES.video] },
    description,
    cueable: { type: 'boolean' },
    posterAssetId: mediaRefSchema,
    durationMs,
  },
  additionalProperties: false,
} as const

const updateBodySchema = {
  type: 'object',
  minProperties: 1,
  properties: {
    description,
    cueable: { type: 'boolean' },
    posterAssetId: { anyOf: [{ type: 'null' }, mediaRefSchema] },
    durationMs: { anyOf: [{ type: 'null' }, durationMs] },
  },
  additionalProperties: false,
} as const

const uploadQuerySchema = {
  type: 'object',
  required: ['description'],
  properties: {
    description,
    cueable: { type: 'string', enum: ['true', 'false'] },
    posterAssetId: { type: 'string', pattern: MEDIA_REF_PATTERN },
    durationMs: { type: 'string', pattern: '^[0-9]{1,9}$' },
  },
  additionalProperties: false,
} as const

export const adminMediaRoute: FastifyPluginCallback<AdminMediaRouteOptions> = (app, options) => {
  const list = new ListMediaAssetsUseCase(options.scenarioRepository, options.mediaAssetRepository)
  const createUrl = new CreateUrlMediaAssetUseCase(
    options.scenarioRepository,
    options.mediaAssetRepository,
  )
  const update = new UpdateMediaAssetUseCase(options.mediaAssetRepository)
  const remove = new DeleteMediaAssetUseCase(
    options.scenarioRepository,
    options.avatarRepository,
    options.mediaAssetRepository,
    options.mediaStorage,
  )

  app.get<{ Params: ScenarioParams }>(
    '/scenarios/:scenarioId/media',
    { schema: { params: scenarioParamsSchema } },
    async (request, reply) =>
      handle(reply, async () => {
        const assets = await list.execute(request.params.scenarioId)
        return ok<ListMediaAssetsResponse>({ assets })
      }),
  )

  app.post<{ Params: ScenarioParams; Body: CreateUrlMediaAssetRequest }>(
    '/scenarios/:scenarioId/media',
    { schema: { params: scenarioParamsSchema, body: createUrlBodySchema } },
    async (request, reply) =>
      handle(reply, async () => {
        const asset = await createUrl.execute(request.params.scenarioId, request.body)
        reply.status(201)
        return ok<MediaAssetResponse>({ asset })
      }),
  )

  app.patch<{ Params: AssetParams; Body: UpdateMediaAssetRequest }>(
    '/media/:assetId',
    { schema: { params: assetParamsSchema, body: updateBodySchema } },
    async (request, reply) =>
      handle(reply, async () => {
        const asset = await update.execute(request.params.assetId, request.body)
        return ok<MediaAssetResponse>({ asset })
      }),
  )

  app.delete<{ Params: AssetParams }>(
    '/media/:assetId',
    { schema: { params: assetParamsSchema } },
    async (request, reply) =>
      handle(reply, async () => {
        await remove.execute(request.params.assetId)
        return ok<DeleteMediaAssetResponse>({ assetId: request.params.assetId, deleted: true })
      }),
  )

  const readMediaFile = new ReadMediaFileUseCase(
    options.scenarioRepository,
    options.mediaAssetRepository,
    options.mediaStorage,
  )
  app.get<{ Params: AssetParams }>(
    '/media/:assetId/file',
    { schema: { params: assetFileParamsSchema } },
    async (request, reply) =>
      sendMediaFile(
        request,
        reply,
        readMediaFile,
        await readMediaFile.find(request.params.assetId, { activeScenarioOnly: false }),
        'private, no-cache',
      ),
  )

  app.register(uploadRoute, options)
}

/** The upload streams the raw request body to storage; the parser never reads it into memory. */
function uploadRoute(
  app: FastifyInstance,
  options: AdminMediaRouteOptions,
  done: () => void,
): void {
  const upload = new UploadMediaAssetUseCase(
    options.scenarioRepository,
    options.mediaAssetRepository,
    options.mediaStorage,
  )
  app.addContentTypeParser('*', (_request, _payload, parsed) => {
    parsed(null)
  })

  app.post<{ Params: ScenarioParams; Querystring: UploadMediaAssetQuery }>(
    '/scenarios/:scenarioId/media/upload',
    { schema: { params: scenarioParamsSchema, querystring: uploadQuerySchema } },
    async (request, reply) => {
      const startedAt = Date.now()
      return handle(reply, async () => {
        const declared = Number(request.headers['content-length'])
        const asset = await upload.execute({
          scenarioId: request.params.scenarioId,
          contentType: request.headers['content-type'] ?? '',
          ...(Number.isFinite(declared) ? { declaredByteSize: declared } : {}),
          content: request.raw,
          description: request.query.description,
          cueable: request.query.cueable === 'true',
          ...(request.query.posterAssetId !== undefined
            ? { posterAssetId: request.query.posterAssetId }
            : {}),
          ...(request.query.durationMs !== undefined
            ? { durationMs: Number(request.query.durationMs) }
            : {}),
        })
        request.log.info(
          {
            event: 'media.uploaded',
            assetId: asset.assetId,
            byteSize: asset.byteSize,
            mimeType: asset.mimeType,
            durationMs: Date.now() - startedAt,
          },
          'Media asset uploaded',
        )
        reply.status(201)
        return ok<MediaAssetResponse>({ asset })
      })
    },
  )
  done()
}

async function handle(reply: FastifyReply, run: () => Promise<unknown>): Promise<FastifyReply> {
  try {
    return await reply.send(await run())
  } catch (error) {
    const mapped = handleRouteError(error)
    if (mapped.statusCode === 500) reply.log.error({ err: error }, 'Media route failed')
    return await reply.status(mapped.statusCode).send(mapped.body)
  }
}
