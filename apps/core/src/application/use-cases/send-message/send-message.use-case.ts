import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { ILlmAdapter } from '../../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { assemblePersonaPrompt } from '../../../domain/avatar/persona-prompt.service.js'
import type { Message, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { SendMessageInput, SendMessageOutput } from './send-message.types.js'

const MESSAGE_HISTORY_LIMIT = 20

export class SendMessageUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly llm: ILlmAdapter,
    private readonly observability: IObservabilityAdapter,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    this.validateInput(input)

    const requestId = crypto.randomUUID()
    const start = Date.now()

    const session = await this.loadActiveSession(input.sessionId)
    const avatar = await this.loadAvatar(input.avatarId)
    const systemPrompt = assemblePersonaPrompt(avatar)
    const historyMessages = await this.buildHistoryMessages(session.sessionId)
    const userMessage = await this.persistUserMessage(session.sessionId, input.userMessage)

    const llmRequest = {
      systemPrompt,
      messages: [...historyMessages, { role: 'user' as const, content: userMessage.content }],
    }
    const response = await this.llm.complete(llmRequest)
    const avatarMessage = await this.persistAvatarMessage(session.sessionId, response)

    // TODO(EPIC-2.2): trigger GM observation

    const latencyMs = Date.now() - start
    this.traceNonBlocking(requestId, session.sessionId, llmRequest.messages, response, latencyMs)

    return {
      requestId,
      sessionId: session.sessionId,
      userMessage: {
        messageId: userMessage.messageId,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      avatarMessage: {
        messageId: avatarMessage.messageId,
        content: avatarMessage.content,
        createdAt: avatarMessage.createdAt,
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      },
    }
  }

  private validateInput(input: SendMessageInput): void {
    if (!hasText(input.sessionId)) {
      throw new DomainError('INVALID_INPUT', 'sessionId must be a non-empty string.')
    }
    if (!hasText(input.avatarId)) {
      throw new DomainError('INVALID_INPUT', 'avatarId must be a non-empty string.')
    }
    if (!hasText(input.userMessage)) {
      throw new DomainError('INVALID_INPUT', 'userMessage must be a non-empty string.')
    }
  }

  private async loadActiveSession(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
    if (session.status !== 'active') {
      throw new DomainError('CONFLICT', `Session ${sessionId} is not active.`)
    }
    return session
  }

  private async loadAvatar(avatarId: string): Promise<AvatarConfig> {
    const avatar = await this.avatarRepository.findById(avatarId)
    if (avatar === null) {
      throw new DomainError('NOT_FOUND', `Avatar ${avatarId} was not found.`)
    }
    return avatar
  }

  private async buildHistoryMessages(
    sessionId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const history = await this.messageRepository.findBySessionId(sessionId, {
      limit: MESSAGE_HISTORY_LIMIT,
    })
    return history
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((message) => ({
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content,
      }))
  }

  private persistUserMessage(sessionId: string, content: string): Promise<Message> {
    return this.messageRepository.save({
      messageId: this.createMessageId(),
      sessionId,
      role: 'user',
      content,
      createdAt: this.nowIso(),
    })
  }

  private persistAvatarMessage(
    sessionId: string,
    response: {
      content: string
      model: string
      inputTokens: number
      outputTokens: number
      latencyMs: number
    },
  ): Promise<Message> {
    return this.messageRepository.save({
      messageId: this.createMessageId(),
      sessionId,
      role: 'avatar',
      content: response.content,
      createdAt: this.nowIso(),
      metadata: {
        model: response.model,
        latencyMs: response.latencyMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        totalTokens: response.inputTokens + response.outputTokens,
      },
    })
  }

  private traceNonBlocking(
    requestId: string,
    sessionId: string,
    input: Array<{ role: 'user' | 'assistant'; content: string }>,
    response: { content: string; model: string; inputTokens: number; outputTokens: number },
    latencyMs: number,
  ): void {
    void this.observability
      .trace({
        requestId,
        sessionId,
        event: 'llm.completion',
        input,
        output: response.content,
        latencyMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        metadata: { model: response.model },
      })
      .catch((err: unknown) => {
        console.error('[send-message] Observability trace failed:', err)
      })
  }

  private createMessageId(): string {
    return `msg_${crypto.randomUUID()}`
  }

  private nowIso(): string {
    return new Date().toISOString()
  }
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}
