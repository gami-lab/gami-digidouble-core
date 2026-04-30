import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { assemblePersonaPrompt } from '../../../domain/avatar/persona-prompt.service.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import type { SendMessageInput, SendMessageOutput } from './send-message.types.js'

const MESSAGE_HISTORY_LIMIT = 20

export class SendMessageUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly llm: ILlmAdapter,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly observability: IObservabilityAdapter,
    private readonly runGameMasterUseCase: RunGameMasterUseCase | null = null,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    this.validateInput(input)

    const requestId = crypto.randomUUID()
    const start = Date.now()

    const conversation = await this.loadActiveConversation(input.conversationId)
    const session = await this.loadActiveSession(conversation.sessionId)
    const avatar = await this.loadAvatar(conversation.avatarId)
    await this.loadScenario(session.scenarioId)
    const scenarioAvatars = await this.avatarRepository.listByScenarioId(session.scenarioId)
    const systemPrompt = assemblePersonaPrompt(avatar, {
      ...(session.gmNotes !== undefined ? { gmNotes: session.gmNotes } : {}),
      avatarAwareness: buildAvatarAwareness(avatar, scenarioAvatars, session.unlockedAvatarIds),
    })
    const historyMessages = await this.buildHistoryMessages(conversation.conversationId)
    const userMessage = await this.persistUserMessage(
      conversation.conversationId,
      input.userMessage,
    )
    const llmRequest = {
      systemPrompt,
      messages: [...historyMessages, { role: 'user' as const, content: userMessage.content }],
    }
    const response = await this.llm.complete(llmRequest)
    const avatarMessage = await this.persistAvatarMessage(conversation.conversationId, {
      ...response,
    })
    const now = this.nowIso()
    await this.conversationRepository.update(conversation.conversationId, { lastActivityAt: now })
    const updatedSession = await this.sessionRepository.update(session.sessionId, {
      lastActivityAt: now,
      ...(session.gmNotes !== undefined ? { gmNotes: null } : {}),
    })

    const nextTurnIndex = historyMessages.filter((message) => message.role === 'user').length + 1
    if (this.runGameMasterUseCase !== null) {
      void this.runGameMasterUseCase
        .execute({
          sessionId: session.sessionId,
          scenarioId: session.scenarioId,
          avatarId: conversation.avatarId,
          conversationId: conversation.conversationId,
          userMessageText: input.userMessage,
          turnIndex: nextTurnIndex,
          correlationId: requestId,
        })
        .catch((err: unknown) => {
          console.error(
            '[GM] Background execution failed for session:',
            session.sessionId,
            'correlationId:',
            requestId,
            err,
          )
        })
    }

    const latencyMs = Date.now() - start
    this.emitTurnCompletedEventNonBlocking({
      requestId,
      sessionId: session.sessionId,
      conversationId: conversation.conversationId,
      turnIndex: nextTurnIndex,
      avatarId: conversation.avatarId,
      avatarLatencyMs: response.latencyMs,
      totalTurnLatencyMs: latencyMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      model: response.model,
      hasGm: this.runGameMasterUseCase !== null,
    })
    this.traceNonBlocking(requestId, session.sessionId, llmRequest, response, latencyMs)

    return this.buildOutput(
      requestId,
      conversation,
      updatedSession,
      userMessage,
      avatarMessage,
      response,
      now,
    )
  }

  private buildOutput(
    requestId: string,
    conversation: Conversation,
    updatedSession: Session,
    userMessage: Message,
    avatarMessage: Message,
    response: { model: string; inputTokens: number; outputTokens: number; latencyMs: number },
    now: string,
  ): SendMessageOutput {
    return {
      requestId,
      conversationId: conversation.conversationId,
      conversation: {
        conversationId: conversation.conversationId,
        sessionId: conversation.sessionId,
        avatarId: conversation.avatarId,
        status: conversation.status,
        startedAt: conversation.startedAt,
        lastActivityAt: now,
        ...(conversation.endedAt !== undefined ? { endedAt: conversation.endedAt } : {}),
      },
      session: {
        sessionId: updatedSession.sessionId,
        userId: updatedSession.userId,
        scenarioId: updatedSession.scenarioId,
        ...(updatedSession.activeAvatarId !== undefined
          ? { activeAvatarId: updatedSession.activeAvatarId }
          : {}),
        ...(updatedSession.unlockedAvatarIds !== undefined
          ? { unlockedAvatarIds: updatedSession.unlockedAvatarIds }
          : {}),
        status: updatedSession.status,
        startedAt: updatedSession.startedAt,
        lastActivityAt: now,
      },
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
    if (!hasText(input.conversationId)) {
      throw new DomainError('INVALID_INPUT', 'conversationId must be a non-empty string.')
    }
    if (!hasText(input.userMessage)) {
      throw new DomainError('INVALID_INPUT', 'userMessage must be a non-empty string.')
    }
  }

  private async loadActiveConversation(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findById(conversationId)
    if (conversation === null) {
      throw new DomainError('NOT_FOUND', `Conversation ${conversationId} was not found.`)
    }
    if (conversation.status !== 'active') {
      throw new DomainError('CONFLICT', `Conversation ${conversationId} is not active.`)
    }
    return conversation
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

  private async loadScenario(scenarioId: string): Promise<Scenario> {
    const scenario = await this.scenarioRepository.findById(scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', `Scenario ${scenarioId} was not found.`)
    }
    return scenario
  }

  private async buildHistoryMessages(
    conversationId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const history = await this.messageRepository.findByConversationId(conversationId, {
      limit: MESSAGE_HISTORY_LIMIT,
    })
    const recentHistory = history
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(-MESSAGE_HISTORY_LIMIT)

    return recentHistory.reduce<Array<{ role: 'user' | 'assistant'; content: string }>>(
      (messages, message) => {
        if (message.role === 'user') {
          messages.push({ role: 'user', content: message.content })
          return messages
        }
        if (message.role === 'avatar') {
          messages.push({ role: 'assistant', content: message.content })
        }
        return messages
      },
      [],
    )
  }

  private persistUserMessage(conversationId: string, content: string): Promise<Message> {
    return this.messageRepository.save({
      messageId: this.createMessageId(),
      conversationId,
      role: 'user',
      content,
      createdAt: this.nowIso(),
    })
  }

  private persistAvatarMessage(
    conversationId: string,
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
      conversationId,
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
    llmRequest: {
      systemPrompt: string
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    },
    response: { content: string; model: string; inputTokens: number; outputTokens: number },
    latencyMs: number,
  ): void {
    void this.observability
      .trace({
        requestId,
        sessionId,
        event: 'llm.completion',
        input: {
          systemPrompt: llmRequest.systemPrompt,
          messages: llmRequest.messages,
        },
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

  private emitTurnCompletedEventNonBlocking(args: {
    requestId: string
    sessionId: string
    conversationId: string
    turnIndex: number
    avatarId: string
    avatarLatencyMs: number
    totalTurnLatencyMs: number
    inputTokens: number
    outputTokens: number
    model: string
    hasGm: boolean
  }): void {
    const payload = {
      correlationId: args.requestId,
      conversationId: args.conversationId,
      turnIndex: args.turnIndex,
      avatarId: args.avatarId,
      avatarLatencyMs: args.avatarLatencyMs,
      totalTurnLatencyMs: args.totalTurnLatencyMs,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.inputTokens + args.outputTokens,
      model: args.model,
      hasGm: args.hasGm,
    } as const

    void this.eventLogRepository
      .append({
        sessionId: args.sessionId,
        type: 'turn_completed',
        severity: 'info',
        correlationId: args.requestId,
        payload,
      })
      .catch((err: unknown) => {
        console.error('[send-message] Event log append failed for turn_completed:', err)
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

function buildAvatarAwareness(
  currentAvatar: AvatarConfig,
  scenarioAvatars: AvatarConfig[],
  unlockedAvatarIds: string[] | undefined,
): Array<{
  name: string
  description?: string
  scope?: string
  availability: 'available' | 'locked'
}> {
  return scenarioAvatars
    .filter((avatar) => avatar.status === 'active' && avatar.avatarId !== currentAvatar.avatarId)
    .map((avatar) => ({
      name: avatar.name,
      ...(avatar.description !== undefined ? { description: avatar.description } : {}),
      ...extractPublicScope(avatar),
      availability:
        unlockedAvatarIds === undefined || unlockedAvatarIds.includes(avatar.avatarId)
          ? 'available'
          : 'locked',
    }))
}

function extractPublicScope(avatar: AvatarConfig): { scope?: string } {
  const scope = avatar.config['scope']
  return typeof scope === 'string' && scope.trim().length > 0 ? { scope: scope.trim() } : {}
}
