import type { IConversationMemoryRepository } from '../application/ports/IConversationMemoryRepository.js'
import type { IConversationWorkingMemoryRepository } from '../application/ports/IConversationWorkingMemoryRepository.js'
import { InMemoryConversationMemoryRepository } from '../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../infrastructure/db/in-memory-conversation-working-memory.repository.js'

export type WorkingMemoryRepositoryOptions = {
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  conversationMemoryRepository?: IConversationMemoryRepository
}

export type WorkingMemoryRepositories = {
  conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository
  conversationMemoryRepository: IConversationMemoryRepository
}

export function resolveWorkingMemoryRepositories(
  options: WorkingMemoryRepositoryOptions,
): WorkingMemoryRepositories {
  return {
    conversationWorkingMemoryRepository:
      options.conversationWorkingMemoryRepository ??
      new InMemoryConversationWorkingMemoryRepository(),
    conversationMemoryRepository:
      options.conversationMemoryRepository ?? new InMemoryConversationMemoryRepository(),
  }
}
