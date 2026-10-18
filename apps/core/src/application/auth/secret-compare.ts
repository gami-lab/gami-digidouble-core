import { timingSafeEqual } from 'node:crypto'

/** Constant-time comparison for credentials and signatures. */
export function areSecretsEqual(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(receivedBuffer, expectedBuffer)
}
