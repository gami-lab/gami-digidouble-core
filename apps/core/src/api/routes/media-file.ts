import type { FastifyPluginCallback } from 'fastify'
import { fail } from '@gami/shared'
import type { IMediaAssetRepository } from '../../application/ports/IMediaAssetRepository.js'
import type { ByteRange, IMediaStorage } from '../../application/ports/IMediaStorage.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import { ReadMediaFileUseCase } from '../../application/use-cases/media-assets/read-media-file.use-case.js'

export type MediaFileRouteOptions = {
  scenarioRepository: IScenarioRepository
  mediaAssetRepository: IMediaAssetRepository
  mediaStorage: IMediaStorage
}

type AssetParams = { assetId: string }

/** Upload content never changes under an asset id, so caches may keep it for an hour. */
const CACHE_CONTROL = 'public, max-age=3600'

/**
 * `GET /v1/media/{assetId}` is `open`: `<img>` and `<video>` cannot send a bearer header. It
 * serves uploaded files of active scenarios only, with single-range `Range` support.
 */
export const mediaFileRoute: FastifyPluginCallback<MediaFileRouteOptions> = (app, options) => {
  const readMediaFile = new ReadMediaFileUseCase(
    options.scenarioRepository,
    options.mediaAssetRepository,
    options.mediaStorage,
  )
  app.get<{ Params: AssetParams }>(
    '/:assetId',
    {
      config: { tier: 'open' },
      schema: {
        params: {
          type: 'object',
          required: ['assetId'],
          properties: { assetId: { type: 'string', minLength: 1 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const file = await readMediaFile.find(request.params.assetId)
      if (file === null) {
        return await reply.status(404).send(fail('NOT_FOUND', 'Media not found'))
      }
      const etag = `"${file.asset.assetId}"`
      reply.headers({
        'accept-ranges': 'bytes',
        'cache-control': CACHE_CONTROL,
        etag,
        'x-content-type-options': 'nosniff',
      })
      if (request.headers['if-none-match'] === etag) return await reply.status(304).send()

      const range = parseRange(request.headers.range, file.byteSize)
      if (range === 'unsatisfiable') {
        reply.header('content-range', `bytes */${String(file.byteSize)}`)
        return await reply.status(416).send(fail('VALIDATION_ERROR', 'Range not satisfiable'))
      }
      const stream = await readMediaFile.open(file, range)
      if (stream === null) {
        return await reply.status(404).send(fail('NOT_FOUND', 'Media not found'))
      }
      reply.type(file.asset.mimeType)
      if (range === undefined) {
        reply.header('content-length', String(file.byteSize))
        return await reply.send(stream)
      }
      reply.headers({
        'content-length': String(range.end - range.start + 1),
        'content-range': `bytes ${String(range.start)}-${String(range.end)}/${String(file.byteSize)}`,
      })
      return await reply.status(206).send(stream)
    },
  )
}

/**
 * Parses a single `bytes=` range. A missing, malformed, or multi-range header serves the whole
 * file (servers may ignore `Range`); a well-formed range outside the file is unsatisfiable.
 */
export function parseRange(
  header: string | undefined,
  size: number,
): ByteRange | 'unsatisfiable' | undefined {
  const bounds = rangeBounds(header)
  if (bounds === null) return undefined
  const [startText, endText] = bounds
  if (startText === '') return endText === '' ? undefined : suffixRange(Number(endText), size)
  const start = Number(startText)
  const end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1)
  if (start >= size || start > end) return 'unsatisfiable'
  return { start, end }
}

function suffixRange(length: number, size: number): ByteRange | 'unsatisfiable' {
  if (length === 0 || size === 0) return 'unsatisfiable'
  return { start: Math.max(0, size - length), end: size - 1 }
}

function rangeBounds(header: string | undefined): [string, string] | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '')
  return match === null ? null : [match[1] ?? '', match[2] ?? '']
}
