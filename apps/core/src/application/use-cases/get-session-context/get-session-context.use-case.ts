import type { UserPersona } from '../../../domain/user/user.types.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import { ContextEngine } from '../../../domain/context/context-engine.service.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { DomainError } from '../../../domain/errors.js'
import { AvatarMemoryContextAssembler } from '../../services/avatar-memory-context-assembler.service.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import { toGameMasterAvailableAvatars } from '../run-game-master/run-game-master.avatar-unlocks.js'
import type {
  GetSessionContextInput,
  GetSessionContextOutput,
} from './get-session-context.types.js'

const GM_RECENT_MESSAGES_LIMIT = 12
const DEFAULT_GM_STATE = {
  progression: '',
  topicsCovered: [],
  interactionCount: 0,
}

export class GetSessionContextUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly gmStateRepository: IGmStateRepository,
    private readonly userRepository?: IUserRepository,
    private readonly memoryContextAssembler?: AvatarMemoryContextAssembler,
    private readonly typedRetrievalService?: TypedRetrievalService,
    private readonly contextEngine: ContextEngine = new ContextEngine(),
  ) {}

  async execute(input: GetSessionContextInput): Promise<GetSessionContextOutput> {
    const session = await this.loadSessionOrThrow(input.sessionId)
    const contextData = await this.loadContextData(session)
    const scenarioSnapshot = toScenarioSnapshot(session, contextData.scenario)
    const assembled = this.contextEngine.assemble({
      sessionId: session.sessionId,
      ...(contextData.activeConversation?.avatarId !== undefined
        ? { activeAvatarId: contextData.activeConversation.avatarId }
        : {}),
      recentMessages: contextData.recentMessages,
      scenario: scenarioSnapshot,
      availableAvatars: toGameMasterAvailableAvatars(contextData.scenarioAvatars, session),
      gmState: contextData.gmState ?? DEFAULT_GM_STATE,
      extensions: {
        memory: contextData.memorySnapshot,
        retrieval: contextData.retrieval,
        userPersona: contextData.userPersona,
        gmDirective: session.gmNotes ?? null,
      },
    })

    return {
      sessionId: session.sessionId,
      avatarContext: assembled.avatar,
      gmContext: assembled.gm,
      contextTrace: assembled.trace,
    }
  }

  private async loadSessionOrThrow(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
    return session
  }

  private async loadContextData(session: Session) {
    const [scenario, activeConversation, scenarioAvatars, gmState, userPersona] = await Promise.all(
      [
        this.scenarioRepository.findById(session.scenarioId),
        this.conversationRepository.findActiveBySessionId(session.sessionId),
        this.avatarRepository.listByScenarioId(session.scenarioId),
        this.gmStateRepository.findBySessionId(session.sessionId),
        this.loadUserPersona(session.userId),
      ],
    )

    const memorySnapshot = await this.loadMemorySnapshot(
      session,
      activeConversation?.avatarId,
      activeConversation?.conversationId,
    )
    const recentMessages = await this.loadContextRecentMessages(activeConversation?.conversationId)
    const retrieval = await this.loadTypedRetrieval(
      session,
      recentMessages,
      activeConversation?.avatarId,
    )

    return {
      scenario,
      activeConversation,
      scenarioAvatars,
      gmState,
      userPersona,
      memorySnapshot,
      recentMessages,
      retrieval,
    }
  }

  private async loadMemorySnapshot(
    session: Session,
    avatarId: string | undefined,
    conversationId: string | undefined,
  ) {
    if (
      this.memoryContextAssembler === undefined ||
      avatarId === undefined ||
      conversationId === undefined
    ) {
      return undefined
    }

    return this.memoryContextAssembler.build({
      conversationId,
      sessionId: session.sessionId,
      avatarId,
      userId: session.userId,
    })
  }

  private async loadContextRecentMessages(conversationId: string | undefined) {
    if (conversationId === undefined) return []
    return this.loadRecentMessages(conversationId)
  }

  private async loadTypedRetrieval(
    session: Session,
    recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>,
    activeAvatarId: string | undefined,
  ) {
    if (this.typedRetrievalService === undefined) return undefined
    const query = buildRetrievalQuery(recentMessages)
    if (query.length === 0) return undefined

    return this.typedRetrievalService.retrieve({
      scenarioId: session.scenarioId,
      sessionId: session.sessionId,
      userId: session.userId,
      ...(activeAvatarId !== undefined ? { activeAvatarId } : {}),
      query,
      limitPerType: 3,
    })
  }

  private async loadRecentMessages(conversationId: string) {
    const messages = await this.messageRepository.findByConversationId(conversationId, {
      limit: GM_RECENT_MESSAGES_LIMIT,
    })

    return messages
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((message) => ({ role: message.role, content: message.content }))
  }

  private async loadUserPersona(userId: string): Promise<UserPersona | null> {
    if (this.userRepository === undefined) return null
    try {
      const user = await this.userRepository.findById(userId)
      return user?.persona ?? null
    } catch {
      return null
    }
  }
}

function buildRetrievalQuery(
  recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>,
): string {
  const userMessages = recentMessages.filter((message) => message.role === 'user')
  return userMessages
    .slice(-2)
    .map((message) => message.content.trim())
    .join(' ')
    .trim()
}

function toScenarioSnapshot(session: Session, scenario: Scenario | null) {
  const goals = scenario !== null ? normalizeGoals(scenario.config) : []
  return {
    scenarioId: session.scenarioId,
    ...(scenario !== null ? { name: scenario.name } : {}),
    ...(scenario?.config.worldContext !== undefined
      ? { description: scenario.config.worldContext }
      : {}),
    ...(goals.length > 0 ? { goals } : {}),
  }
}

function normalizeGoals(config: { objectives?: string[]; goals?: string[] }): string[] {
  return [
    ...(Array.isArray(config.objectives) ? config.objectives : []),
    ...(Array.isArray(config.goals) ? config.goals : []),
  ]
}
