import { isRetrievalQuerySource } from '@gami/shared'
import type {
  RecordedAvatarContextSnapshot,
  RecordedGmContextSnapshot,
  RecordedKnowledgeReference,
  RecordedTypedKnowledgeSections,
  UserPersona,
} from '@gami/shared'
import type { GameMasterStateSummary } from '../../../domain/game-master/game-master.types.js'
import { parseRetrievalTraceDto } from '../../services/knowledge/retrieval-trace-dto.js'
import type { TurnCompletedEventPayload } from './list-session-events.types.js'
import {
  readStringArray,
  readStringOrNull,
  readOptionalString,
  readOptionalStringArray,
  readString,
  readNumber,
  readOptionalNumber,
  readBoolean,
  isRecord,
  hasOnlyKeys,
} from './session-event-field-readers.js'

export function readOptionalAvatarContextSnapshot(
  value: unknown,
): RecordedAvatarContextSnapshot | undefined {
  if (!isRecord(value)) return undefined
  if (!hasOnlyKeys(value, ['avatarId', 'sections'])) return undefined

  if (isRecord(value['sections'])) {
    return {
      ...(typeof value['avatarId'] === 'string' ? { avatarId: value['avatarId'] } : {}),
      sections: readAvatarSections(value['sections']),
    }
  }
  return undefined
}

export function readOptionalGmContextSnapshot(
  value: unknown,
): RecordedGmContextSnapshot | undefined {
  if (!isRecord(value)) return undefined
  if (!hasOnlyKeys(value, ['currentState', 'availableAvatars', 'sections'])) return undefined
  if (!isRecord(value['sections'])) return undefined

  return {
    currentState: readFullStateSummary(value['currentState']),
    availableAvatars: readAvailableAvatars(value['availableAvatars']),
    sections: readGmSections(value['sections']),
  }
}

export function readOptionalContextSelection(
  value: unknown,
): TurnCompletedEventPayload['contextSelection'] | undefined {
  if (!isRecord(value)) return undefined
  const retrieval = readOptionalRetrievalSelection(value['retrieval'])
  const contextEngineSelection = readContextEngineSelection(value['contextEngineSelection'])
  const selection = {
    shortTermExchangeCount: readNumber(value['shortTermExchangeCount']),
    hasWorkingMemory: readBoolean(value['hasWorkingMemory']),
    ...(retrieval !== undefined ? { retrieval } : {}),
    ...(contextEngineSelection !== undefined ? { contextEngineSelection } : {}),
    hasUserPersona: readBoolean(value['hasUserPersona']),
    hasGmDirective: readBoolean(value['hasGmDirective']),
    responseRuleCount: readNumber(value['responseRuleCount']),
    hasAvatarTraits: readBoolean(value['hasAvatarTraits']),
  }

  return selection
}

export function readOptionalRetrievalSelection(
  value: unknown,
): NonNullable<TurnCompletedEventPayload['contextSelection']>['retrieval'] | undefined {
  if (!isRecord(value)) return undefined
  const selectedCountsValue = isRecord(value['selectedForAssemblyCounts'])
    ? value['selectedForAssemblyCounts']
    : undefined
  const includedCountsValue = isRecord(value['includedCounts'])
    ? value['includedCounts']
    : undefined
  const omittedCountsValue = isRecord(value['omittedByAssemblyCounts'])
    ? value['omittedByAssemblyCounts']
    : undefined
  const retrievalTrace = parseRetrievalTraceDto(value['retrievalTrace'])
  if (selectedCountsValue === undefined || includedCountsValue === undefined) {
    return undefined
  }
  const selectedForAssemblyCounts = readRetrievalCounts(selectedCountsValue)
  const includedCounts = readRetrievalCounts(includedCountsValue)
  return {
    selectedForAssemblyCounts,
    includedCounts,
    omittedByAssemblyCounts:
      omittedCountsValue !== undefined
        ? readRetrievalCounts(omittedCountsValue)
        : {
            avatar_knowledge: Math.max(
              0,
              selectedForAssemblyCounts.avatar_knowledge - includedCounts.avatar_knowledge,
            ),
            world: Math.max(0, selectedForAssemblyCounts.world - includedCounts.world),
            media: Math.max(0, selectedForAssemblyCounts.media - includedCounts.media),
          },
    ...(retrievalTrace !== undefined ? { retrievalTrace } : {}),
  }
}

