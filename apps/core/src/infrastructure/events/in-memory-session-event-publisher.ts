import type { RuntimeEvent } from '@gami/shared'
import type {
  ISessionEventPublisher,
  SessionEventHandler,
} from '../../application/ports/ISessionEventPublisher.js'

export class InMemorySessionEventPublisher implements ISessionEventPublisher {
  private readonly subscribers = new Map<string, Set<SessionEventHandler>>()
  private readonly lastEvents = new Map<string, RuntimeEvent>()

  emit(event: RuntimeEvent): void {
    this.lastEvents.set(event.sessionId, event)
    const handlers = this.subscribers.get(event.sessionId)
    if (handlers === undefined) return
    for (const handler of handlers) {
      handler(event)
    }
  }

  subscribe(sessionId: string, handler: SessionEventHandler): () => void {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set())
    }

    const handlers = this.subscribers.get(sessionId)
    if (handlers === undefined) {
      throw new Error('Session handlers set missing after initialization')
    }

    handlers.add(handler)

    return () => {
      this.subscribers.get(sessionId)?.delete(handler)
    }
  }

  getLastEvent(sessionId: string): RuntimeEvent | undefined {
    return this.lastEvents.get(sessionId)
  }
}
