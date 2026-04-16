import type {
  IObservabilityAdapter,
  TraceEvent,
} from '../../application/ports/IObservabilityAdapter.js'

/**
 * No-op observability adapter for unit and integration tests.
 * trace() and flush() resolve immediately without any side effects.
 */
export class NullObservabilityAdapter implements IObservabilityAdapter {
  trace(_event: TraceEvent): Promise<void> {
    return Promise.resolve()
  }

  flush(): Promise<void> {
    return Promise.resolve()
  }
}
