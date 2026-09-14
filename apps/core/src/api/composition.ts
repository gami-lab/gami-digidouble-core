import type { IAvatarSessionMemoryRepository } from '../application/ports/IAvatarSessionMemoryRepository.js'
import type { IConversationMemoryRepository } from '../application/ports/IConversationMemoryRepository.js'
import type { IConversationWorkingMemoryRepository } from '../application/ports/IConversationWorkingMemoryRepository.js'
import type { ISessionMemoryRepository } from '../application/ports/ISessionMemoryRepository.js'
import { InMemoryAvatarSessionMemoryRepository } from '../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryConversationMemoryRepository } from '../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemorySessionMemoryRepository } from '../infrastructure/db/in-memory-session-memory.repository.js'

export type WorkingMemoryRepositoryOptions = {
  sessionMemoryRepository?: ISessionMemoryRepository
  avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  conversationMemoryRepository?: IConversationMemoryRepository
}

export type WorkingMemoryRepositories = {
  sessionMemoryRepository: ISessionMemoryRepository
  avatarSessionMemoryRepository: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository
  conversationMemoryRepository: IConversationMemoryRepository
}

export function resolveWorkingMemoryRepositories(
  options: WorkingMemoryRepositoryOptions,
): WorkingMemoryRepositories {
  return {
    sessionMemoryRepository:
      options.sessionMemoryRepository ?? new InMemorySessionMemoryRepository(),
    avatarSessionMemoryRepository:
      options.avatarSessionMemoryRepository ?? new InMemoryAvatarSessionMemoryRepository(),
    conversationWorkingMemoryRepository:
      options.conversationWorkingMemoryRepository ??
      new InMemoryConversationWorkingMemoryRepository(),
    conversationMemoryRepository:
      options.conversationMemoryRepository ?? new InMemoryConversationMemoryRepository(),
  }
}
