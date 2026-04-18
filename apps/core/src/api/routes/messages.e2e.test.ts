import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { Config } from '../../config.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/index.js'
import { createServer } from '../server.js'

type MessagesRouteData = {
  avatarMessage: {
    content: string
  }
}

function makeConfig(): Config {
  return {
    port: 3000,
    host: '0.0.0.0',
    nodeEnv: 'test',
    logLevel: 'silent',
    databaseUrl: 'postgresql://test',
    redisUrl: 'redis://test',
    apiKeySecret: 'e2e-secret',
    llmProvider: 'openai',
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: undefined,
    mistralApiKey: undefined,
    langfusePublicKey: undefined,
    langfuseSecretKey: undefined,
    langfuseHost: undefined,
  }
}

const openaiKey = process.env['OPENAI_API_KEY']

describe.skipIf(!openaiKey)(
  'E2E — POST /v1/conversations/:sessionId/messages with real OpenAI',
  () => {
    it('preserves multi-turn context across sequential messages', async () => {
      const app = createServer(makeConfig(), {
        observabilityAdapter: new NullObservabilityAdapter(),
        avatarRepository: new InMemoryAvatarRepository([
          {
            avatarId: 'ava_e2e',
            scenarioId: 'scn_e2e',
            name: 'Archivist',
            slug: 'archivist',
            status: 'active',
            personaPrompt: 'You are a precise archivist. Follow user instructions exactly.',
            tone: 'direct',
          },
        ]),
        sessionRepository: new InMemorySessionRepository([
          {
            sessionId: 'sess_e2e',
            userId: 'user_e2e',
            scenarioId: 'scn_e2e',
            status: 'active',
            startedAt: '2026-04-18T10:00:00.000Z',
            lastActivityAt: '2026-04-18T10:00:00.000Z',
            endedAt: null,
          },
        ]),
        messageRepository: new InMemoryMessageRepository(),
      })

      const first = await app.inject({
        method: 'POST',
        url: '/v1/conversations/sess_e2e/messages',
        headers: { 'x-api-key': 'e2e-secret' },
        payload: {
          avatarId: 'ava_e2e',
          message: {
            content:
              'Remember the codeword LUMEN-42 for this session and reply with a short acknowledgment.',
          },
        },
      })
      expect(first.statusCode).toBe(200)

      const second = await app.inject({
        method: 'POST',
        url: '/v1/conversations/sess_e2e/messages',
        headers: { 'x-api-key': 'e2e-secret' },
        payload: {
          avatarId: 'ava_e2e',
          message: {
            content:
              'What codeword did I ask you to remember earlier in this conversation? Reply with the codeword only.',
          },
        },
      })
      await app.close()

      expect(second.statusCode).toBe(200)
      const secondBody = second.json<ApiResponse<MessagesRouteData>>()
      expect(secondBody.error).toBeNull()
      expect(secondBody.data).not.toBeNull()
      expect(secondBody.data?.avatarMessage.content).toContain('LUMEN-42')
    }, 30_000)
  },
)
