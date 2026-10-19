import type { FastifyPluginCallback } from 'fastify'
import {
  MEDIA_PLAYBACK_OUTCOMES,
  ok,
  type ReportMediaPlaybackRequest,
  type ReportMediaPlaybackResponse,
} from '@gami/shared'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import { RecordMediaPlaybackUseCase } from '../../application/use-cases/media-assets/record-media-playback.use-case.js'
import { handleRouteError } from './route-error.js'

export type MediaCuePlaybackRouteOptions = {
  eventLogRepository: IEventLogRepository
}

type PlaybackParams = { sessionId: string; cueId: string }

/**
 * `POST /v1/sessions/{sessionId}/media-cues/{cueId}/playback` (public). The session is
 * ownership-checked by the player hook; the cue is then resolved within that session only.
 */
export const mediaCuePlaybackRoute: FastifyPluginCallback<MediaCuePlaybackRouteOptions> = (
  app,
  options,
) => {
  const recordPlayback = new RecordMediaPlaybackUseCase(options.eventLogRepository)

  app.post<{ Params: PlaybackParams; Body: ReportMediaPlaybackRequest }>(
    '/:sessionId/media-cues/:cueId/playback',
    {
      config: { rateLimit: 'mediaPlayback' },
      schema: {
        params: {
          type: 'object',
          required: ['sessionId', 'cueId'],
          properties: {
            sessionId: { type: 'string', minLength: 1 },
            cueId: { type: 'string', pattern: '^cue_[0-9a-f]{32}$' },
          },
          additionalProperties: false,
        },
        body: {
          type: 'object',
          required: ['outcome'],
          properties: {
            outcome: { type: 'string', enum: MEDIA_PLAYBACK_OUTCOMES },
            clientLatencyMs: { type: 'integer', minimum: 0, maximum: 3_600_000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await recordPlayback.execute({
          sessionId: request.params.sessionId,
          cueId: request.params.cueId,
          outcome: request.body.outcome,
          ...(request.body.clientLatencyMs !== undefined
            ? { clientLatencyMs: request.body.clientLatencyMs }
            : {}),
        })
        return await reply.send(ok<ReportMediaPlaybackResponse>(result))
      } catch (error) {
        const mapped = handleRouteError(error)
        return await reply.status(mapped.statusCode).send(mapped.body)
      }
    },
  )
}