export function readContextEngineSelection(
  value: unknown,
):
  NonNullable<TurnCompletedEventPayload['contextSelection']>['contextEngineSelection'] | undefined {
  if (!isRecord(value)) return undefined
  const keptSegmentCount = readOptionalNumber(value['keptSegmentCount'])
  const trimmedSegmentCount = readOptionalNumber(value['trimmedSegmentCount'])
  if (keptSegmentCount === undefined || trimmedSegmentCount === undefined) return undefined
  return { keptSegmentCount, trimmedSegmentCount }
}

export function readRetrievalCounts(value: Record<string, unknown>): {
  avatar_knowledge: number
  world: number
  media: number
} {
  return {
    avatar_knowledge: readNumber(value['avatar_knowledge']),
    world: readNumber(value['world']),
    media: readNumber(value['media']),
  }
}

export function readStateSummary(value: unknown): GameMasterStateSummary {
  const record = isRecord(value) ? value : {}
  return {
    progression: typeof record['progression'] === 'string' ? record['progression'] : '',
  }
}

export function readFullStateSummary(value: unknown): RecordedGmContextSnapshot['currentState'] {
  const record = isRecord(value) ? value : {}
  return {
    ...readStateSummary(record),
    interactionCount: readNumber(record['interactionCount']),
  }
}

export function readOptionalStateSummary(value: unknown): GameMasterStateSummary | undefined {
  return isRecord(value) ? readStateSummary(value) : undefined
}

export function readAvatarSections(
  value: Record<string, unknown>,
): RecordedAvatarContextSnapshot['sections'] {
  const retrievedContext = isRecord(value['retrievedContext'])
    ? readAvatarKnowledge(value['retrievedContext'])
    : undefined
  const avatarTraits = isRecord(value['avatarTraits'])
    ? readRecordedAvatarTraits(value['avatarTraits'])
    : undefined
  return {
    directorNotes: readStringOrNull(value['directorNotes']),
    responseRules: readRecordedResponseRules(value['responseRules']),
    conversationState: {
      recentExchanges: readRecentExchanges(value['conversationState']),
      workingMemory: readAvatarWorkingMemory(value['conversationState']),
      episodicMemories: readEpisodicMemories(value['conversationState']),
    },
    ...(retrievedContext !== undefined ? { retrievedContext } : {}),
    userPersona: readUserPersona(value['userPersona']),
    worldContext: readScenarioSnapshot(value['worldContext']),
    ...(avatarTraits !== undefined ? { avatarTraits } : {}),
  }
}

export function readGmSections(
  value: Record<string, unknown>,
): RecordedGmContextSnapshot['sections'] {
  const retrievedContext = isRecord(value['retrievedContext'])
    ? readGmKnowledge(value['retrievedContext'])
    : undefined
  const conversationState = isRecord(value['conversationState']) ? value['conversationState'] : {}
  return {
    conversationState: {
      recentMessages: readRecentMessages(conversationState),
      ...readGmMemory(conversationState),
    },
    ...(retrievedContext !== undefined ? { retrievedContext } : {}),
    userPersona: readUserPersona(value['userPersona']),
    worldContext: readScenarioSnapshot(value['worldContext']),
  }
}

