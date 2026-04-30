import { describe, expect, it } from 'vitest'
import type { IDependencyProbe } from '../../ports/IDependencyProbe.js'
import { NullProbe } from '../../../infrastructure/health/null.probe.js'
import { GetHealthUseCase } from './get-health.use-case.js'

class DegradedProbe implements IDependencyProbe {
  constructor(private readonly probeName: string) {}

  probe() {
    return Promise.resolve({ name: this.probeName, status: 'degraded' as const })
  }
}

class ThrowingProbe implements IDependencyProbe {
  constructor(private readonly errorMessage: string) {}

  probe(): Promise<never> {
    throw new Error(this.errorMessage)
  }
}

describe('GetHealthUseCase', () => {
  it('returns healthy when all probes are healthy', async () => {
    const useCase = new GetHealthUseCase([
      new NullProbe('postgres'),
      new NullProbe('redis'),
      new NullProbe('llm'),
    ])

    const report = await useCase.execute()

    expect(report.status).toBe('healthy')
    expect(report.dependencies).toHaveLength(3)
  })

  it('returns degraded when one probe is degraded', async () => {
    const useCase = new GetHealthUseCase([
      new NullProbe('postgres'),
      new DegradedProbe('redis'),
      new NullProbe('llm'),
    ])

    const report = await useCase.execute()

    expect(report.status).toBe('degraded')
    expect(
      report.dependencies.some((dep) => dep.name === 'redis' && dep.status === 'degraded'),
    ).toBe(true)
  })

  it('returns degraded when all probes are degraded', async () => {
    const useCase = new GetHealthUseCase([
      new DegradedProbe('postgres'),
      new DegradedProbe('redis'),
      new DegradedProbe('llm'),
    ])

    const report = await useCase.execute()

    expect(report.status).toBe('degraded')
    expect(report.dependencies.every((dep) => dep.status === 'degraded')).toBe(true)
  })

  it('continues when one probe rejects and maps it to unknown degraded', async () => {
    const useCase = new GetHealthUseCase([
      new NullProbe('postgres'),
      new ThrowingProbe('probe exploded'),
      new NullProbe('llm'),
    ])

    const report = await useCase.execute()

    expect(report.status).toBe('degraded')
    expect(report.dependencies).toHaveLength(3)
    expect(report.dependencies).toContainEqual({
      name: 'unknown',
      status: 'degraded',
      message: 'Error: probe exploded',
    })
  })

  it('returns a valid ISO checkedAt timestamp', async () => {
    const useCase = new GetHealthUseCase([new NullProbe('postgres')])

    const report = await useCase.execute()

    expect(Number.isNaN(Date.parse(report.checkedAt))).toBe(false)
  })
})
