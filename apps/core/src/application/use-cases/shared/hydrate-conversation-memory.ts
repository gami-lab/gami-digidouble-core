import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { ConversationWorkingMemoryRefreshOutput } from '../../../domain/memory/memory.types.js'

export type HydrationInput = {
  conversationId: string
  sessionId: string
  userId: string
  avatarId: string
  scenarioId: string
}

export type EpisodicMemoryHydrationService = {
  hydrateForNewConversationWithMetadata(input: HydrationInput): Promise<{
    hydration: ConversationWorkingMemoryRefreshOutput
    selectedConversationIds: string[]
    consideredConversationIds: string[]
  }>
}

export async function hydrateConversationMemoryForNewConversation(args: {
  input: HydrationInput
  episodicMemoryService?: EpisodicMemoryHydrationService
  conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository
  eventLogRepository?: IEventLogRepository
}): Promise<void> {
  const { input, episodicMemoryService, conversationWorkingMemoryRepository, eventLogRepository } =
    args

  if (episodicMemoryService === undefined || conversationWorkingMemoryRepository === undefined) {
    return
  }

  const hydrationWithMetadata =
    await episodicMemoryService.hydrateForNewConversationWithMetadata(input)
  const hydration = hydrationWithMetadata.hydration

  // Without prior episodes there is nothing to carry over; a placeholder summary would be read
  // as real memory by prompts and embedded as a retrieval query.
  if (hydrationWithMetadata.selectedConversationIds.length > 0) {
    await conversationWorkingMemoryRepository.upsert({
      conversationId: input.conversationId,
      sessionId: input.sessionId,
      avatarId: input.avatarId,
      summary: hydration.summary,
      unresolvedThreads: hydration.unresolvedThreads,
      coveredTopics: hydration.coveredTopics,
      candidateFacts: hydration.candidateFacts,
    })
  }

  if (eventLogRepository === undefined) return

  try {
    await eventLogRepository.append({
      sessionId: input.sessionId,
      type: 'memory_hydration_succeeded',
      severity: 'info',
      payload: {
        hydratedConversationId: input.conversationId,
        sourceConversationIds: hydrationWithMetadata.selectedConversationIds,
        consideredCount: hydrationWithMetadata.consideredConversationIds.length,
        selectedCount: hydrationWithMetadata.selectedConversationIds.length,
      },
    })
  } catch (error) {
    console.warn('[memory] hydration observability write failed', {
      error: error instanceof Error ? error.message : 'unknown error',
    })
  }
}
