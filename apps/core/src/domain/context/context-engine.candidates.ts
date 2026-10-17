import type { RetrievalTrace, RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import { selectBalancedRetrievedItems } from '../knowledge/retrieval-selection.js'
import type { ContextEngineInput, ContextEngineOutput } from './context-engine.types.js'
import type {
  ContextProjection,
  ContextSectionId,
  ContextSegmentId,
} from './context-engine.policy.js'
import { AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS } from '@gami/shared'

export const EMPTY_EXCHANGES: ContextEngineOutput['avatar']['sections']['conversationState']['recentExchanges'] =
  []

export const EMPTY_EPISODIC_MEMORIES: ContextEngineOutput['avatar']['sections']['conversationState']['episodicMemories'] =
  []

export const EMPTY_MESSAGES: ContextEngineOutput['gm']['sections']['conversationState']['recentMessages'] =
  []

export const EMPTY_RESPONSE_RULES: ContextEngineOutput['avatar']['sections']['responseRules']['items'] =
  []

export type CandidateSegment = {
  projection: ContextProjection
  sectionId: ContextSectionId
  segmentId: ContextSegmentId
  tokenEstimate: number
  apply: (draft: MutableOutput) => void
}

export type MutableOutput = {
  avatar: ContextEngineOutput['avatar']
  gm: ContextEngineOutput['gm']
}

export type NormalizedContextInput = {
  avatarRetrieval: ContextEngineInput['extensions']['retrieval']
  gmRetrieval: ContextEngineInput['extensions']['retrievalForGm']
  responseRules: string[]
}

export function normalizeInput(input: ContextEngineInput): NormalizedContextInput {
  return {
    avatarRetrieval: dedupeRetrieval(input.extensions.retrieval),
    gmRetrieval: dedupeRetrieval(input.extensions.retrievalForGm),
    responseRules: normalizeResponseRules(input.extensions.responseRules),
  }
}

export function buildCandidates(
  input: ContextEngineInput,
  normalized: NormalizedContextInput,
): CandidateSegment[] {
  const memory = input.extensions.memory
  const candidates: CandidateSegment[] = []

  pushDirectorNotesCandidate(candidates, input)
  pushResponseRulesCandidate(candidates, normalized.responseRules)
  pushWorkingMemoryCandidates(candidates, memory)
  pushEpisodicMemoryCandidates(candidates, memory?.episodicMemories ?? EMPTY_EPISODIC_MEMORIES)
  pushShortTermCandidates(candidates, memory?.shortTerm?.recentExchanges ?? EMPTY_EXCHANGES)
  pushRecentMessageCandidate(candidates, input.recentMessages)
  pushUserPersonaCandidate(candidates, input)
  pushWorldContextCandidate(candidates, input)
  pushAvatarRetrievalCandidates(
    candidates,
    normalized.avatarRetrieval,
    input.extensions.avatarRetrievalOptions,
  )
  pushGmRetrievalCandidates(candidates, normalized.gmRetrieval)
  pushAvatarTraitsCandidate(candidates, input)

  return candidates
}

function pushDirectorNotesCandidate(
  candidates: CandidateSegment[],
  input: ContextEngineInput,
): void {
  if (!hasText(input.extensions.gmDirective)) return
  const directive = input.extensions.gmDirective.trim()
  candidates.push({
    projection: 'avatar',
    sectionId: 'directorNotes',
    segmentId: 'directorNotes',
    tokenEstimate: estimateTokens(input.extensions.gmDirective),
    apply: (draft) => {
      draft.avatar.sections.directorNotes = directive
    },
  })
}

function pushResponseRulesCandidate(candidates: CandidateSegment[], responseRules: string[]): void {
  if (responseRules.length === 0) return
  candidates.push({
    projection: 'avatar',
    sectionId: 'responseRules',
    segmentId: 'responseRules',
    tokenEstimate: estimateTokens(responseRules.join(' ')),
    apply: (draft) => {
      draft.avatar.sections.responseRules = { items: responseRules }
    },
  })
}

// eslint-disable-next-line complexity -- retained non-linear boundary mapping is clearer together
function pushWorkingMemoryCandidates(
  candidates: CandidateSegment[],
  memory: ContextEngineInput['extensions']['memory'],
): void {
  const sessionSummary = memory?.working?.session?.summary
  const avatarSummary = memory?.working?.avatar?.summary
  const conversationSummary = memory?.working?.conversation?.summary
  const workingText = [sessionSummary, avatarSummary, conversationSummary].filter(hasText).join(' ')
  if (workingText.length === 0) return

  candidates.push({
    projection: 'avatar',
    sectionId: 'conversationState',
    segmentId: 'conversationStateWorkingMemory',
    tokenEstimate: estimateTokens(workingText),
    apply: (draft) => {
      draft.avatar.sections.conversationState.workingMemory = {
        ...(memory?.working?.session !== undefined ? { session: memory.working.session } : {}),
        ...(memory?.working?.avatar !== undefined ? { avatar: memory.working.avatar } : {}),
        ...(memory?.working?.conversation !== undefined
          ? { conversation: memory.working.conversation }
          : {}),
      }
    },
  })
  candidates.push({
    projection: 'gm',
    sectionId: 'conversationState',
    segmentId: 'conversationStateWorkingMemory',
    tokenEstimate: estimateTokens(workingText),
    apply: (draft) => {
      if (memory?.working?.conversation !== undefined) {
        draft.gm.sections.conversationState.workingMemory = {
          summary: memory.working.conversation.summary,
          unresolvedThreads: memory.working.conversation.unresolvedThreads,
          coveredTopics: memory.working.conversation.coveredTopics,
        }
      }
    },
  })
}

function pushEpisodicMemoryCandidates(
  candidates: CandidateSegment[],
  episodicMemories: NonNullable<ContextEngineInput['extensions']['memory']>['episodicMemories'],
): void {
  if (episodicMemories === undefined || episodicMemories.length === 0) return
  const tokenEstimate = estimateTokens(
    episodicMemories
      .map(
        (memory) =>
          `${memory.summary} ${memory.keyDiscoveries.join(' ')} ${memory.unresolvedTopics.join(' ')}`,
      )
      .join(' '),
  )
  candidates.push({
    projection: 'avatar',
    sectionId: 'conversationState',
    segmentId: 'conversationStateEpisodicMemories',
    tokenEstimate,
    apply: (draft) => {
      draft.avatar.sections.conversationState.episodicMemories = episodicMemories
    },
  })
  candidates.push({
    projection: 'gm',
    sectionId: 'conversationState',
    segmentId: 'conversationStateEpisodicMemories',
    tokenEstimate,
    apply: (draft) => {
      draft.gm.sections.conversationState.episodicMemories = episodicMemories
    },
  })
}

function pushShortTermCandidates(
  candidates: CandidateSegment[],
  exchanges: ContextEngineOutput['avatar']['sections']['conversationState']['recentExchanges'],
): void {
  if (exchanges.length === 0) return
  const tokenEstimate = estimateTokens(
    exchanges.map((exchange) => `${exchange.user} ${exchange.avatar}`).join(' '),
  )
  candidates.push({
    projection: 'avatar',
    sectionId: 'conversationState',
    segmentId: 'conversationStateRecentExchanges',
    tokenEstimate,
    apply: (draft) => {
      draft.avatar.sections.conversationState.recentExchanges = exchanges
    },
  })
  candidates.push({
    projection: 'gm',
    sectionId: 'conversationState',
    segmentId: 'conversationStateRecentExchanges',
    tokenEstimate,
    apply: (draft) => {
      draft.gm.sections.conversationState.recentExchanges = exchanges
    },
  })
}

function pushRecentMessageCandidate(
  candidates: CandidateSegment[],
  recentMessages: ContextEngineInput['recentMessages'],
): void {
  if (recentMessages.length === 0) return
  candidates.push({
    projection: 'gm',
    sectionId: 'conversationState',
    segmentId: 'conversationStateRecentMessages',
    tokenEstimate: estimateTokens(recentMessages.map((msg) => msg.content).join(' ')),
    apply: (draft) => {
      draft.gm.sections.conversationState.recentMessages = recentMessages
    },
  })
}

function pushUserPersonaCandidate(candidates: CandidateSegment[], input: ContextEngineInput): void {
  if (input.extensions.userPersona === null) return
  const persona = input.extensions.userPersona
  const personaText = toPersonaText(input.extensions.userPersona)
  if (personaText.length === 0) return
  const tokenEstimate = estimateTokens(personaText)
  candidates.push({
    projection: 'avatar',
    sectionId: 'userPersona',
    segmentId: 'userPersona',
    tokenEstimate,
    apply: (draft) => {
      draft.avatar.sections.userPersona = persona
    },
  })
  candidates.push({
    projection: 'gm',
    sectionId: 'userPersona',
    segmentId: 'userPersona',
    tokenEstimate,
    apply: (draft) => {
      draft.gm.sections.userPersona = persona
    },
  })
}

function pushWorldContextCandidate(
  candidates: CandidateSegment[],
  input: ContextEngineInput,
): void {
  const tokenEstimate = estimateTokens(
    [input.scenario.name, input.scenario.description, ...(input.scenario.goals ?? [])].join(' '),
  )
  candidates.push({
    projection: 'avatar',
    sectionId: 'worldContext',
    segmentId: 'worldContext',
    tokenEstimate,
    apply: () => {},
  })
  candidates.push({
    projection: 'gm',
    sectionId: 'worldContext',
    segmentId: 'worldContext',
    tokenEstimate,
    apply: () => {},
  })
}

function pushAvatarRetrievalCandidates(
  candidates: CandidateSegment[],
  retrieval: ReturnType<typeof dedupeRetrieval>,
  options: ContextEngineInput['extensions']['avatarRetrievalOptions'],
): void {
  if (retrieval === undefined) return
  const selectedAvatarKnowledgeAndWorld = selectBalancedRetrievedItems(
    [...retrieval.avatar_knowledge, ...retrieval.world],
    options?.maxChunks ?? AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS,
    options,
  )
  pushAvatarRetrievalSegmentCandidate(
    candidates,
    'retrievedContextAvatarKnowledge',
    selectedAvatarKnowledgeAndWorld.filter((item) => item.knowledgeType === 'avatar_knowledge'),
    retrieval.trace,
  )
  pushAvatarRetrievalSegmentCandidate(
    candidates,
    'retrievedContextWorld',
    selectedAvatarKnowledgeAndWorld.filter((item) => item.knowledgeType === 'world'),
    retrieval.trace,
  )
  pushAvatarRetrievalSegmentCandidate(
    candidates,
    'retrievedContextMedia',
    retrieval.media,
    retrieval.trace,
  )
}

function pushGmRetrievalCandidates(
  candidates: CandidateSegment[],
  retrieval: ReturnType<typeof dedupeRetrieval>,
): void {
  if (retrieval === undefined) return
  pushGmRetrievalSegmentCandidate(
    candidates,
    'retrievedContextAvatarKnowledge',
    retrieval.avatar_knowledge,
    retrieval.trace,
  )
  pushGmRetrievalSegmentCandidate(
    candidates,
    'retrievedContextWorld',
    retrieval.world,
    retrieval.trace,
  )
  pushGmRetrievalSegmentCandidate(
    candidates,
    'retrievedContextMedia',
    retrieval.media,
    retrieval.trace,
  )
}

function pushAvatarRetrievalSegmentCandidate(
  candidates: CandidateSegment[],
  segmentId: 'retrievedContextAvatarKnowledge' | 'retrievedContextWorld' | 'retrievedContextMedia',
  items: RetrievedKnowledgeItem[],
  trace: RetrievalTrace,
): void {
  if (items.length === 0) return
  candidates.push({
    projection: 'avatar',
    sectionId: 'retrievedContext',
    segmentId,
    tokenEstimate: estimateTokens(items.map((item) => item.content).join(' ')),
    apply: (draft) => {
      applyAvatarRetrievedContextSegment(draft, segmentId, items, trace)
    },
  })
}

function pushGmRetrievalSegmentCandidate(
  candidates: CandidateSegment[],
  segmentId: 'retrievedContextAvatarKnowledge' | 'retrievedContextWorld' | 'retrievedContextMedia',
  items: RetrievedKnowledgeItem[],
  trace: RetrievalTrace,
): void {
  if (items.length === 0) return
  candidates.push({
    projection: 'gm',
    sectionId: 'retrievedContext',
    segmentId,
    tokenEstimate: estimateTokens(items.map((item) => item.content).join(' ')),
    apply: (draft) => {
      draft.gm.sections.retrievedContext = {
        avatar_knowledge: [
          ...(draft.gm.sections.retrievedContext?.avatar_knowledge ?? []),
          ...(segmentId === 'retrievedContextAvatarKnowledge' ? items : []),
        ],
        world: [
          ...(draft.gm.sections.retrievedContext?.world ?? []),
          ...(segmentId === 'retrievedContextWorld' ? items : []),
        ],
        media: [
          ...(draft.gm.sections.retrievedContext?.media ?? []),
          ...(segmentId === 'retrievedContextMedia' ? items : []),
        ],
        trace,
      }
    },
  })
}

function applyAvatarRetrievedContextSegment(
  draft: MutableOutput,
  segmentId: 'retrievedContextAvatarKnowledge' | 'retrievedContextWorld' | 'retrievedContextMedia',
  items: RetrievedKnowledgeItem[],
  trace: RetrievalTrace,
): void {
  const current = draft.avatar.sections.retrievedContext
  const retrievedItems: RetrievedKnowledgeItem[] = []
  const typedSections = {
    avatar_knowledge: [] as RetrievedKnowledgeItem[],
    world: [] as RetrievedKnowledgeItem[],
    media: [] as RetrievedKnowledgeItem[],
  }

  if (current !== undefined) {
    retrievedItems.push(...current.retrievedItems)
    if (current.typedSections !== undefined) {
      typedSections.avatar_knowledge.push(...current.typedSections.avatar_knowledge)
      typedSections.world.push(...current.typedSections.world)
      typedSections.media.push(...current.typedSections.media)
    }
  }

  retrievedItems.push(...items)
  typedSections[toTypedSectionKey(segmentId)].push(...items)

  draft.avatar.sections.retrievedContext = {
    retrievedItems,
    typedSections,
    trace,
  }
}

function toTypedSectionKey(
  segmentId: 'retrievedContextAvatarKnowledge' | 'retrievedContextWorld' | 'retrievedContextMedia',
): 'avatar_knowledge' | 'world' | 'media' {
  if (segmentId === 'retrievedContextAvatarKnowledge') return 'avatar_knowledge'
  if (segmentId === 'retrievedContextWorld') return 'world'
  return 'media'
}

function pushAvatarTraitsCandidate(
  candidates: CandidateSegment[],
  input: ContextEngineInput,
): void {
  const traits = input.extensions.avatarTraits
  if (traits === undefined) return
  candidates.push({
    projection: 'avatar',
    sectionId: 'avatarTraits',
    segmentId: 'avatarTraits',
    tokenEstimate: estimateTokens(flattenAvatarTraits(traits).join(' ')),
    apply: (draft) => {
      draft.avatar.sections.avatarTraits = traits
    },
  })
}

function dedupeRetrieval(retrieval: ContextEngineInput['extensions']['retrieval']) {
  if (retrieval === undefined) return undefined
  const avatarKnowledge = dedupeRetrievedItems(retrieval.avatar_knowledge)
  const world = dedupeRetrievedItems(
    retrieval.world,
    new Set(avatarKnowledge.map((item) => item.chunkId)),
  )
  const media = dedupeRetrievedItems(
    retrieval.media,
    new Set([...avatarKnowledge, ...world].map((item) => item.chunkId)),
  )
  return { ...retrieval, avatar_knowledge: avatarKnowledge, world, media }
}

function dedupeRetrievedItems(
  items: RetrievedKnowledgeItem[],
  blockedChunkIds: Set<string> = new Set<string>(),
): RetrievedKnowledgeItem[] {
  const seen = new Set<string>(blockedChunkIds)
  const output: RetrievedKnowledgeItem[] = []
  for (const item of items) {
    if (seen.has(item.chunkId)) continue
    seen.add(item.chunkId)
    output.push(item)
  }
  return output
}

function toPersonaText(persona: ContextEngineInput['extensions']['userPersona']): string {
  if (persona === null) return ''
  return [
    persona.name,
    persona.roleInWorld,
    ...(persona.avatarRelationships ?? []),
    persona.dialogGuidance,
  ]
    .filter(hasText)
    .join(' ')
}

function estimateTokens(text: string): number {
  const compact = text.trim().replace(/\s+/g, ' ')
  if (compact.length === 0) return 0
  return Math.ceil(compact.length / 4)
}

export function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function normalizeResponseRules(rules: string[] | undefined): string[] {
  if (rules === undefined) return []
  return rules.map((rule) => rule.trim()).filter((rule) => rule.length > 0)
}

function flattenAvatarTraits(
  traits: NonNullable<ContextEngineInput['extensions']['avatarTraits']>,
): string[] {
  return [
    ...traits.identity,
    ...traits.personality,
    ...traits.speakingStyle,
    ...traits.background,
    ...traits.timeline,
    ...traits.currentSituation,
    ...traits.behaviouralRules,
  ]
}
