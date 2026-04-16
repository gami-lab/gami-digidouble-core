import type { ILlmAdapter } from '../../ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { SendRawMessageInput, SendRawMessageOutput } from './send-raw-message.types.js'

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.'

export class SendRawMessageUseCase {
  constructor(
    private readonly llm: ILlmAdapter,
    private readonly observability: IObservabilityAdapter,
  ) {}

  async execute(input: SendRawMessageInput): Promise<SendRawMessageOutput> {
    const requestId = crypto.randomUUID()
    const start = Date.now()

    const response = await this.llm.complete({
      systemPrompt: input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: input.userMessage }],
    })

    const latencyMs = Date.now() - start

    void this.observability
      .trace({
        requestId,
        event: 'llm.completion',
        latencyMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        metadata: { model: response.model },
      })
      .catch((err: unknown) => {
        console.error('[send-raw-message] Observability trace failed:', err)
      })

    return {
      requestId,
      reply: response.content,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs,
    }
  }
}
