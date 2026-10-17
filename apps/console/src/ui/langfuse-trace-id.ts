/**
 * Maps a Core trace id (requestId, `gm_<id>`, …) to the OpenTelemetry trace id Core exports to
 * Langfuse. Must stay identical to `createTraceId(seed)` from `@langfuse/tracing`: the first 32 hex
 * characters of the seed's SHA-256.
 */
export async function langfuseTraceId(coreTraceId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(coreTraceId))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}
