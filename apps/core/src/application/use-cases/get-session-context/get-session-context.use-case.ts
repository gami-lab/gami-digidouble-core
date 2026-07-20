import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { ContextEngine } from '../../../domain/context/context-engine.service.js'
import { DomainError } from '../../../domain/errors.js'
import { MEMORY_LONG_TERM_FACT_LIMIT } from '../../../domain/memory/memory.policy.js'
import {
  selectExchangeMessageWindow,
  selectExchangeWindow,
} from '../../services/conversation-exchange-window.js'
import type {
  GetSessionContextInput,
  GetSessionContextOutput,
} from './get-session-context.types.js'

const DEFAULT_CONTEXT_ENGINE = new ContextEngine()

type RuntimeData = Awaited<ReturnType<GetSessionContextUseCase['loadRuntimeData']>>
type CompleteRuntimeData = RuntimeData & {
  avatar: NonNullable<RuntimeData['avatar']>
  scenario: NonNullable<RuntimeData['scenario']>
}

export class GetSessionContextUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository,
    private readonly userRepository?: IUserRepository,
    private readonly gmStateRepository?: IGmStateRepository,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
  ) {}

  async execute(input: GetSessionContextInput): Promise<GetSessionContextOutput> {
    const session = await this.loadSessionOrThrow(input.sessionId)
    const runtimeData = await this.loadRuntimeData(session)

    if (runtimeData.avatar === null || runtimeData.scenario === null) {
      throw new DomainError(
        'NOT_FOUND',
        `Session ${session.sessionId} runtime context is incomplete.`,
      )
    }

    const assembled = this.assembleContext(session, {
      ...runtimeData,
      avatar: runtimeData.avatar,
      scenario: runtimeData.scenario,
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

  private async loadRuntimeData(session: Session) {
    const activeConversation = await this.conversationRepository.findActiveBySessionId(
      session.sessionId,
    )
    const conversationId = activeConversation?.conversationId
    const activeAvatarId = activeConversation?.avatarId ?? session.activeAvatarId

    const [avatar, scenario, scenarioAvatars, conversationData, userData] = await Promise.all([
      this.loadActiveAvatar(activeAvatarId),
      this.scenarioRepository.findById(session.scenarioId),
      this.avatarRepository.listByScenarioId(session.scenarioId),
      this.loadConversationData(conversationId),
      this.loadUserData(session),
    ])

    return {
      activeAvatarId,
      avatar,
      scenario,
      scenarioAvatars,
      workingMemory: conversationData.workingMemory,
      messages: conversationData.messages,
      user: userData.user,
      gmState: userData.gmState,
      userFacts: userData.userFacts,
    }
  }

  private assembleContext(session: Session, runtimeData: CompleteRuntimeData) {
    const recentExchanges = selectExchangeWindow(
      runtimeData.messages,
      runtimeData.workingMemory?.updatedAt,
      1,
    )

    return DEFAULT_CONTEXT_ENGINE.assemble({
      sessionId: session.sessionId,
      ...(runtimeData.activeAvatarId !== undefined
        ? { activeAvatarId: runtimeData.activeAvatarId }
        : {}),
      recentMessages: selectExchangeMessageWindow(
        runtimeData.messages,
        runtimeData.workingMemory?.updatedAt,
        1,
      ),
      scenario: toScenarioSnapshot(session, runtimeData.scenario),
      availableAvatars: toAvailableAvatars(runtimeData.scenarioAvatars, session),
      gmState: resolveGmState(runtimeData.gmState, runtimeData.activeAvatarId),
      extensions: {
        memory: buildMemorySnapshot(
          runtimeData.workingMemory,
          recentExchanges,
          runtimeData.userFacts,
        ),
        retrieval: undefined,
        userPersona: runtimeData.user?.persona ?? null,
        gmDirective: normalizeOptionalText(session.gmNotes),
        ...(Array.isArray(runtimeData.avatar.adjustments)
          ? { responseRules: runtimeData.avatar.adjustments }
          : {}),
        ...(runtimeData.avatar.computedTraits !== undefined
          ? { avatarTraits: runtimeData.avatar.computedTraits }
          : {}),
      },
    })
  }

  private loadActiveAvatar(activeAvatarId: string | undefined) {
    return activeAvatarId !== undefined
      ? this.avatarRepository.findById(activeAvatarId)
      : Promise.resolve(null)
  }

  private loadConversationData(conversationId: string | undefined) {
    if (conversationId === undefined) {
      return Promise.resolve({
        workingMemory: null,
        messages: [],
      })
    }

    return Promise.all([
      this.conversationWorkingMemoryRepository?.findByConversationId(conversationId) ??
        Promise.resolve(null),
      this.messageRepository.findByConversationId(conversationId),
    ]).then(([workingMemory, messages]) => ({ workingMemory, messages }))
  }

  private loadUserData(session: Session) {
    return Promise.all([
      this.userRepository?.findById(session.userId) ?? Promise.resolve(null),
      this.gmStateRepository?.findBySessionId(session.sessionId) ?? Promise.resolve(null),
      this.userMemoryFactRepository?.findByUserId(session.userId) ?? Promise.resolve([]),
    ]).then(([user, gmState, userFacts]) => ({ user, gmState, userFacts }))
  }
}

function buildMemorySnapshot(
  workingMemory: Awaited<
    ReturnType<NonNullable<IConversationWorkingMemoryRepository>['findByConversationId']>
  >,
  recentExchanges: ReturnType<typeof selectExchangeWindow>,
  userFacts: Awaited<ReturnType<NonNullable<IUserMemoryFactRepository>['findByUserId']>>,
) {
  return {
    shortTerm: {
      exchangeCount: recentExchanges.length,
      recentExchanges,
    },
    ...(workingMemory !== null
      ? {
          working: {
            session: {
              summary: workingMemory.summary,
              updatedAt: workingMemory.updatedAt,
            },
          },
        }
      : {}),
    ...(userFacts.length > 0
      ? {
          longTerm: {
            facts: userFacts.slice(0, MEMORY_LONG_TERM_FACT_LIMIT).map((fact) => ({
              category: fact.category,
              key: fact.key,
              value: fact.value,
            })),
          },
        }
      : {}),
  }
}

function toScenarioSnapshot(
  session: Session,
  scenario: NonNullable<Awaited<ReturnType<IScenarioRepository['findById']>>>,
) {
  const goals = [...scenario.objectives]
  if (Array.isArray(scenario.config.goals)) {
    goals.push(...scenario.config.goals)
  }
  return {
    scenarioId: session.scenarioId,
    name: scenario.name,
    ...(scenario.worldContext.trim().length > 0 ? { description: scenario.worldContext } : {}),
    ...(goals.length > 0 ? { goals } : {}),
  }
}

function toAvailableAvatars(
  avatars: Awaited<ReturnType<IAvatarRepository['listByScenarioId']>>,
  session: Session,
) {
  const unlockedAvatarIds = new Set(session.unlockedAvatarIds ?? [])
  return avatars
    .filter((avatar) => avatar.status === 'active')
    .map((avatar) => ({
      avatarId: avatar.avatarId,
      name: avatar.name,
      ...(avatar.description !== undefined ? { description: avatar.description } : {}),
      ...(typeof avatar.config['scope'] === 'string'
        ? { scope: avatar.config['scope'].trim() }
        : {}),
      availability: unlockedAvatarIds.has(avatar.avatarId)
        ? ('available' as const)
        : ('locked' as const),
    }))
}

function resolveGmState(
  gmState: GameMasterState | null,
  activeAvatarId: string | undefined,
): GameMasterState {
  if (gmState !== null) return gmState
  return {
    ...(activeAvatarId !== undefined ? { currentAvatarId: activeAvatarId } : {}),
    progression: '',
    topicsCovered: [],
    interactionCount: 0,
  }
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text !== undefined && text.length > 0 ? text : null
}
