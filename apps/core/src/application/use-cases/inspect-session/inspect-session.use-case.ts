import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'
import { DEFAULT_MODEL_CONFIG, ModelResolutionService } from '../../../domain/model-config/index.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  InspectSessionInput,
  InspectSessionOutput,
  SessionSummary,
  InspectTransitionRecord,
} from './inspect-session.types.js'

export class InspectSessionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly gmStateRepository: IGmStateRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly modelConfigRepository: IModelConfigRepository,
  ) {}

  async execute(input: InspectSessionInput): Promise<InspectSessionOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const [gmState, conversations, modelConfig, activeAvatar] = await Promise.all([
      this.gmStateRepository.findBySessionId(input.sessionId),
      this.conversationRepository.listBySessionId(input.sessionId),
      this.modelConfigRepository.get(),
      session.activeAvatarId === undefined
        ? Promise.resolve(null)
        : this.avatarRepository.findById(session.activeAvatarId),
    ])
    const resolvedConfig = modelConfig ?? DEFAULT_MODEL_CONFIG

    return {
      inspect: {
        session: toSessionSummary(session),
        gmState,
        transitionHistory: toTransitionHistory(conversations),
        unlockedAvatarIds: session.unlockedAvatarIds ?? [],
        gmNotes: session.gmNotes ?? null,
        effectiveModels: {
          avatar: ModelResolutionService.resolve(
            'avatar',
            resolvedConfig,
            activeAvatar?.llmOverride,
          ),
          gameMaster: ModelResolutionService.resolve('gameMaster', resolvedConfig),
          memory: ModelResolutionService.resolve('memory', resolvedConfig),
        },
      },
    }
  }
}

function toSessionSummary(session: Session): SessionSummary {
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    scenarioId: session.scenarioId,
    ...(session.activeAvatarId !== undefined ? { activeAvatarId: session.activeAvatarId } : {}),
    ...(session.unlockedAvatarIds !== undefined
      ? { unlockedAvatarIds: [...session.unlockedAvatarIds] }
      : {}),
    status: session.status,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
  }
}

function toTransitionHistory(conversations: Conversation[]): InspectTransitionRecord[] {
  const ordered = conversations
    .slice()
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))

  return ordered
    .map((conversation, index) => ({
      fromAvatarId: index === 0 ? null : (ordered[index - 1]?.avatarId ?? null),
      toAvatarId: conversation.avatarId,
      reason: conversation.reason ?? null,
      startedBy: conversation.startedBy ?? null,
      transitionedAt: conversation.startedAt,
    }))
    .reverse()
}
