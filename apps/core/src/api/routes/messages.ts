import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import { SendMessageUseCase } from '../../application/use-cases/send-message/send-message.use-case.js'
import type { SendMessageOutput } from '../../application/use-cases/send-message/send-message.types.js'
import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { Session } from '../../domain/conversation/session.types.js'
import { DomainError } from '../../domain/errors.js'
import type { Config } from '../../config.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createLlmAdapter, LlmError } from '../../infrastructure/llm/index.js'
import type { LlmConfig } from '../../infrastructure/llm/index.js'
import { createObservabilityAdapter } from '../../infrastructure/observability/index.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

type MessagesRouteOptions = {
  config: Config
  llmAdapter?: ILlmAdapter
  observabilityAdapter?: IObservabilityAdapter
  avatarRepository?: IAvatarRepository
  sessionRepository?: ISessionRepository
  messageRepository?: IMessageRepository
}

type MessagesRequestParams = { sessionId: string }

type MessagesRequestBody = {
  avatarId: string
  message: { content: string }
}

type SendMessageResponse = {
  session: {
    sessionId: string
    userId: string
    scenarioId: string
    status: 'active' | 'closed' | 'archived'
    startedAt: string
    lastActivityAt: string
  }
  userMessage: {
    messageId: string
    sessionId: string
    role: 'user'
    content: string
    createdAt: string
  }
  avatarMessage: {
    messageId: string
    sessionId: string
    role: 'avatar'
    content: string
    createdAt: string
    metadata: {
      model: string
      latencyMs: number
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
  }
  debug: {
    requestId: string
    model: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
}

type RouteDependencies = {
  useCase: SendMessageUseCase
  observabilityAdapter: IObservabilityAdapter
  sessionRepository: ISessionRepository
}

const messagesBodySchema = {
  type: 'object',
  required: ['message', 'avatarId'],
  properties: {
    avatarId: { type: 'string', minLength: 1 },
    message: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string', minLength: 1, maxLength: 4000 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const

export const messagesRoute: FastifyPluginCallback<MessagesRouteOptions> = (app, options) => {
  const deps = createRouteDependencies(options)

  app.addHook('onClose', async () => {
    await deps.observabilityAdapter.flush()
  })

  app.post<{ Params: MessagesRequestParams; Body: MessagesRequestBody }>(
    '/:sessionId/messages',
    {
      schema: { body: messagesBodySchema },
      preHandler: authenticateApiKey(options.config.apiKeySecret),
    },
    async (request, reply) => {
      try {
        const output = await deps.useCase.execute({
          sessionId: request.params.sessionId,
          avatarId: request.body.avatarId,
          userMessage: request.body.message.content,
        })
        const session = await getSessionOrThrow(deps.sessionRepository, output.sessionId)
        const response = mapSendMessageResponse(output, session)
        return await reply.send(ok<SendMessageResponse>(response))
      } catch (error) {
        const mappedError = handleRouteError(error)
        return await reply.status(mappedError.statusCode).send(mappedError.body)
      }
    },
  )
}

function createRouteDependencies(options: MessagesRouteOptions): RouteDependencies {
  const llmAdapter = options.llmAdapter ?? createLlmAdapter(buildLlmConfig(options.config))
  const observabilityAdapter =
    options.observabilityAdapter ??
    createObservabilityAdapter({
      langfusePublicKey: options.config.langfusePublicKey,
      langfuseSecretKey: options.config.langfuseSecretKey,
      langfuseHost: options.config.langfuseHost,
    })
  const avatarRepository = options.avatarRepository ?? createDefaultAvatarRepository()
  const sessionRepository = options.sessionRepository ?? createDefaultSessionRepository()
  const messageRepository = options.messageRepository ?? new InMemoryMessageRepository()

  return {
    observabilityAdapter,
    sessionRepository,
    useCase: new SendMessageUseCase(
      sessionRepository,
      avatarRepository,
      messageRepository,
      llmAdapter,
      observabilityAdapter,
    ),
  }
}

function buildLlmConfig(config: Config): LlmConfig {
  return {
    provider: config.llmProvider,
    ...(config.openaiApiKey !== undefined ? { openaiApiKey: config.openaiApiKey } : {}),
    ...(config.anthropicApiKey !== undefined ? { anthropicApiKey: config.anthropicApiKey } : {}),
    ...(config.mistralApiKey !== undefined ? { mistralApiKey: config.mistralApiKey } : {}),
  }
}

function createDefaultAvatarRepository(): InMemoryAvatarRepository {
  return new InMemoryAvatarRepository([
    {
      avatarId: 'ava_demo',
      scenarioId: 'scn_demo',
      name: 'Demo Avatar',
      slug: 'demo-avatar',
      status: 'active',
      personaPrompt: 'You are a helpful assistant.',
    },
  ])
}

function createDefaultSessionRepository(): InMemorySessionRepository {
  return new InMemorySessionRepository([
    {
      sessionId: 'sess_demo',
      userId: 'user_demo',
      scenarioId: 'scn_demo',
      status: 'active',
      startedAt: '2026-01-01T00:00:00.000Z',
      lastActivityAt: '2026-01-01T00:00:00.000Z',
      endedAt: null,
    },
  ])
}

function getSessionOrThrow(
  sessionRepository: ISessionRepository,
  sessionId: string,
): Promise<Session> {
  return sessionRepository.findById(sessionId).then((session) => {
    if (session === null) throw new Error(`Session ${sessionId} was not found after send message.`)
    return session
  })
}

function mapSendMessageResponse(output: SendMessageOutput, session: Session): SendMessageResponse {
  return {
    session: {
      sessionId: session.sessionId,
      userId: session.userId,
      scenarioId: session.scenarioId,
      status: session.status,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
    },
    userMessage: {
      messageId: output.userMessage.messageId,
      sessionId: output.sessionId,
      role: 'user',
      content: output.userMessage.content,
      createdAt: output.userMessage.createdAt,
    },
    avatarMessage: {
      messageId: output.avatarMessage.messageId,
      sessionId: output.sessionId,
      role: 'avatar',
      content: output.avatarMessage.content,
      createdAt: output.avatarMessage.createdAt,
      metadata: {
        model: output.avatarMessage.model,
        latencyMs: output.avatarMessage.latencyMs,
        inputTokens: output.avatarMessage.inputTokens,
        outputTokens: output.avatarMessage.outputTokens,
        totalTokens: output.avatarMessage.inputTokens + output.avatarMessage.outputTokens,
      },
    },
    debug: {
      requestId: output.requestId,
      model: output.avatarMessage.model,
      latencyMs: output.avatarMessage.latencyMs,
      inputTokens: output.avatarMessage.inputTokens,
      outputTokens: output.avatarMessage.outputTokens,
    },
  }
}

function handleRouteError(error: unknown): { statusCode: number; body: ReturnType<typeof fail> } {
  if (error instanceof DomainError) {
    const code = error.code as string
    if (code === 'NOT_FOUND') return { statusCode: 404, body: fail('NOT_FOUND', error.message) }
    if (code === 'CONFLICT' || code === 'SESSION_CLOSED') {
      return { statusCode: 409, body: fail('CONFLICT', error.message) }
    }
    if (code === 'INVALID_INPUT') {
      return { statusCode: 400, body: fail('VALIDATION_ERROR', error.message) }
    }
  }
  if (error instanceof LlmError) {
    return { statusCode: 502, body: fail('EXTERNAL_SERVICE_ERROR', error.message) }
  }
  return { statusCode: 500, body: fail('INTERNAL_ERROR', 'Internal server error') }
}
