import type { RuntimeState } from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { GetRuntimeStateInput, GetRuntimeStateOutput } from './get-runtime-state.types.js'

export class GetRuntimeStateUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly eventPublisher: ISessionEventPublisher,
  ) {}

  async execute(input: GetRuntimeStateInput): Promise<GetRuntimeStateOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session '${input.sessionId}' not found`)
    }

    const activeConversation =
      session.activeAvatarId !== undefined
        ? await this.conversationRepository.findActiveBySessionId(input.sessionId)
        : null

    const canSendMessage =
      session.status === 'active' &&
      activeConversation !== null &&
      activeConversation.status === 'active'

    const isProcessing = this.eventPublisher.isProcessing(input.sessionId)
    const pendingEvent = this.eventPublisher.getLastEvent(input.sessionId)

    const runtimeState: RuntimeState = {
      sessionId: session.sessionId,
      ...(activeConversation?.conversationId !== undefined
        ? { conversationId: activeConversation.conversationId }
        : {}),
      canSendMessage,
      isProcessing,
      ...(pendingEvent !== undefined ? { pendingEvent } : {}),
      updatedAt: new Date().toISOString(),
    }

    return { runtimeState }
  }
}
