import type { FastifyReply } from 'fastify'

/**
 * Streaming routes write to `reply.raw` and then hijack the reply, which skips Fastify's header
 * serialization; headers set earlier by hooks (per-tier CORS) must be copied onto the raw response.
 */
export function copyReplyHeadersToRaw(reply: FastifyReply): void {
  for (const [name, value] of Object.entries(reply.getHeaders())) {
    if (value !== undefined) reply.raw.setHeader(name, value)
  }
}
