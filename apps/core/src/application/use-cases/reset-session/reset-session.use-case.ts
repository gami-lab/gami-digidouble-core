import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IAvatarSessionMemoryRepository } from '../../ports/IAvatarSessionMemoryRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionMemoryRepository } from '../../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import { resolveInitialUnlockedAvatarIds } from '../../../domain/scenario/scenario-policy.service.js'
import type { ResetSessionInput, ResetSessionOutput } from './reset-session.types.js'

export class ResetSessionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly sessionMemoryRepository?: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository,
  ) {}

  async execute(input: ResetSessionInput): Promise<ResetSessionOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const scenario = await this.scenarioRepository.findById(session.scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', `Scenario ${session.scenarioId} was not found.`)
    }
    const scenarioAvatars = await this.avatarRepository.listByScenarioId(session.scenarioId)
    const initialUnlockedAvatarIds = resolveInitialUnlockedAvatarIds(
      scenario.config,
      scenarioAvatars,
    )

    const conversations = await this.conversationRepository.listBySessionId(input.sessionId)
    await Promise.all(
      conversations.map((conversation) =>
        this.messageRepository.deleteByConversationId(conversation.conversationId),
      ),
    )
    await this.conversationRepository.deleteBySessionId(input.sessionId)
    await this.sessionMemoryRepository?.deleteBySessionId(input.sessionId)
    await this.avatarSessionMemoryRepository?.deleteBySessionId(input.sessionId)

    try {
      const updated = await this.sessionRepository.update(input.sessionId, {
        activeAvatarId: null,
        ...(initialUnlockedAvatarIds !== undefined
          ? { unlockedAvatarIds: initialUnlockedAvatarIds }
          : {}),
        gmNotes: null,
        memorySummary: null,
        status: 'active',
        lastActivityAt: new Date().toISOString(),
      })
      return { session: updated }
    } catch (error) {
      throw new DomainError(
        'INTERNAL_ERROR',
        `Failed to reset session ${input.sessionId}: ${String(error)}`,
      )
    }
  }
}
