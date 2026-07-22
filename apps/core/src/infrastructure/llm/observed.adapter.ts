import crypto from 'node:crypto'
import type {
  ILlmAdapter,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  LlmStreamOptions,
} from '../../application/ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'

export class ObservedLlmAdapter implements ILlmAdapter {
  constructor(
    private readonly inner: ILlmAdapter,
    private readonly observability: IObservabilityAdapter,
  ) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const { trace, ...providerRequest } = request
    const traceContext = this.buildTraceContext(trace, providerRequest)

    try {
      const response = await this.inner.complete(providerRequest)
      this.traceSuccess(traceContext, response)
      return response
    } catch (error) {
      this.traceFailure(traceContext, error)
      throw error
    }
  }

  async *stream(request: LlmRequest, options?: LlmStreamOptions): AsyncIterable<LlmStreamEvent> {
    const { trace, ...providerRequest } = request
    const traceContext = this.buildTraceContext(trace, providerRequest)

    try {
      if (this.inner.stream === undefined) {
        options?.signal?.throwIfAborted()
        const response = await this.inner.complete(providerRequest)
        if (response.content.length > 0) {
          yield { type: 'delta', text: response.content }
        }
        this.traceSuccess(traceContext, response)
        yield { type: 'completed', response }
        return
      }

      for await (const event of this.inner.stream(providerRequest, options)) {
        if (event.type === 'completed') {
          this.traceSuccess(traceContext, event.response)
        }
        yield event
      }
    } catch (error) {
      this.traceFailure(traceContext, error)
      throw error
    }
  }

  private buildTraceContext(
    trace: LlmRequest['trace'],
    providerRequest: Omit<LlmRequest, 'trace'>,
  ): {
    requestId: string
    sessionId?: string
    successEvent: string
    errorEvent: string
    input: ReturnType<typeof toTraceInput>
    metadata?: Record<string, unknown>
  } {
    const successEvent = trace?.event ?? 'llm.completion'
    const requestId = trace?.requestId ?? crypto.randomUUID()
    const input = toTraceInput(providerRequest)
    const sessionId = readSessionId(trace)
    const metadata = readMetadata(trace)

    return {
      requestId,
      ...(sessionId !== undefined ? { sessionId } : {}),
      successEvent,
      errorEvent: trace?.errorEvent ?? `${successEvent}.error`,
      input,
      ...(metadata !== undefined ? { metadata } : {}),
    }
  }

  private traceSuccess(
    traceContext: ReturnType<ObservedLlmAdapter['buildTraceContext']>,
    response: LlmResponse,
  ): void {
    this.traceNonBlocking({
      requestId: traceContext.requestId,
      ...(traceContext.sessionId !== undefined ? { sessionId: traceContext.sessionId } : {}),
      event: traceContext.successEvent,
      input: traceContext.input,
      output: response.content,
      latencyMs: response.latencyMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      metadata: {
        ...(traceContext.metadata ?? {}),
        model: response.model,
      },
    })
  }

  private traceFailure(
    traceContext: ReturnType<ObservedLlmAdapter['buildTraceContext']>,
    error: unknown,
  ): void {
    this.traceNonBlocking({
      requestId: traceContext.requestId,
      ...(traceContext.sessionId !== undefined ? { sessionId: traceContext.sessionId } : {}),
      event: traceContext.errorEvent,
      input: traceContext.input,
      output: error instanceof Error ? error.message : 'Unknown LLM error',
      ...(traceContext.metadata !== undefined ? { metadata: traceContext.metadata } : {}),
    })
  }

  private traceNonBlocking(event: Parameters<IObservabilityAdapter['trace']>[0]): void {
    void this.observability.trace(event).catch((error: unknown) => {
      console.error('[observed-llm] Observability trace failed:', error)
    })
  }
}

function toTraceInput(request: Omit<LlmRequest, 'trace'>): {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: string
  maxTokens?: number
} {
  return {
    systemPrompt: request.systemPrompt,
    messages: request.messages,
    ...(request.model !== undefined ? { model: request.model } : {}),
    ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}),
  }
}

function readSessionId(trace: LlmRequest['trace']): string | undefined {
  return trace?.sessionId
}

function readMetadata(trace: LlmRequest['trace']): Record<string, unknown> | undefined {
  return trace?.metadata
}
