import type {
  GameMasterMemoryContext,
  SelectedMemoryPayload,
} from '../../domain/memory/memory.types.js'

export function toGameMasterMemoryContext(
  payload: SelectedMemoryPayload,
): GameMasterMemoryContext | undefined {
  const memory: GameMasterMemoryContext = {
    ...(payload.workingMemory !== undefined
      ? {
          workingMemory: {
            summary: payload.workingMemory.summary,
            unresolvedThreads: payload.workingMemory.unresolvedThreads,
            coveredTopics: payload.workingMemory.coveredTopics,
          },
        }
      : {}),
    ...(payload.episodicMemories.length > 0
      ? {
          episodicMemories: payload.episodicMemories.map((episode) => ({
            memoryId: episode.memoryId,
            conversationId: episode.conversationId,
            summary: episode.summary,
            keyDiscoveries: episode.keyDiscoveries,
            unresolvedTopics: episode.unresolvedTopics,
            createdAt: episode.createdAt,
            selectionReasons: episode.selectionReasons,
            score: episode.score,
          })),
        }
      : {}),
    ...(payload.longTermFacts.length > 0 ? { longTermFacts: payload.longTermFacts } : {}),
  }
  return Object.keys(memory).length > 0 ? memory : undefined
}
