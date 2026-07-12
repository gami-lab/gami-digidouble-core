import type { IAvatarRepository } from '../../application/ports/IAvatarRepository.js'
import type { IAvatarSessionMemoryRepository } from '../../application/ports/IAvatarSessionMemoryRepository.js'
import type { IConversationMemoryRepository } from '../../application/ports/IConversationMemoryRepository.js'
import type { IConversationRepository } from '../../application/ports/IConversationRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../application/ports/IConversationWorkingMemoryRepository.js'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../application/ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import type { IGmStateRepository } from '../../application/ports/IGmStateRepository.js'
import type { ISessionEventPublisher } from '../../application/ports/ISessionEventPublisher.js'
import type { ISessionMemoryRepository } from '../../application/ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../application/ports/ISessionRepository.js'
import type { IModelConfigRepository } from '../../application/ports/IModelConfigRepository.js'
import { EpisodicMemoryService } from '../../application/services/episodic-memory.service.js'
import { MemoryMaintenanceService } from '../../application/services/memory-maintenance.service.js'
import { DeleteSessionUseCase } from '../../application/use-cases/delete-session/delete-session.use-case.js'
import { EndConversationUseCase } from '../../application/use-cases/end-conversation/end-conversation.use-case.js'
import { GetAvailableAvatarsUseCase } from '../../application/use-cases/get-available-avatars/get-available-avatars.use-case.js'
import { GetAvatarTransitionsUseCase } from '../../application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.js'
import { GetRuntimeStateUseCase } from '../../application/use-cases/get-runtime-state/get-runtime-state.use-case.js'
import { GetSessionUseCase } from '../../application/use-cases/get-session/get-session.use-case.js'
import { ListSessionConversationsUseCase } from '../../application/use-cases/list-session-conversations/list-session-conversations.use-case.js'
import { ListSessionsUseCase } from '../../application/use-cases/list-sessions/list-sessions.use-case.js'
import { ResetSessionUseCase } from '../../application/use-cases/reset-session/reset-session.use-case.js'
import type { RunGameMasterUseCase } from '../../application/use-cases/run-game-master/run-game-master.use-case.js'
import { StartConversationUseCase } from '../../application/use-cases/start-conversation/start-conversation.use-case.js'
import { StartSessionUseCase } from '../../application/use-cases/start-session/start-session.use-case.js'
import { SwitchAvatarUseCase } from '../../application/use-cases/switch-avatar/switch-avatar.use-case.js'
import type { ModelConfig } from '../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../infrastructure/llm/llm-adapter-registry.js'

export type SessionRouteUseCases = {
  startSessionUseCase: StartSessionUseCase
  getSessionUseCase: GetSessionUseCase
  listSessionsUseCase: ListSessionsUseCase
  resetSessionUseCase: ResetSessionUseCase
  startConversationUseCase: StartConversationUseCase
  listSessionConversationsUseCase: ListSessionConversationsUseCase
  switchAvatarUseCase: SwitchAvatarUseCase
  getAvailableAvatarsUseCase: GetAvailableAvatarsUseCase
  getAvatarTransitionsUseCase: GetAvatarTransitionsUseCase
  getRuntimeStateUseCase: GetRuntimeStateUseCase
  endConversationUseCase: EndConversationUseCase
  deleteSessionUseCase: DeleteSessionUseCase
}

// eslint-disable-next-line max-lines-per-function
export function createSessionRouteUseCases(deps: {
  sessionRepository: ISessionRepository
  scenarioRepository: IScenarioRepository
  avatarRepository: IAvatarRepository
  conversationRepository: IConversationRepository
  gmStateRepository: IGmStateRepository
  messageRepository: IMessageRepository
  sessionMemoryRepository: ISessionMemoryRepository
  avatarSessionMemoryRepository: IAvatarSessionMemoryRepository
  conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository
  conversationMemoryRepository: IConversationMemoryRepository
  eventLogRepository: IEventLogRepository
  sessionEventPublisher: ISessionEventPublisher
  llmAdapter: ILlmAdapter
  modelConfigRepository?: IModelConfigRepository
  llmAdapterRegistry?: LlmAdapterRegistry
  modelConfigFallback?: ModelConfig
  runGameMasterUseCase?: RunGameMasterUseCase
}): SessionRouteUseCases {
  const memoryMaintenance = new MemoryMaintenanceService(
    deps.messageRepository,
    deps.conversationWorkingMemoryRepository,
    deps.eventLogRepository,
    deps.llmAdapter,
    deps.modelConfigRepository,
    deps.llmAdapterRegistry,
    deps.modelConfigFallback,
  )
  const episodicMemoryService = new EpisodicMemoryService(
    deps.conversationMemoryRepository,
    deps.conversationWorkingMemoryRepository,
    deps.messageRepository,
  )

  return {
    startSessionUseCase: new StartSessionUseCase(
      deps.sessionRepository,
      deps.scenarioRepository,
      deps.avatarRepository,
    ),
    getSessionUseCase: new GetSessionUseCase(deps.sessionRepository),
    listSessionsUseCase: new ListSessionsUseCase(deps.sessionRepository),
    resetSessionUseCase: new ResetSessionUseCase(
      deps.sessionRepository,
      deps.scenarioRepository,
      deps.avatarRepository,
      deps.conversationRepository,
      deps.messageRepository,
      deps.sessionMemoryRepository,
      deps.avatarSessionMemoryRepository,
      deps.conversationWorkingMemoryRepository,
      deps.conversationMemoryRepository,
    ),
    startConversationUseCase: new StartConversationUseCase(
      deps.sessionRepository,
      deps.avatarRepository,
      deps.conversationRepository,
      deps.conversationWorkingMemoryRepository,
      episodicMemoryService,
      deps.eventLogRepository,
      memoryMaintenance,
      deps.gmStateRepository,
      deps.runGameMasterUseCase,
    ),
    listSessionConversationsUseCase: new ListSessionConversationsUseCase(
      deps.sessionRepository,
      deps.conversationRepository,
    ),
    switchAvatarUseCase: new SwitchAvatarUseCase(
      deps.sessionRepository,
      deps.avatarRepository,
      deps.conversationRepository,
      memoryMaintenance,
      episodicMemoryService,
      deps.conversationWorkingMemoryRepository,
      deps.eventLogRepository,
      deps.gmStateRepository,
      deps.runGameMasterUseCase,
    ),
    getAvailableAvatarsUseCase: new GetAvailableAvatarsUseCase(
      deps.sessionRepository,
      deps.avatarRepository,
    ),
    getAvatarTransitionsUseCase: new GetAvatarTransitionsUseCase(
      deps.sessionRepository,
      deps.conversationRepository,
    ),
    getRuntimeStateUseCase: new GetRuntimeStateUseCase(
      deps.sessionRepository,
      deps.conversationRepository,
      deps.sessionEventPublisher,
    ),
    endConversationUseCase: new EndConversationUseCase(
      deps.sessionRepository,
      deps.conversationRepository,
      deps.eventLogRepository,
      memoryMaintenance,
      deps.sessionEventPublisher,
      undefined,
      undefined,
      undefined,
      episodicMemoryService,
    ),
    deleteSessionUseCase: new DeleteSessionUseCase(deps.sessionRepository),
  }
}
