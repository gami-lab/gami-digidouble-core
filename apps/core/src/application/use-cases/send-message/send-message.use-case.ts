import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
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
import {
  classifyScenarioTopic,
  resolveCompetenceRedirect,
  resolveUnlocksForTurn,
} from '../../../domain/scenario/scenario-policy.service.js'
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
    const scenario = await this.loadScenario(session.scenarioId)
    const scenarioAvatars = await this.avatarRepository.listByScenarioId(session.scenarioId)
    const topicId = classifyScenarioTopic(input.userMessage, scenario.config)
    const systemPrompt = assemblePersonaPrompt(
      avatar,
      session.gmNotes !== undefined ? { gmNotes: session.gmNotes } : undefined,
    )
    const historyMessages = await this.buildHistoryMessages(conversation.conversationId)
    const userMessage = await this.persistUserMessage(
      conversation.conversationId,
      input.userMessage,
    )
    const redirect = resolveCompetenceRedirect(avatar, topicId)
    const llmRequest = {
      systemPrompt,
      messages: [...historyMessages, { role: 'user' as const, content: userMessage.content }],
    }
    const response =
      redirect === null
        ? await this.llm.complete(llmRequest)
        : {
            content: redirect.message,
            model: 'policy.redirect',
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 0,
          }
    const unlockResult = resolveUnlocksForTurn(
      scenario.config,
      avatar,
      scenarioAvatars,
      topicId,
      session.unlockedAvatarIds,
    )
    const avatarContent = this.buildAvatarContent(
      response.content,
      unlockResult?.introductionMessages,
    )
    const avatarMessage = await this.persistAvatarMessage(conversation.conversationId, {
      ...response,
      content: avatarContent,
    })
    const now = this.nowIso()
    await this.conversationRepository.update(conversation.conversationId, { lastActivityAt: now })
    const updatedSession = await this.sessionRepository.update(session.sessionId, {
      lastActivityAt: now,
      ...(unlockResult !== null ? { unlockedAvatarIds: unlockResult.unlockedAvatarIds } : {}),
      ...(session.gmNotes !== undefined ? { gmNotes: null } : {}),
    })

    if (this.runGameMasterUseCase !== null) {
      const nextTurnIndex = historyMessages.filter((message) => message.role === 'user').length + 1
      void this.runGameMasterUseCase
        .execute({
          sessionId: session.sessionId,
          scenarioId: session.scenarioId,
          avatarId: conversation.avatarId,
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
    if (redirect === null) {
      this.traceNonBlocking(requestId, session.sessionId, llmRequest.messages, response, latencyMs)
    }

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

  private buildAvatarContent(baseContent: string, introductionMessages?: string[]): string {
    if (introductionMessages === undefined || introductionMessages.length === 0) {
      return baseContent
    }

    return [baseContent, ...introductionMessages].join('\n\n')
  }
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}