export function readRecentExchanges(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['conversationState']['recentExchanges'] {
  const record = isRecord(value) ? value : {}
  const rawValue = record['recentExchanges']
  if (!Array.isArray(rawValue)) return []
  return rawValue
    .map((entry) => {
      if (!isRecord(entry)) return null
      const user = readOptionalString(entry['user'])
      const avatar = readOptionalString(entry['avatar'])
      if (user === undefined || avatar === undefined) return null
      return { user, avatar }
    })
    .filter(
      (
        entry,
      ): entry is RecordedAvatarContextSnapshot['sections']['conversationState']['recentExchanges'][number] =>
        entry !== null,
    )
}

export function readAvatarWorkingMemory(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['conversationState']['workingMemory'] {
  const record = isRecord(value) ? value : {}
  const workingMemory = isRecord(record['workingMemory']) ? record['workingMemory'] : {}
  return {
    ...(isRecord(workingMemory['session'])
      ? { session: readWorkingSession(workingMemory['session']) }
      : {}),
    ...(isRecord(workingMemory['avatar'])
      ? { avatar: readWorkingAvatar(workingMemory['avatar']) }
      : {}),
    ...(isRecord(workingMemory['conversation'])
      ? { conversation: readSelectedWorkingMemory(workingMemory['conversation']) }
      : {}),
  }
}

export function readWorkingSession(
  value: Record<string, unknown>,
): NonNullable<
  RecordedAvatarContextSnapshot['sections']['conversationState']['workingMemory']['session']
> {
  return {
    summary: readString(value['summary']),
    updatedAt: readString(value['updatedAt']),
  }
}

export function readWorkingAvatar(
  value: Record<string, unknown>,
): NonNullable<
  RecordedAvatarContextSnapshot['sections']['conversationState']['workingMemory']['avatar']
> {
  return {
    avatarId: readString(value['avatarId']),
    summary: readString(value['summary']),
    updatedAt: readString(value['updatedAt']),
  }
}

export function readSelectedWorkingMemory(
  value: Record<string, unknown>,
): NonNullable<
  RecordedAvatarContextSnapshot['sections']['conversationState']['workingMemory']['conversation']
> {
  return {
    summary: readString(value['summary']),
    unresolvedThreads: readOptionalStringArray(value['unresolvedThreads']) ?? [],
    coveredTopics: readOptionalStringArray(value['coveredTopics']) ?? [],
    updatedAt: readString(value['updatedAt']),
    selectionReasons: readOptionalStringArray(value['selectionReasons']) ?? [],
  }
}

export function readEpisodicMemories(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['conversationState']['episodicMemories'] {
  const record = isRecord(value) ? value : {}
  const rawValue = Array.isArray(record['episodicMemories']) ? record['episodicMemories'] : []
  return rawValue
    .map((entry) => {
      if (!isRecord(entry)) return null
      const memoryId = readOptionalString(entry['memoryId'])
      const conversationId = readOptionalString(entry['conversationId'])
      const summary = readOptionalString(entry['summary'])
      const createdAt = readOptionalString(entry['createdAt'])
      if (
        memoryId === undefined ||
        conversationId === undefined ||
        summary === undefined ||
        createdAt === undefined
      ) {
        return null
      }
      const score = readOptionalNumber(entry['score']) ?? 0
      return {
        memoryId,
        conversationId,
        summary,
        keyDiscoveries: readOptionalStringArray(entry['keyDiscoveries']) ?? [],
        unresolvedTopics: readOptionalStringArray(entry['unresolvedTopics']) ?? [],
        createdAt,
        selectionReasons: readOptionalStringArray(entry['selectionReasons']) ?? [],
        score,
      }
    })
    .filter(
      (
        entry,
      ): entry is RecordedAvatarContextSnapshot['sections']['conversationState']['episodicMemories'][number] =>
        entry !== null,
    )
}

export function readAvatarKnowledge(
  value: Record<string, unknown>,
): RecordedAvatarContextSnapshot['sections']['retrievedContext'] | undefined {
  const typedSections = readRecordedTypedSections(value)
  if (!hasRecordedKnowledge(typedSections) && typedSections.trace === undefined) return undefined
  return typedSections
}

export function readGmMemory(
  value: unknown,
): Omit<RecordedGmContextSnapshot['sections']['conversationState'], 'recentMessages'> {
  const record = isRecord(value) ? value : {}
  const workingMemory = readOptionalGmWorkingMemory(record['workingMemory'])
  return {
    recentExchanges: readRecentExchanges(record),
    ...(workingMemory !== undefined ? { workingMemory } : {}),
    episodicMemories: readEpisodicMemories(record),
  }
}

export function readOptionalGmWorkingMemory(
  value: unknown,
): RecordedGmContextSnapshot['sections']['conversationState']['workingMemory'] {
  if (!isRecord(value)) return undefined
  const summary = readOptionalString(value['summary'])
  if (summary === undefined) return undefined
  return {
    summary,
    unresolvedThreads: readOptionalStringArray(value['unresolvedThreads']) ?? [],
    coveredTopics: readOptionalStringArray(value['coveredTopics']) ?? [],
  }
}

export function readGmKnowledge(
  value: Record<string, unknown>,
): RecordedGmContextSnapshot['sections']['retrievedContext'] | undefined {
  const typedSections = readRecordedTypedSections(value)
  return hasRecordedKnowledge(typedSections) || typedSections.trace !== undefined
    ? typedSections
    : undefined
}

export function readRecentMessages(
  value: unknown,
): RecordedGmContextSnapshot['sections']['conversationState']['recentMessages'] {
  const record = isRecord(value) ? value : {}
  const rawValue = record['recentMessages']
  if (!Array.isArray(rawValue)) return []
  return rawValue
    .map((entry) => {
      if (!isRecord(entry)) return null
      const role = entry['role']
      const content = readOptionalString(entry['content'])
      if ((role !== 'user' && role !== 'avatar' && role !== 'system') || content === undefined) {
        return null
      }
      return { role, content }
    })
    .filter(
      (
        entry,
      ): entry is RecordedGmContextSnapshot['sections']['conversationState']['recentMessages'][number] =>
        entry !== null,
    )
}

export function readAvailableAvatars(
  value: unknown,
): RecordedGmContextSnapshot['availableAvatars'] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null
      const avatarId = readOptionalString(entry['avatarId'])
      const name = readOptionalString(entry['name'])
      if (avatarId === undefined || name === undefined) return null
      const availability = entry['availability']
      return {
        avatarId,
        name,
        ...(typeof entry['description'] === 'string' ? { description: entry['description'] } : {}),
        ...(typeof entry['scope'] === 'string' ? { scope: entry['scope'] } : {}),
        ...(availability === 'available' || availability === 'locked' ? { availability } : {}),
      }
    })
    .filter(
      (entry): entry is RecordedGmContextSnapshot['availableAvatars'][number] => entry !== null,
    )
}

