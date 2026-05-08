import type { GmStateSummary, UserPersona } from '@gami/shared'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { LayeredMemorySnapshot } from '../../../domain/memory/memory.types.js'
import { AvatarMemoryContextAssembler } from '../../services/avatar-memory-context-assembler.service.js'
import { toGameMasterAvailableAvatars } from '../run-game-master/run-game-master.avatar-unlocks.js'
import type {
  GetSessionContextInput,
  GetSessionContextOutput,
} from './get-session-context.types.js'

const GM_RECENT_MESSAGES_LIMIT = 12
const DEFAULT_GM_STATE: GmStateSummary = {
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
  ) {}

  async execute(input: GetSessionContextInput): Promise<GetSessionContextOutput> {
    const session = await this.loadSessionOrThrow(input.sessionId)
    const contextData = await this.loadContextData(session)
    const scenarioSnapshot = toScenarioSnapshot(session, contextData.scenario)
    return {
      sessionId: session.sessionId,
      avatarContext: this.buildAvatarContext(session, contextData, scenarioSnapshot),
      gmContext: this.buildGmContext(session, contextData, scenarioSnapshot),
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

    return {
      scenario,
      activeConversation,
      scenarioAvatars,
      gmState,
      userPersona,
      memorySnapshot,
      recentMessages,
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

  private buildAvatarContext(
    session: Session,
    contextData: Awaited<ReturnType<GetSessionContextUseCase['loadContextData']>>,
    scenario: ReturnType<typeof toScenarioSnapshot>,
  ): GetSessionContextOutput['avatarContext'] {
    const avatarId = contextData.activeConversation?.avatarId
    return {
      ...(avatarId !== undefined ? { avatarId } : {}),
      recentExchanges: contextData.memorySnapshot?.shortTerm?.recentExchanges ?? [],
      workingMemory: toAvatarWorkingMemory(contextData.memorySnapshot),
      longTermFacts: contextData.memorySnapshot?.longTerm?.facts ?? [],
      userPersona: contextData.userPersona,
      gmNotes: session.gmNotes ?? null,
      scenario,
    }
  }

  private buildGmContext(
    session: Session,
    contextData: Awaited<ReturnType<GetSessionContextUseCase['loadContextData']>>,
    scenario: ReturnType<typeof toScenarioSnapshot>,
  ): GetSessionContextOutput['gmContext'] {
    const workingSummary = toWorkingSummary(contextData.memorySnapshot)
    return {
      recentMessages: contextData.recentMessages,
      memory: {
        ...(contextData.memorySnapshot?.shortTerm?.recentExchanges !== undefined
          ? { shortTerm: { recentExchanges: contextData.memorySnapshot.shortTerm.recentExchanges } }
          : {}),
        ...(workingSummary !== undefined ? { workingSummary } : {}),
        ...(contextData.memorySnapshot?.longTerm?.facts !== undefined
          ? { longTermFacts: contextData.memorySnapshot.longTerm.facts }
          : {}),
      },
      currentState: contextData.gmState ?? DEFAULT_GM_STATE,
      availableAvatars: toGameMasterAvailableAvatars(contextData.scenarioAvatars, session),
      userPersona: contextData.userPersona,
      scenario,
    }
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

function toAvatarWorkingMemory(memorySnapshot: LayeredMemorySnapshot | undefined) {
  return {
    ...(memorySnapshot?.working?.session !== undefined
      ? { session: memorySnapshot.working.session }
      : {}),
    ...(memorySnapshot?.working?.avatar !== undefined
      ? { avatar: memorySnapshot.working.avatar }
      : {}),
  }
}

function toWorkingSummary(memorySnapshot: LayeredMemorySnapshot | undefined) {
  if (memorySnapshot === undefined) return undefined
  return toWorkingSummaryFromSnapshot(memorySnapshot)
}

function toWorkingSummaryFromSnapshot(memorySnapshot: LayeredMemorySnapshot) {
  const segments: string[] = []
  if (hasText(memorySnapshot.working?.session?.summary)) {
    segments.push(memorySnapshot.working.session.summary.trim())
  }
  if (hasText(memorySnapshot.working?.avatar?.summary)) {
    segments.push(
      `Avatar (${memorySnapshot.working.avatar.avatarId}): ${memorySnapshot.working.avatar.summary.trim()}`,
    )
  }

  return segments.length > 0 ? segments.join('\n') : undefined
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
