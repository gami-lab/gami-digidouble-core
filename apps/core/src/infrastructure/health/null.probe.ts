import type { IDependencyProbe } from '../../application/ports/IDependencyProbe.js'
import type { DependencyProbeResult } from '../../domain/health/index.js'

export class NullProbe implements IDependencyProbe {
  constructor(private readonly name: string) {}

  probe(): Promise<DependencyProbeResult> {
    return Promise.resolve({ name: this.name, status: 'healthy', latencyMs: 0 })
  }
}
