import { describe, expect, it } from 'vitest'

import { runCli, type CliIo } from './cli.js'

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
