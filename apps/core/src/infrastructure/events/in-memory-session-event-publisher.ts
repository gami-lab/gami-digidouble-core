import type { RuntimeEvent } from '@gami/shared'
import type {
  ISessionEventPublisher,
  SessionEventHandler,
} from '../../application/ports/ISessionEventPublisher.js'

export class InMemorySessionEventPublisher implements ISessionEventPublisher {
  private readonly subscribers = new Map<string, Set<SessionEventHandler>>()
  private readonly lastEvents = new Map<string, RuntimeEvent>()
  private readonly processing = new Set<string>()

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
      const handlersForSession = this.subscribers.get(sessionId)
      handlersForSession?.delete(handler)
      if (handlersForSession !== undefined && handlersForSession.size === 0) {
        this.subscribers.delete(sessionId)
      }
    }
  }

  isProcessing(sessionId: string): boolean {
    return this.processing.has(sessionId)
  }

  setProcessing(sessionId: string, value: boolean): void {
    if (value) {
      this.processing.add(sessionId)
      return
    }
    this.processing.delete(sessionId)
  }

  getLastEvent(sessionId: string): RuntimeEvent | undefined {
    return this.lastEvents.get(sessionId)
  }
}
