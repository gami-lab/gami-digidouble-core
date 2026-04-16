import type {
  IObservabilityAdapter,
  TraceEvent,
} from '../../application/ports/IObservabilityAdapter.js'

/**
 * Observability adapter that writes structured JSON trace events to stdout.
 * Used in local development when Langfuse credentials are not configured.
 */
export class ConsoleObservabilityAdapter implements IObservabilityAdapter {
  trace(event: TraceEvent): Promise<void> {
    console.log(JSON.stringify(event))
    return Promise.resolve()
  }

  flush(): Promise<void> {
    return Promise.resolve()
  }
}
