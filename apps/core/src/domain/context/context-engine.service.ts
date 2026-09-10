/* eslint-disable max-lines */
import type { RetrievalTrace, RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import { selectBalancedRetrievedItems } from '../knowledge/retrieval-selection.js'
import type { LongTermMemoryFact } from '../memory/memory.types.js'
import type { ContextEngineInput, ContextEngineOutput } from './context-engine.types.js'
import type {
  ContextProjection,
  ContextSectionId,
  ContextSegmentId,
  ContextEnginePolicy,
} from './context-engine.policy.js'
import { DEFAULT_CONTEXT_ENGINE_POLICY, precedenceRank } from './context-engine.policy.js'
import { AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS } from '@gami/shared'

const EMPTY_EXCHANGES: ContextEngineOutput['avatar']['sections']['conversationState']['recentExchanges'] =
  []
const EMPTY_EPISODIC_MEMORIES: ContextEngineOutput['avatar']['sections']['conversationState']['episodicMemories'] =
  []
const EMPTY_FACTS: ContextEngineOutput['avatar']['sections']['conversationState']['longTermFacts'] =
  []
const EMPTY_MESSAGES: ContextEngineOutput['gm']['sections']['conversationState']['recentMessages'] =
  []
const EMPTY_RESPONSE_RULES: ContextEngineOutput['avatar']['sections']['responseRules']['items'] = []

type CandidateSegment = {
  projection: ContextProjection
  sectionId: ContextSectionId
  segmentId: ContextSegmentId
  tokenEstimate: number
  apply: (draft: MutableOutput) => void
}

type MutableOutput = {
  avatar: ContextEngineOutput['avatar']
  gm: ContextEngineOutput['gm']
}

export class ContextEngine {
  constructor(private readonly policy: ContextEnginePolicy = DEFAULT_CONTEXT_ENGINE_POLICY) {}

  assemble(input: ContextEngineInput): ContextEngineOutput {
    const normalized = normalizeInput(input)
    const draft = buildBaseOutput(input)
    const candidates = buildCandidates(input, normalized)
    const selection = applyBudgetAndSelection(draft, candidates, this.policy)

    return {
      avatar: draft.avatar,
      gm: draft.gm,
      trace: buildTrace(input, this.policy, selection),
    }
  }
}

function normalizeInput(input: ContextEngineInput) {
  return {
    longTermFacts: dedupeLongTermFacts(input.extensions.memory?.longTerm?.facts ?? EMPTY_FACTS),
    avatarRetrieval: dedupeRetrieval(input.extensions.retrieval),
    gmRetrieval: dedupeRetrieval(input.extensions.retrievalForGm),
    responseRules: normalizeResponseRules(input.extensions.responseRules),
  }
}

function buildBaseOutput(input: ContextEngineInput): MutableOutput {
  return {
    avatar: {
      ...(input.activeAvatarId !== undefined ? { avatarId: input.activeAvatarId } : {}),
      sections: {
        directorNotes: null,
        responseRules: { items: EMPTY_RESPONSE_RULES },
        conversationState: {
          recentExchanges: EMPTY_EXCHANGES,
          workingMemory: {},
          episodicMemories: EMPTY_EPISODIC_MEMORIES,
          longTermFacts: EMPTY_FACTS,
        },
        userPersona: null,
        worldContext: input.scenario,
      },
    },
    gm: {
      currentState: input.gmState,
      availableAvatars: input.availableAvatars,
      sections: {
        conversationState: {
          recentMessages: EMPTY_MESSAGES,
          recentExchanges: EMPTY_EXCHANGES,
          episodicMemories: EMPTY_EPISODIC_MEMORIES,
          longTermFacts: EMPTY_FACTS,
        },
        userPersona: null,
        worldContext: input.scenario,
      },
    },
  }
}

function buildCandidates(
  input: ContextEngineInput,
  normalized: ReturnType<typeof normalizeInput>,
): CandidateSegment[] {
  const memory = input.extensions.memory
  const candidates: CandidateSegment[] = []

  pushDirectorNotesCandidate(candidates, input)
  pushResponseRulesCandidate(candidates, normalized.responseRules)
  pushWorkingMemoryCandidates(candidates, memory)
  pushEpisodicMemoryCandidates(candidates, memory?.episodicMemories ?? EMPTY_EPISODIC_MEMORIES)
  pushLongTermFactCandidates(candidates, normalized.longTermFacts)
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

// eslint-disable-next-line complexity
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
        draft.gm.sections.conversationState.workingSummary = memory.working.conversation.summary
      } else {
        const workingSummary = toWorkingSummary(memory)
        if (workingSummary !== undefined) {
          draft.gm.sections.conversationState.workingSummary = workingSummary
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

function pushLongTermFactCandidates(
  candidates: CandidateSegment[],
  facts: LongTermMemoryFact[],
): void {
  if (facts.length === 0) return
  const tokenEstimate = estimateTokens(
    facts.map((fact) => `${fact.category} ${fact.key} ${fact.value}`).join(' '),
  )
  candidates.push({
    projection: 'avatar',
    sectionId: 'conversationState',
    segmentId: 'conversationStateLongTermFacts',
    tokenEstimate,
    apply: (draft) => {
      draft.avatar.sections.conversationState.longTermFacts = facts
    },
  })
  candidates.push({
    projection: 'gm',
    sectionId: 'conversationState',
    segmentId: 'conversationStateLongTermFacts',
    tokenEstimate,
    apply: (draft) => {
      draft.gm.sections.conversationState.longTermFacts = facts
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

function stableSortCandidates(
  candidates: CandidateSegment[],
  policy: ContextEnginePolicy,
): CandidateSegment[] {
  return candidates.slice().sort((a, b) => {
    const precedenceDelta =
      precedenceRank(policy, a.segmentId) - precedenceRank(policy, b.segmentId)
    if (precedenceDelta !== 0) return precedenceDelta
    if (a.projection !== b.projection) return a.projection.localeCompare(b.projection)
    if (a.segmentId !== b.segmentId) return a.segmentId.localeCompare(b.segmentId)
    return 0
  })
}

function applyBudgetAndSelection(
  draft: MutableOutput,
  candidates: CandidateSegment[],
  policy: ContextEnginePolicy,
): ContextEngineOutput['trace']['selection'] {
  const kept: ContextEngineOutput['trace']['selection']['kept'] = []
  const trimmed: ContextEngineOutput['trace']['selection']['trimmed'] = []
  const budgetUsed: Record<ContextProjection, number> = {
    avatar: 0,
    gm: 0,
  }

  for (const candidate of stableSortCandidates(candidates, policy)) {
    const isProtected = policy.protectedSegments.includes(candidate.segmentId)
    if (!isProtected && exceedsProjectionBudget(budgetUsed, candidate, policy)) {
      trimmed.push({
        projection: candidate.projection,
        sectionId: candidate.sectionId,
        segmentId: candidate.segmentId,
        tokenEstimate: candidate.tokenEstimate,
        reason: 'budget_exceeded',
      })
      continue
    }

    candidate.apply(draft)
    budgetUsed[candidate.projection] += candidate.tokenEstimate
    kept.push({
      projection: candidate.projection,
      sectionId: candidate.sectionId,
      segmentId: candidate.segmentId,
      tokenEstimate: candidate.tokenEstimate,
      reason: isProtected ? 'protected' : 'within_budget',
    })
  }

  return { kept, trimmed }
}

function exceedsProjectionBudget(
  budgetUsed: Record<ContextProjection, number>,
  candidate: CandidateSegment,
  policy: ContextEnginePolicy,
): boolean {
  const maxBudget =
    candidate.projection === 'avatar'
      ? policy.tokenBudget.avatarMaxTokens
      : policy.tokenBudget.gmMaxTokens
  return budgetUsed[candidate.projection] + candidate.tokenEstimate > maxBudget
}

function buildTrace(
  input: ContextEngineInput,
  policy: ContextEnginePolicy,
  selection: ContextEngineOutput['trace']['selection'],
): ContextEngineOutput['trace'] {
  return {
    deterministic: true,
    policy: buildTracePolicy(policy),
    selectedInputs: buildTraceSelectedInputs(input),
    rationale: {
      avatarProjection: [
        'section-driven-precedence',
        'single-pass-assembly',
        'deterministic-selection',
      ],
      gmProjection: [
        'section-driven-precedence',
        'single-pass-assembly',
        'deterministic-selection',
      ],
    },
    selection,
  }
}

function buildTracePolicy(policy: ContextEnginePolicy): ContextEngineOutput['trace']['policy'] {
  return {
    tokenBudget: {
      avatarMaxTokens: policy.tokenBudget.avatarMaxTokens,
      gmMaxTokens: policy.tokenBudget.gmMaxTokens,
    },
    sectionPrecedence: [...policy.sectionPrecedence],
    protectedSegments: [...policy.protectedSegments],
    precedence: [...policy.precedence],
  }
}

// eslint-disable-next-line complexity
function buildTraceSelectedInputs(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs'] {
  const visibility = buildTraceVisibility(input)
  return {
    hasActiveAvatar: input.activeAvatarId !== undefined,
    recentMessageCount: input.recentMessages.length,
    shortTermExchangeCount: input.extensions.memory?.shortTerm?.recentExchanges.length ?? 0,
    episodicMemoryCount: input.extensions.memory?.episodicMemories?.length ?? 0,
    hasWorkingMemory: input.extensions.memory?.working !== undefined,
    longTermFactCount: input.extensions.memory?.longTerm?.facts.length ?? 0,
    retrievalCounts: buildTraceRetrievalCounts(input),
    ...(input.extensions.retrieval?.trace !== undefined
      ? { retrieval: input.extensions.retrieval.trace }
      : {}),
    ...(input.extensions.retrievalForGm?.trace !== undefined
      ? { gmRetrieval: input.extensions.retrievalForGm.trace }
      : {}),
    gmRetrievalCounts: buildTraceGmRetrievalCounts(input),
    ...(visibility !== undefined ? { visibility } : {}),
    hasUserPersona: input.extensions.userPersona !== null,
    hasGmDirective: hasText(input.extensions.gmDirective),
    responseRuleCount: normalizeResponseRules(input.extensions.responseRules).length,
    hasAvatarTraits: input.extensions.avatarTraits !== undefined,
  }
}

function buildTraceRetrievalCounts(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs']['retrievalCounts'] {
  return {
    avatar_knowledge: input.extensions.retrieval?.avatar_knowledge.length ?? 0,
    world: input.extensions.retrieval?.world.length ?? 0,
    media: input.extensions.retrieval?.media.length ?? 0,
  }
}

function buildTraceGmRetrievalCounts(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs']['gmRetrievalCounts'] {
  return {
    avatar_knowledge: input.extensions.retrievalForGm?.avatar_knowledge.length ?? 0,
    world: input.extensions.retrievalForGm?.world.length ?? 0,
    media: input.extensions.retrievalForGm?.media.length ?? 0,
  }
}

// Keep this helper explicit for trace explainability while preserving deterministic defaults.
// eslint-disable-next-line complexity
function buildTraceVisibility(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs']['visibility'] | undefined {
  const trace = input.extensions.retrieval?.trace
  if (trace === undefined) return undefined
  const perTypeVisibility = [
    trace.perType.avatar_knowledge.visibility,
    trace.perType.world.visibility,
    trace.perType.media.visibility,
  ]
  const activeAvatarId = firstDefinedAvatarId(perTypeVisibility) ?? input.activeAvatarId
  return {
    ...(activeAvatarId !== undefined ? { activeAvatarId } : {}),
    excludedCounts: {
      avatar_knowledge: trace.perType.avatar_knowledge.visibility?.excludedChunkCount ?? 0,
      world: trace.perType.world.visibility?.excludedChunkCount ?? 0,
      media: trace.perType.media.visibility?.excludedChunkCount ?? 0,
    },
    ...(input.extensions.retrievalForGm !== undefined
      ? {
          gmRetrievalCounts: {
            avatar_knowledge: input.extensions.retrievalForGm.avatar_knowledge.length,
            world: input.extensions.retrievalForGm.world.length,
            media: input.extensions.retrievalForGm.media.length,
          },
          gmUnrestricted: true,
        }
      : {}),
  }
}

function firstDefinedAvatarId(
  visibilities: Array<{ activeAvatarId?: string } | undefined>,
): string | undefined {
  return visibilities.map((visibility) => visibility?.activeAvatarId).find(hasText)
}

function dedupeLongTermFacts(facts: LongTermMemoryFact[]): LongTermMemoryFact[] {
  const byKey = new Map<string, LongTermMemoryFact>()
  for (const fact of facts) {
    const key = `${fact.category.trim().toLowerCase()}::${fact.key.trim().toLowerCase()}`
    if (!byKey.has(key)) byKey.set(key, fact)
  }
  return [...byKey.values()]
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

function toWorkingSummary(memory: ContextEngineInput['extensions']['memory']): string | undefined {
  if (memory === undefined) return undefined
  const parts: string[] = []
  if (hasText(memory.working?.session?.summary)) parts.push(memory.working.session.summary.trim())
  if (hasText(memory.working?.avatar?.summary)) {
    parts.push(
      `Avatar (${memory.working.avatar.avatarId}): ${memory.working.avatar.summary.trim()}`,
    )
  }
  return parts.length > 0 ? parts.join('\n') : undefined
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

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeResponseRules(rules: string[] | undefined): string[] {
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

export function getContextSectionPrecedence(
  policy: ContextEnginePolicy = DEFAULT_CONTEXT_ENGINE_POLICY,
): ContextSectionId[] {
  return [...policy.sectionPrecedence]
}

export function getContextSegmentPrecedence(
  policy: ContextEnginePolicy = DEFAULT_CONTEXT_ENGINE_POLICY,
): ContextSegmentId[] {
  return [...policy.precedence]
}

export function compareSegmentPrecedence(
  a: ContextSegmentId,
  b: ContextSegmentId,
  policy: ContextEnginePolicy = DEFAULT_CONTEXT_ENGINE_POLICY,
): number {
  return precedenceRank(policy, a) - precedenceRank(policy, b)
}
