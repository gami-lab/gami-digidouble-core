import { describe, expect, it } from 'vitest'

import {
  countConsecutiveModelFailures,
  MAX_CONSECUTIVE_MODEL_FAILURES,
  runCli,
  type CliIo,
} from './cli.js'

function createIo(): CliIo & { errors: string[]; logs: string[] } {
  const logs: string[] = []
  const errors: string[] = []
  return {
    logs,
    errors,
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
  }
}

describe('runCli', () => {
  it('requires three consecutive infrastructure failures before stopping comparison', () => {
    expect(countConsecutiveModelFailures('api_error', 0)).toBe(1)
    expect(countConsecutiveModelFailures('judge_error', 1)).toBe(2)
    expect(countConsecutiveModelFailures('judge_error', 2)).toBe(MAX_CONSECUTIVE_MODEL_FAILURES)
    expect(countConsecutiveModelFailures('completed', 2)).toBe(0)
  })

  it('prints help without requiring configuration or network access', async () => {
    const io = createIo()

    await expect(runCli(['--help'], {}, io)).resolves.toBe(0)
    expect(io.logs[0]).toContain('Conversation evaluation')
    expect(io.errors).toEqual([])
  })

  it('reports configuration failures without exposing credentials', async () => {
    const io = createIo()

    await expect(runCli(['--api-key', 'secret-value'], {}, io)).resolves.toBe(1)
    expect(io.logs).toEqual([])
    expect(io.errors[0]).toContain('Missing definition path')
    expect(io.errors.join('\n')).not.toContain('secret-value')
  })
})
