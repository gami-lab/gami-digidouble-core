import { Readable } from 'node:stream'
import type { FastifyPluginCallback } from 'fastify'
import { AUDIO_OUTPUT_FORMATS, fail } from '@gami/shared'
import type { AudioDeliveryRequest } from '@gami/shared'
import type { SynthesizeMessageAudioUseCase } from '../../application/use-cases/synthesize-message-audio/synthesize-message-audio.use-case.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import { handleRouteError } from './route-error.js'

type ConversationMessageAudioRouteOptions = {
  config: Config
  synthesizeMessageAudioUseCase?: SynthesizeMessageAudioUseCase
}

type ConversationMessageAudioParams = {
  conversationId: string
  messageId: string
}

const paramsSchema = {
  type: 'object',
  required: ['conversationId', 'messageId'],
  properties: {
    conversationId: { type: 'string', minLength: 1 },
    messageId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

const bodySchema = {
  type: 'object',
  properties: {
    format: { type: 'string', enum: AUDIO_OUTPUT_FORMATS },
  },
  additionalProperties: false,
} as const

export const conversationMessageAudioRoute: FastifyPluginCallback<
  ConversationMessageAudioRouteOptions
> = (app, options) => {
  app.post<{
    Params: ConversationMessageAudioParams
    Body: AudioDeliveryRequest | undefined
  }>(
    '/:conversationId/messages/:messageId/audio',
    {
      onRequest: authenticateApiKey(options.config.apiKeySecret),
      schema: { params: paramsSchema, body: bodySchema },
    },
    async (request, reply) => {
      if (options.synthesizeMessageAudioUseCase === undefined) {
        return await reply
          .status(502)
          .send(fail('PROVIDER_ERROR', 'Audio synthesis is not configured.'))
      }

      // The response outlives this handler while it streams, so the provider request is
      // cancelled when the connection closes rather than when the handler returns.
      const abortController = new AbortController()
      reply.raw.once('close', () => {
        abortController.abort()
      })

      try {
        const output = await options.synthesizeMessageAudioUseCase.execute({
          conversationId: request.params.conversationId,
          messageId: request.params.messageId,
          requestId: request.id,
          ...(request.body?.format === undefined ? {} : { format: request.body.format }),
          signal: abortController.signal,
        })

        reply.header('Content-Type', output.metadata.format)
        reply.header('Content-Disposition', 'inline')
        reply.header('Cache-Control', 'no-store')
        reply.header('X-Request-Id', output.metadata.requestId)
        reply.header('X-Message-Id', output.metadata.messageId)
        return await reply.send(Readable.from(output.audio, { objectMode: false }))
      } catch (error) {
        const mappedError = handleRouteError(error)
        return await reply.status(mappedError.statusCode).send(mappedError.body)
      }
    },
  )
}
