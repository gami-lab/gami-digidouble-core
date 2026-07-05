import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { DomainError } from '../../../domain/errors.js'
import { selectExchangeWindow } from '../../services/conversation-exchange-window.js'
import type {
  GetSessionContextInput,
  GetSessionContextOutput,
} from './get-session-context.types.js'

export class GetSessionContextUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository,
  ) {}

  // eslint-disable-next-line complexity
  async execute(input: GetSessionContextInput): Promise<GetSessionContextOutput> {
    const session = await this.loadSessionOrThrow(input.sessionId)
    const activeConversation = await this.conversationRepository.findActiveBySessionId(
      session.sessionId,
    )
    const conversationId = activeConversation?.conversationId
    const activeAvatarId = activeConversation?.avatarId ?? session.activeAvatarId

    const [avatar, scenario, workingMemory, messages] = await Promise.all([
      activeAvatarId !== undefined
        ? this.avatarRepository.findById(activeAvatarId)
        : Promise.resolve(null),
      this.scenarioRepository.findById(session.scenarioId),
      conversationId !== undefined
        ? (this.conversationWorkingMemoryRepository?.findByConversationId(conversationId) ??
          Promise.resolve(null))
        : Promise.resolve(null),
      conversationId !== undefined
        ? this.messageRepository.findByConversationId(conversationId)
        : Promise.resolve([]),
    ])

    return {
      sessionId: session.sessionId,
      avatarPrompt: avatar?.personaPrompt ?? null,
      worldContext: normalizeOptionalText(scenario?.worldContext),
      worldObjectives: normalizeGoals(scenario),
      gmInstruction: normalizeOptionalText(session.gmNotes),
      workingMemory:
        workingMemory !== null
          ? {
              summary: workingMemory.summary,
              unresolvedThreads: [...workingMemory.unresolvedThreads],
              updatedAt: workingMemory.updatedAt,
            }
          : null,
      currentExchanges: selectExchangeWindow(messages, workingMemory?.updatedAt, 0),
    }
  }

  private async loadSessionOrThrow(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
    return session
  }
}

function normalizeGoals(scenario: Scenario | null | undefined): string[] {
  if (scenario === null || scenario === undefined) return []
  return [
    ...scenario.objectives,
    ...(Array.isArray(scenario.config.goals) ? scenario.config.goals : []),
  ].filter((goal) => goal.trim().length > 0)
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text !== undefined && text.length > 0 ? text : null
}
