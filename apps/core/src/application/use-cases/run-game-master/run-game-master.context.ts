import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { ContextScenarioSnapshot } from '../../../domain/context/session-context.types.js'
import type {
  GameMasterInput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import { toGameMasterMemoryContext } from '../../services/memory-selection-context.js'
import { selectExchangeMessageWindow } from '../../services/conversation-exchange-window.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import {
  buildGameMasterTypedRetrievalQueries,
  flattenTypedRetrievalQueries,
} from '../../services/knowledge/typed-retrieval-query-builder.js'
import { buildGmContextSnapshot } from './run-game-master.context-engine.js'
import type { RunGameMasterInput } from './run-game-master.types.js'

const GM_RECENT_EXCHANGE_LIMIT = 3

export type GameMasterScenarioContext = Pick<ContextScenarioSnapshot, 'description' | 'goals'> & {
  modelSelection?: Scenario['modelSelection']
}

export type GameMasterContextDependencies = {
  messageRepository?: IMessageRepository
  memorySelectionService?: MemorySelectionService
  typedRetrievalService?: TypedRetrievalService
}

export async function buildGameMasterInput(args: {
  input: RunGameMasterInput
  currentState: GameMasterState
  scenarioContext: GameMasterScenarioContext
  session: Session | null
  scenarioAvatars: AvatarConfig[]
  dependencies: GameMasterContextDependencies
}): Promise<{
  gmInput: GameMasterInput
  assembledGmContext: ReturnType<typeof buildGmContextSnapshot>
}> {
  const { memory, workingMemoryUpdatedAt } = await loadMemoryContext(
    args.input,
    args.session,
    args.dependencies,
  )
  const recentMessages = await loadRecentMessages(
    args.input.conversationId,
    workingMemoryUpdatedAt,
    args.dependencies.messageRepository,
  )
  const retrieval = await loadTypedRetrieval(
    args.input,
    args.session,
    args.scenarioContext.description,
    recentMessages,
    memory,
    args.dependencies.typedRetrievalService,
  )
  const assembledGmContext = buildGmContextSnapshot({
    session: args.session,
    currentState: args.currentState,
    scenarioAvatars: args.scenarioAvatars,
    scenarioContext: args.scenarioContext,
    recentMessages,
    memory,
    retrieval,
    userPersona: args.input.userPersona ?? null,
  })
  const context: GameMasterInput['context'] = {
    experience: {
      scenarioId: args.input.scenarioId,
      ...(assembledGmContext.sections.worldContext.description !== undefined
        ? { description: assembledGmContext.sections.worldContext.description }
        : {}),
      ...(assembledGmContext.sections.worldContext.goals !== undefined
        ? { goals: assembledGmContext.sections.worldContext.goals }
        : {}),
    },
    availableAvatars: assembledGmContext.availableAvatars,
  }
  if (memory !== undefined) context.memory = memory
  const rag = toGameMasterRagContext(assembledGmContext.sections.retrievedContext)
  if (rag !== undefined) context.rag = rag
  if (assembledGmContext.sections.userPersona !== null) {
    context.userPersona = assembledGmContext.sections.userPersona
  }

  return {
    assembledGmContext,
    gmInput: {
      session: {
        sessionId: args.input.sessionId,
        turnIndex: args.input.turnIndex,
        activeAvatarId: args.input.avatarId,
      },
      userMessage: { text: args.input.userMessageText },
      ...(assembledGmContext.sections.conversationState.recentMessages.length > 0
        ? { recentMessages: assembledGmContext.sections.conversationState.recentMessages }
        : {}),
      state: args.currentState,
      context,
    },
  }
}

