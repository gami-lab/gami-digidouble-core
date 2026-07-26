import type { LlmResponse, LlmStreamOptions } from '../../ports/ILlmAdapter.js'
import { SendMessageUseCase } from './send-message.use-case.js'
import type { SendMessageInput } from './send-message.types.js'
import type { StreamingSendMessageEvent } from './streaming-send-message.types.js'

export class StreamingSendMessageUseCase {
  constructor(private readonly sendMessageUseCase: SendMessageUseCase) {}

  // eslint-disable-next-line complexity
  async *execute(
    input: SendMessageInput,
    options?: LlmStreamOptions,
  ): AsyncIterable<StreamingSendMessageEvent> {
    const turn = await this.sendMessageUseCase.prepareTurn(input)
    yield {
      type: 'started',
      requestId: turn.requestId,
      conversationId: turn.conversation.conversationId,
      userMessage: turn.userMessage,
    }

    let sequence = 0
    let accumulatedContent = ''
    let terminalResponse: LlmResponse | undefined

    try {
      if (turn.adapter.stream === undefined) {
        const response = await turn.adapter.complete(turn.llmRequest)
        accumulatedContent = response.content
        if (response.content.length > 0) {
          yield {
            type: 'delta',
            requestId: turn.requestId,
            conversationId: turn.conversation.conversationId,
            sequence: sequence++,
            delta: response.content,
          }
        }
        terminalResponse = response
      } else {
        for await (const event of turn.adapter.stream(turn.llmRequest, options)) {
          if (event.type === 'delta') {
            accumulatedContent += event.text
            yield {
              type: 'delta',
              requestId: turn.requestId,
              conversationId: turn.conversation.conversationId,
              sequence: sequence++,
              delta: event.text,
            }
            continue
          }

          terminalResponse = {
            ...event.response,
            content: accumulatedContent.length > 0 ? accumulatedContent : event.response.content,
          }
          break
        }
      }

      if (terminalResponse === undefined) {
        throw new Error('LLM stream ended without a terminal completion event.')
      }

      options?.signal?.throwIfAborted()

      const output = await this.sendMessageUseCase.completeTurn(turn, terminalResponse, {
        scheduleBackground: false,
      })
      // Schedule post-turn work before exposing completion to the client. The
      // client may immediately start another turn or abort the stream after
      // receiving the terminal event; GM scheduling must not depend on the
      // consumer requesting one more iterator item.
      this.sendMessageUseCase.schedulePostTurnWork(turn)
      yield {
        type: 'completed',
        requestId: turn.requestId,
        conversationId: turn.conversation.conversationId,
        output,
      }
    } catch (error) {
      if (!isAbortError(error, options?.signal)) throw error

      yield {
        type: 'interrupted',
        requestId: turn.requestId,
        conversationId: turn.conversation.conversationId,
        reason: options?.signal?.aborted ? 'client_aborted' : 'provider_aborted',
      }
    }
  }
}

function isAbortError(error: unknown, signal: AbortSignal | undefined): boolean {
  if (signal?.aborted === true) return true
  return error instanceof Error && error.name === 'AbortError'
}
