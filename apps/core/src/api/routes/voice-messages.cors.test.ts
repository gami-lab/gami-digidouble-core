import { describe, expect, it } from 'vitest'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

describe('voice message routes — browser CORS', () => {
  it('allows browsers to send the voice headers through CORS preflight', async () => {
    const app = createServer(TEST_CONFIG)

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/conversations/conversation_1/voice-messages/stream',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers':
          'content-type,x-api-key,x-utterance-id,x-language,x-audio-duration-ms',
      },
    })

    expect(preflight.statusCode).toBe(204)
    const allowed = (preflight.headers['access-control-allow-headers'] ?? '')
      .toLowerCase()
      .split(/,\s*/)
    expect(allowed).toEqual(
      expect.arrayContaining(['x-utterance-id', 'x-language', 'x-audio-duration-ms']),
    )
    await app.close()
  })
})