export function readUserPersona(value: unknown): UserPersona | null {
  if (!isRecord(value)) return null
  const persona: UserPersona = {}
  const name = readOptionalString(value['name'])
  const roleInWorld = readOptionalString(value['roleInWorld'])
  if (name !== undefined) persona.name = name
  if (roleInWorld !== undefined) persona.roleInWorld = roleInWorld
  const avatarRelationships = readOptionalStringArray(value['avatarRelationships'])
  const dialogGuidance = readOptionalString(value['dialogGuidance'])
  if (avatarRelationships !== undefined) persona.avatarRelationships = avatarRelationships
  if (dialogGuidance !== undefined) persona.dialogGuidance = dialogGuidance
  return Object.keys(persona).length > 0 ? persona : null
}

export function readScenarioSnapshot(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['worldContext'] {
  const record = isRecord(value) ? value : {}
  const name = readOptionalString(record['name'])
  const description = readOptionalString(record['description'])
  return {
    scenarioId: readString(record['scenarioId']),
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(Array.isArray(record['goals']) ? { goals: readStringArray(record['goals']) } : {}),
  }
}

export function readRecordedResponseRules(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['responseRules'] {
  const record = isRecord(value) ? value : {}
  return {
    count: readNumber(record['count'] ?? value),
  }
}

export function readRecordedAvatarTraits(
  value: Record<string, unknown>,
): NonNullable<RecordedAvatarContextSnapshot['sections']['avatarTraits']> {
  const sectionCounts = isRecord(value['sectionCounts']) ? value['sectionCounts'] : value
  return {
    sectionCounts: {
      identity: readNumber(sectionCounts['identity']),
      personality: readNumber(sectionCounts['personality']),
      speakingStyle: readNumber(sectionCounts['speakingStyle']),
      background: readNumber(sectionCounts['background']),
      timeline: readNumber(sectionCounts['timeline']),
      currentSituation: readNumber(sectionCounts['currentSituation']),
      behaviouralRules: readNumber(sectionCounts['behaviouralRules']),
    },
  }
}

export function readRecordedKnowledgeReferences(value: unknown): RecordedKnowledgeReference[] {
  if (!Array.isArray(value)) return []
  return value
    .map(readRecordedKnowledgeReference)
    .filter((entry): entry is RecordedKnowledgeReference => entry !== null)
}

export function readRecordedTypedSections(
  value: Record<string, unknown>,
): RecordedTypedKnowledgeSections {
  const trace = parseRetrievalTraceDto(value['trace'])
  return {
    avatar_knowledge: readRecordedKnowledgeReferences(value['avatar_knowledge']),
    world: readRecordedKnowledgeReferences(value['world']),
    media: readRecordedKnowledgeReferences(value['media']),
    ...(trace !== undefined ? { trace } : {}),
  }
}

export function hasRecordedKnowledge(
  value: Pick<RecordedTypedKnowledgeSections, 'avatar_knowledge' | 'world' | 'media'>,
): boolean {
  return value.avatar_knowledge.length > 0 || value.world.length > 0 || value.media.length > 0
}

// eslint-disable-next-line complexity -- retained non-linear boundary mapping is clearer together
export function readRecordedKnowledgeReference(entry: unknown): RecordedKnowledgeReference | null {
  if (!isRecord(entry)) return null
  const sourceId = readOptionalString(entry['sourceId'])
  const chunkId = readOptionalString(entry['chunkId'])
  const knowledgeType = entry['knowledgeType']
  if (
    sourceId === undefined ||
    chunkId === undefined ||
    (knowledgeType !== 'avatar_knowledge' && knowledgeType !== 'world' && knowledgeType !== 'media')
  ) {
    return null
  }
  const matchedQuery = readRecordedMatchedQuery(entry['matchedQuery'])
  const matchType = readRetrievalMatchType(entry['matchType'])
  const item: RecordedKnowledgeReference = {
    sourceId,
    chunkId,
    knowledgeType,
    ...(typeof entry['content'] === 'string' ? { content: entry['content'] } : {}),
    ...(typeof entry['similarity'] === 'number' ? { similarity: entry['similarity'] } : {}),
    ...(matchType !== undefined ? { matchType } : {}),
    ...(typeof entry['queryIndex'] === 'number' ? { queryIndex: entry['queryIndex'] } : {}),
    ...(typeof entry['reason'] === 'string' ? { reason: entry['reason'] } : {}),
    ...(matchedQuery !== undefined ? { matchedQuery } : {}),
    ...(Array.isArray(entry['visibleToAvatarIds'])
      ? { visibleToAvatarIds: readStringArray(entry['visibleToAvatarIds']) }
      : {}),
  }
  return item
}

export function readRetrievalMatchType(
  value: unknown,
): NonNullable<RecordedKnowledgeReference['matchType']> | undefined {
  return value === 'vector' || value === 'lexical' || value === 'both' ? value : undefined
}

export function readRecordedMatchedQuery(
  value: unknown,
): NonNullable<RecordedKnowledgeReference['matchedQuery']> | undefined {
  if (!isRecord(value)) return undefined
  const source = value['source']
  const text = readOptionalString(value['text'])
  if (!isRetrievalQuerySource(source) || text === undefined) {
    return undefined
  }
  const queryIndex = readOptionalNumber(value['queryIndex'])
  return { source, text, ...(queryIndex !== undefined ? { queryIndex } : {}) }
}
