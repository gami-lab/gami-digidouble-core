import type { IDependencyProbe } from '../../ports/IDependencyProbe.js'
import type {
  DependencyProbeResult,
  HealthReport,
  HealthStatus,
} from '../../../domain/health/index.js'

export class GetHealthUseCase {
  constructor(private readonly probes: IDependencyProbe[]) {}

  async execute(): Promise<HealthReport> {
    const settledResults = await Promise.allSettled(
      this.probes.map(async (probe) => await probe.probe()),
    )

    const dependencies = settledResults.map((settled): DependencyProbeResult => {
      if (settled.status === 'fulfilled') {
        return settled.value
      }

      return {
        name: 'unknown',
        status: 'degraded',
        message: String(settled.reason),
      }
    })

    const status: HealthStatus = dependencies.every((result) => result.status === 'healthy')
      ? 'healthy'
      : 'degraded'

    return {
      status,
      dependencies,
      checkedAt: new Date().toISOString(),
    }
  }
}
