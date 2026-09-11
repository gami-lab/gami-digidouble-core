import type { FastifyPluginCallback, FastifyRequest } from 'fastify'
import { fail, ok } from '@gami/shared'
import type { SendMessageResponse } from '@gami/shared'
import {
  normalizeSpeechToTextInput,
  SPEECH_TO_TEXT_LIMITS,
  type SpeechToTextInput,
} from '../../application/ports/ISpeechToTextAdapter.js'
import type { VoiceTurnUseCase } from '../../application/use-cases/voice-turn/voice-turn.use-case.js'
import type { StreamingSendMessageEvent } from '../../application/use-cases/send-message/streaming-send-message.types.js'
import type { Config } from '../../config.js'
import { authenticateApiKey } from '../hooks/authenticate.js'
import {
  mapSendMessageResponse,
  mapStreamingEvent,
  writeMessageStreamFrame,
} from './conversation-message-mappers.js'
import { handleRouteError } from './route-error.js'

type VoiceMessagesRouteOptions = {
  config: Config
  voiceTurnUseCase?: VoiceTurnUseCase
}

type VoiceConversationParams = { conversationId: string }
type VoiceRouteGeneric = { Params: VoiceConversationParams; Body: Buffer }

const voiceConversationParamsSchema = {
  type: 'object',
  required: ['conversationId'],
  properties: {
    conversationId: { type: 'string', minLength: 1 },
  },
  additionalProperties: false,
} as const

/** Raw voice parsing is isolated to this plugin and never applies to JSON routes. */
// eslint-disable-next-line max-lines-per-function
export const voiceMessagesRoute: FastifyPluginCallback<VoiceMessagesRouteOptions> = (
  app,
  options,
) => {
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: SPEECH_TO_TEXT_LIMITS.maxAudioBytes },
    (_request, payload, done) => {
      done(null, payload)
    },
  )

  const authenticate = authenticateApiKey(options.config.apiKeySecret)

  app.post<VoiceRouteGeneric>(
    '/:conversationId/voice-messages',
    { onRequest: authenticate, schema: { params: voiceConversationParamsSchema } },
    async (request, reply) => {
      const abortController = new AbortController()
      const onClose = (): void => {
        abortController.abort()
      }
      request.raw.once('close', onClose)
      try {
        if (options.voiceTurnUseCase === undefined) {
          return await reply
            .status(502)
            .send(fail('PROVIDER_ERROR', 'Voice transcription is not configured.'))
        }
        const output = await options.voiceTurnUseCase.execute(buildVoiceInput(request), {
          signal: abortController.signal,
        })
        return await reply.send(ok<SendMessageResponse>(mapSendMessageResponse(output)))
      } catch (error) {
        const mappedError = handleRouteError(error)
        return await reply.status(mappedError.statusCode).send(mappedError.body)
      } finally {
        request.raw.off('close', onClose)
        abortController.abort()
      }
    },
  )

  app.post<VoiceRouteGeneric>(
    '/:conversationId/voice-messages/stream',
    {
      onRequest: authenticate,
      config: { rawBody: true },
      schema: { params: voiceConversationParamsSchema, response: {} },
    },
    // eslint-disable-next-line complexity
    async (request, reply) => {
      if (options.voiceTurnUseCase === undefined) {
        return await reply
          .status(502)
          .send(fail('PROVIDER_ERROR', 'Voice transcription is not configured.'))
      }

      const abortController = new AbortController()
      const onClose = (): void => {
        abortController.abort()
      }
      request.raw.once('close', onClose)
      let iterator: AsyncIterator<StreamingSendMessageEvent> | undefined
      let responseStarted = false
      let streamRequestId: string | undefined

      try {
        const stream = options.voiceTurnUseCase.executeStream(buildVoiceInput(request), {
          signal: abortController.signal,
        })
        iterator = stream[Symbol.asyncIterator]()
        const first = await iterator.next()
        if (first.done) throw new Error('Voice stream ended before it started.')
        streamRequestId = first.value.requestId
        if (!isStreamWritable(reply)) return

        reply.raw.setHeader('Content-Type', 'text/event-stream')
        reply.raw.setHeader('Cache-Control', 'no-cache')
        reply.raw.setHeader('Connection', 'keep-alive')
        reply.raw.setHeader('X-Accel-Buffering', 'no')
        reply.raw.setHeader('Access-Control-Allow-Origin', options.config.corsOrigin)
        await reply.hijack()
        responseStarted = true
        writeMessageStreamFrame(reply.raw, mapStreamingEvent(first.value))

        let next = await iterator.next()
        while (!next.done) {
          if (!isStreamWritable(reply)) break
          writeMessageStreamFrame(reply.raw, mapStreamingEvent(next.value))
          next = await iterator.next()
        }
        if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end()
      } catch (error) {
        if (!responseStarted) {
          const mappedError = handleRouteError(error)
          return await reply.status(mappedError.statusCode).send(mappedError.body)
        }
        if (isStreamWritable(reply)) {
          writeMessageStreamFrame(reply.raw, {
            type: 'conversation.message.error',
            requestId: streamRequestId ?? request.params.conversationId,
            conversationId: request.params.conversationId,
            message: 'Internal server error',
          })
          reply.raw.end()
        }
      } finally {
        request.raw.off('close', onClose)
        abortController.abort()
        await iterator?.return?.()
      }
    },
  )
}

function buildVoiceInput(request: FastifyRequest<VoiceRouteGeneric>): SpeechToTextInput {
  return normalizeSpeechToTextInput({
    conversationId: request.params.conversationId,
    utteranceId: readHeader(request.headers['x-utterance-id']),
    audio: request.body,
    mediaType: readHeader(request.headers['content-type']),
    language: readHeader(request.headers['x-language']),
    durationMs: readDurationHeader(request.headers['x-audio-duration-ms']),
  })
}

function readHeader(value: string | string[] | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return null
  return value
}

function readDurationHeader(value: string | string[] | undefined): number | null | undefined {
  const raw = readHeader(value)
  if (raw === undefined || raw === null || !/^\d+$/u.test(raw.trim()))
    return raw === undefined ? undefined : null
  const durationMs = Number(raw)
  return Number.isSafeInteger(durationMs) && durationMs > 0 ? durationMs : null
}

function isStreamWritable(reply: { raw: { destroyed: boolean; writableEnded: boolean } }): boolean {
  return !reply.raw.destroyed && !reply.raw.writableEnded
}
