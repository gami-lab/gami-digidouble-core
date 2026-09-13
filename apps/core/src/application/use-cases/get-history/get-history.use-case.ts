import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { GetHistoryInput, GetHistoryOutput } from './get-history.types.js'
import { toConversationSummary, toMessage } from '../shared/entity-summaries.js'

export class GetHistoryUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
  ) {}

  async execute(input: GetHistoryInput): Promise<GetHistoryOutput> {
    const conversation = await this.conversationRepository.findById(input.conversationId)
    if (conversation === null) {
      throw new DomainError('NOT_FOUND', `Conversation ${input.conversationId} was not found.`)
    }

    const messages = await this.messageRepository.findByConversationId(input.conversationId)

    // TODO(EPIC-4.2): include session memory summary
    return {
      conversation: toConversationSummary(conversation),
      messages: messages.map(toMessage),
    }
  }
}
