function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export default async function globalSetup(): Promise<void> {
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'
  const candidates = ['/health', '/v1/health', '/']

  let lastError: string | null = null

  for (const path of candidates) {
    const url = `${appUrl}${path}`
    try {
      await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      return
    } catch (error) {
      lastError = formatError(error)
    }
  }

  throw new Error(
    [
      `Stack E2E preflight failed: cannot reach app at ${appUrl}.`,
      'Start the stack before running stack-e2e tests (for example: docker compose -f docker-compose.e2e.yml up --wait).',
      lastError !== null ? `Last probe error: ${lastError}` : null,
    ]
      .filter((line): line is string => line !== null)
      .join(' '),
  )
}
