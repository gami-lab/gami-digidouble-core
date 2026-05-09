import type { IConversationMemoryRepository } from '../ports/IConversationMemoryRepository.js'
import type { IConversationWorkingMemoryRepository } from '../ports/IConversationWorkingMemoryRepository.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { IUserMemoryFactRepository } from '../ports/IUserMemoryFactRepository.js'
import {
  MEMORY_EPISODIC_SELECTION_LIMIT,
  MEMORY_LONG_TERM_FACT_LIMIT,
  MEMORY_SHORT_TERM_EXCHANGE_LIMIT,
  MEMORY_SHORT_TERM_MESSAGE_FETCH_LIMIT,
} from '../../domain/memory/memory.policy.js'
import { scoreEpisodicMemorySelection } from '../../domain/memory/memory-selection.policy.js'
import type {
  GameMasterMemoryContext,
  LayeredMemorySnapshot,
  LongTermMemoryFact,
  MemorySelectionReason,
  SelectedMemoryPayload,
  ShortTermMemoryExchange,
} from '../../domain/memory/memory.types.js'

export class MemorySelectionService {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository,
    private readonly conversationMemoryRepository?: IConversationMemoryRepository,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
  ) {}

  async select(input: {
    conversationId: string
    userId: string
    avatarId: string
    scenarioId: string
    userMessageText: string
  }): Promise<SelectedMemoryPayload> {
    const { selected } = await this.selectWithObservability(input)
    return selected
  }

  async selectWithObservability(input: {
    conversationId: string
    userId: string
    avatarId: string
    scenarioId: string
    userMessageText: string
  }): Promise<{
    selected: SelectedMemoryPayload
    observability: {
      sourceConversationIds: string[]
      selectedConversationIds: string[]
      selectedCount: number
      rejectedCount: number
      topSelectionReasons: string[]
    }
  }> {
    const [shortTermExchanges, workingMemory, episodicMemories, longTermFacts] = await Promise.all([
      this.loadShortTermExchanges(input.conversationId),
      this.loadWorkingMemory(input.conversationId),
      this.loadEpisodicMemories(input),
      this.loadLongTermFacts(input.userId),
    ])

    const selectedEpisodes = this.selectEpisodicMemories(
      episodicMemories,
      input.userMessageText,
      workingMemory?.unresolvedThreads ?? [],
    )
    const topSelectionReasons = this.getTopSelectionReasons(selectedEpisodes)

    return {
      selected: {
        shortTermExchanges,
        ...(workingMemory !== undefined ? { workingMemory } : {}),
        episodicMemories: selectedEpisodes,
        longTermFacts,
      },
      observability: {
        sourceConversationIds: episodicMemories.map((memory) => memory.conversationId),
        selectedConversationIds: selectedEpisodes.map((memory) => memory.conversationId),
        selectedCount: selectedEpisodes.length,
        rejectedCount: Math.max(0, episodicMemories.length - selectedEpisodes.length),
        topSelectionReasons,
      },
    }
  }

  toAvatarMemorySnapshot(payload: SelectedMemoryPayload): LayeredMemorySnapshot | undefined {
    const memory: LayeredMemorySnapshot = {
      ...(payload.shortTermExchanges.length > 0
        ? {
            shortTerm: {
              exchangeCount: 2,
              recentExchanges: payload.shortTermExchanges,
            },
          }
        : {}),
      ...(payload.workingMemory !== undefined
        ? {
            working: {
              session: {
                summary: payload.workingMemory.summary,
                updatedAt: payload.workingMemory.updatedAt,
              },
            },
          }
        : {}),
      ...(payload.longTermFacts.length > 0 ? { longTerm: { facts: payload.longTermFacts } } : {}),
    }

    return Object.keys(memory).length > 0 ? memory : undefined
  }

  toGameMasterMemoryContext(payload: SelectedMemoryPayload): GameMasterMemoryContext | undefined {
    const memory: GameMasterMemoryContext = {
      ...(payload.workingMemory !== undefined
        ? {
            workingMemory: {
              summary: payload.workingMemory.summary,
              unresolvedThreads: payload.workingMemory.unresolvedThreads,
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

  private async loadShortTermExchanges(conversationId: string): Promise<ShortTermMemoryExchange[]> {
    try {
      const messages = await this.messageRepository.findByConversationId(conversationId, {
        limit: MEMORY_SHORT_TERM_MESSAGE_FETCH_LIMIT,
      })
      const ordered = messages
        .slice()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      const exchanges: ShortTermMemoryExchange[] = []
      let pendingUser: string | null = null

      for (const message of ordered) {
        if (message.role === 'user') {
          pendingUser = message.content
          continue
        }
        if (message.role === 'avatar' && pendingUser !== null) {
          exchanges.push({ user: pendingUser, avatar: message.content })
          pendingUser = null
        }
      }

      return exchanges.slice(-MEMORY_SHORT_TERM_EXCHANGE_LIMIT)
    } catch {
      return []
    }
  }

  private async loadWorkingMemory(conversationId: string): Promise<
    | {
        summary: string
        unresolvedThreads: string[]
        updatedAt: string
        selectionReasons: MemorySelectionReason[]
      }
    | undefined
  > {
    if (this.conversationWorkingMemoryRepository === undefined) return undefined
    try {
      const memory =
        await this.conversationWorkingMemoryRepository.findByConversationId(conversationId)
      if (memory === null) return undefined
      return {
        summary: memory.summary,
        unresolvedThreads: memory.unresolvedThreads,
        updatedAt: memory.updatedAt,
        selectionReasons: ['working_memory', 'continuity'],
      }
    } catch {
      return undefined
    }
  }

  private async loadEpisodicMemories(input: {
    userId: string
    avatarId: string
    scenarioId: string
  }) {
    if (this.conversationMemoryRepository === undefined) return []
    try {
      const episodes = await this.conversationMemoryRepository.listByScope({
        userId: input.userId,
        avatarId: input.avatarId,
        scenarioId: input.scenarioId,
        limit: 12,
      })
      return episodes.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    } catch {
      return []
    }
  }

  private selectEpisodicMemories(
    episodicMemories: Awaited<ReturnType<MemorySelectionService['loadEpisodicMemories']>>,
    userMessageText: string,
    unresolvedThreads: string[],
  ) {
    return episodicMemories
      .map((memory, index) => {
        const { score, reasons } = scoreEpisodicMemorySelection({
          memory,
          userMessageText,
          workingUnresolvedThreads: unresolvedThreads,
          recencyRank: index,
        })
        return {
          memoryId: memory.conversationId,
          conversationId: memory.conversationId,
          summary: memory.summary,
          keyDiscoveries: memory.keyDiscoveries,
          unresolvedTopics: memory.unresolvedTopics,
          createdAt: memory.createdAt,
          score,
          selectionReasons: reasons,
        }
      })
      .sort((a, b) => b.score - a.score || Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, MEMORY_EPISODIC_SELECTION_LIMIT)
  }

  private async loadLongTermFacts(userId: string): Promise<LongTermMemoryFact[]> {
    if (this.userMemoryFactRepository === undefined) return []
    try {
      const facts = await this.userMemoryFactRepository.findByUserId(userId)
      return facts.slice(0, MEMORY_LONG_TERM_FACT_LIMIT).map((fact) => ({
        category: fact.category,
        key: fact.key,
        value: fact.value,
      }))
    } catch {
      return []
    }
  }

  private getTopSelectionReasons(
    selectedEpisodes: SelectedMemoryPayload['episodicMemories'],
  ): string[] {
    const counts = new Map<string, number>()
    for (const episode of selectedEpisodes) {
      for (const reason of episode.selectionReasons) {
        counts.set(reason, (counts.get(reason) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([reason]) => reason)
  }
}
