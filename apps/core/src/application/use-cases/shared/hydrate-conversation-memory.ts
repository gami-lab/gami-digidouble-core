import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'

export type HydrationInput = {
  conversationId: string
  sessionId: string
  userId: string
  avatarId: string
  scenarioId: string
  queryText?: string
}

export type EpisodicMemoryHydrationService = {
  hydrateForNewConversationWithMetadata(input: HydrationInput): Promise<{
    hydration: {
      summary: string
      unresolvedThreads: string[]
      candidateFacts: Array<{ category: string; key: string; value: string }>
    }
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

  await conversationWorkingMemoryRepository.upsert({
    conversationId: input.conversationId,
    sessionId: input.sessionId,
    avatarId: input.avatarId,
    summary: hydration.summary,
    unresolvedThreads: hydration.unresolvedThreads,
    candidateFacts: hydration.candidateFacts,
  })

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
  } catch {
    // Hydration observability is intentionally non-blocking.
  }
}
