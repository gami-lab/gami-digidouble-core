import type { FastifyPluginCallback } from 'fastify'
import { mediaCuePlaybackRoute, type MediaCuePlaybackRouteOptions } from './media-cue-playback.js'
import { mediaFileRoute, type MediaFileRouteOptions } from './media-file.js'

/** The open media file route and the public playback report route. */
export const playerMediaRoutes: FastifyPluginCallback<
  MediaFileRouteOptions & MediaCuePlaybackRouteOptions
> = (app, options, done) => {
  void app.register(mediaFileRoute, { ...options, prefix: '/media' })
  void app.register(mediaCuePlaybackRoute, { ...options, prefix: '/sessions' })
  done()
}
