import type { IConversationMemoryRepository } from '../ports/IConversationMemoryRepository.js'
import type { IConversationWorkingMemoryRepository } from '../ports/IConversationWorkingMemoryRepository.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { IUserMemoryFactRepository } from '../ports/IUserMemoryFactRepository.js'
import {
  MEMORY_EPISODIC_SELECTION_LIMIT,
  MEMORY_LONG_TERM_FACT_LIMIT,
  MEMORY_SHORT_TERM_MESSAGE_FETCH_LIMIT,
} from '../../domain/memory/memory.policy.js'
import { scoreEpisodicMemorySelection } from '../../domain/memory/memory-selection.policy.js'
import { selectExchangeWindow } from './conversation-exchange-window.js'
import type {
  GameMasterMemoryContext,
  LayeredMemorySnapshot,
  LongTermMemoryFact,
  SelectedMemoryPayload,
  SelectedWorkingMemory,
  ShortTermMemoryExchange,
} from '../../domain/memory/memory.types.js'
import { toGameMasterMemoryContext } from './memory-selection-context.js'

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
    const workingMemory = await this.loadWorkingMemory(input.conversationId)
    const [shortTermExchanges, episodicMemories, longTermFacts] = await Promise.all([
      this.loadShortTermExchanges(input.conversationId, workingMemory?.updatedAt),
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
              exchangeCount: payload.shortTermExchanges.length,
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
    return toGameMasterMemoryContext(payload)
  }

  private async loadShortTermExchanges(
    conversationId: string,
    workingMemoryUpdatedAt?: string,
  ): Promise<ShortTermMemoryExchange[]> {
    try {
      const messages = await this.messageRepository.findByConversationId(conversationId, {
        limit: MEMORY_SHORT_TERM_MESSAGE_FETCH_LIMIT,
      })
      return selectExchangeWindow(messages, workingMemoryUpdatedAt)
    } catch {
      return []
    }
  }

  private async loadWorkingMemory(
    conversationId: string,
  ): Promise<SelectedWorkingMemory | undefined> {
    if (this.conversationWorkingMemoryRepository === undefined) return undefined
    try {
      const memory =
        await this.conversationWorkingMemoryRepository.findByConversationId(conversationId)
      if (memory === null) return undefined
      return {
        summary: memory.summary,
        unresolvedThreads: memory.unresolvedThreads,
        coveredTopics: memory.coveredTopics,
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