async function loadMemoryContext(
  input: RunGameMasterInput,
  session: Session | null,
  dependencies: GameMasterContextDependencies,
): Promise<{
  memory: GameMasterInput['context']['memory'] | undefined
  workingMemoryUpdatedAt: string | undefined
}> {
  if (input.selectedMemory !== undefined) {
    return {
      memory: toGameMasterMemoryContext(input.selectedMemory),
      workingMemoryUpdatedAt: input.selectedMemory.workingMemory?.updatedAt,
    }
  }
  if (
    session === null ||
    input.conversationId === undefined ||
    dependencies.messageRepository === undefined
  ) {
    return { memory: undefined, workingMemoryUpdatedAt: undefined }
  }
  const memorySelectionService =
    dependencies.memorySelectionService ??
    new MemorySelectionService(dependencies.messageRepository)
  try {
    const selectedMemory = await memorySelectionService.select({
      conversationId: input.conversationId,
      userId: session.userId,
      avatarId: input.avatarId,
      scenarioId: input.scenarioId,
      userMessageText: input.userMessageText,
    })
    return {
      memory: memorySelectionService.toGameMasterMemoryContext(selectedMemory),
      workingMemoryUpdatedAt: selectedMemory.workingMemory?.updatedAt,
    }
  } catch {
    return { memory: undefined, workingMemoryUpdatedAt: undefined }
  }
}

async function loadRecentMessages(
  conversationId: string | undefined,
  workingMemoryUpdatedAt: string | undefined,
  messageRepository: IMessageRepository | undefined,
): Promise<Array<{ role: 'user' | 'avatar' | 'system'; content: string }>> {
  if (conversationId === undefined || messageRepository === undefined) return []
  const messages = await messageRepository.findByConversationId(conversationId, {
    limit: GM_RECENT_EXCHANGE_LIMIT * 2,
  })
  return selectExchangeMessageWindow(messages, workingMemoryUpdatedAt, 0).slice(
    -GM_RECENT_EXCHANGE_LIMIT * 2,
  )
}

async function loadTypedRetrieval(
  input: RunGameMasterInput,
  session: Session | null,
  worldContext: string | undefined,
  recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>,
  memory: GameMasterInput['context']['memory'] | undefined,
  typedRetrievalService: TypedRetrievalService | undefined,
) {
  if (
    typedRetrievalService === undefined ||
    session === null ||
    input.conversationId === undefined
  ) {
    return undefined
  }

  const queries = buildGameMasterTypedRetrievalQueries({
    worldContext,
    recentExchanges: toRecentExchanges(recentMessages),
    workingMemorySummary: memory?.workingMemory?.summary,
  })
  const query = flattenTypedRetrievalQueries(queries)
  if (!hasText(query)) return undefined

  return typedRetrievalService.retrieve({
    scenarioId: input.scenarioId,
    sessionId: input.sessionId,
    userId: session.userId,
    conversationId: input.conversationId,
    bypassVisibilityFilter: true,
    query,
    queries,
    limitPerType: 3,
  })
}

function toGameMasterRagContext(
  knowledge:
    | {
        memory: Array<{ sourceId: string; content: string }>
        world: Array<{ sourceId: string; content: string }>
        media: Array<{ sourceId: string; content: string }>
      }
    | undefined,
): GameMasterInput['context']['rag'] | undefined {
  if (knowledge === undefined) return undefined

  const rag = {
    ...(knowledge.memory.length > 0 ? { memory: toRagEntries(knowledge.memory) } : {}),
    ...(knowledge.world.length > 0 ? { world: toRagEntries(knowledge.world) } : {}),
    ...(knowledge.media.length > 0 ? { media: toRagEntries(knowledge.media) } : {}),
  }
  return Object.keys(rag).length > 0 ? rag : undefined
}

function toRagEntries(items: Array<{ sourceId: string; content: string }>) {
  return items.map((item) => ({
    sourceId: item.sourceId,
    excerpt: item.content,
  }))
}

function toRecentExchanges(
  recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>,
): Array<{ user: string; avatar: string }> {
  const exchanges: Array<{ user: string; avatar: string }> = []
  let pendingUser: string | undefined

  for (const message of recentMessages) {
    if (message.role === 'user') {
      pendingUser = message.content
      continue
    }
    if (message.role === 'avatar' && pendingUser !== undefined) {
      exchanges.push({ user: pendingUser, avatar: message.content })
      pendingUser = undefined
    }
  }
  return exchanges
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
