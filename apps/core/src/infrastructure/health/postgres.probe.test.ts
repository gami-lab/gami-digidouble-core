import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Sql } from 'postgres'
import { PostgresProbe } from './postgres.probe.js'

function createSqlMock(): ReturnType<typeof vi.fn> {
  return vi.fn()
}

describe('PostgresProbe', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns healthy when SELECT 1 succeeds', async () => {
    const sqlMock = createSqlMock().mockResolvedValue([{ '?column?': 1 }])
    const probe = new PostgresProbe(sqlMock as unknown as Sql)

    const result = await probe.probe()

    expect(result.name).toBe('postgres')
    expect(result.status).toBe('healthy')
    expect(typeof result.latencyMs).toBe('number')
    expect(result.message).toBeUndefined()
    expect(sqlMock).toHaveBeenCalledTimes(1)
  })

  it('returns degraded with message when query fails', async () => {
    const sqlMock = createSqlMock().mockRejectedValue(new Error('connection refused'))
    const probe = new PostgresProbe(sqlMock as unknown as Sql)

    const result = await probe.probe()

    expect(result).toMatchObject({
      name: 'postgres',
      status: 'degraded',
      message: 'connection refused',
    })
    expect(typeof result.latencyMs).toBe('number')
  })

  it('returns degraded on timeout within 3.1 seconds', async () => {
    vi.useFakeTimers()
    const sqlMock = createSqlMock().mockReturnValue(new Promise(() => undefined))
    const probe = new PostgresProbe(sqlMock as unknown as Sql)

    const startedAt = Date.now()
    const probePromise = probe.probe()

    await vi.advanceTimersByTimeAsync(3_000)
    const result = await probePromise
    const elapsedMs = Date.now() - startedAt

    expect(result).toMatchObject({
      name: 'postgres',
      status: 'degraded',
      message: 'probe timed out',
    })
    expect(elapsedMs).toBeLessThanOrEqual(3_100)
  })
})
