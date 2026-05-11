import type { RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import type { LongTermMemoryFact } from '../memory/memory.types.js'
import type { ContextEngineInput, ContextEngineOutput } from './context-engine.types.js'
import type {
  ContextProjection,
  ContextSegmentId,
  ContextEnginePolicy,
} from './context-engine.policy.js'
import { DEFAULT_CONTEXT_ENGINE_POLICY, precedenceRank } from './context-engine.policy.js'

const EMPTY_EXCHANGES: ContextEngineOutput['avatar']['recentExchanges'] = []
const EMPTY_FACTS: ContextEngineOutput['avatar']['longTermFacts'] = []
const EMPTY_MESSAGES: ContextEngineOutput['gm']['recentMessages'] = []

type CandidateSegment = {
  projection: ContextProjection
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
    const draft = buildBaseOutput(input, normalized)
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
    retrieval: dedupeRetrieval(input.extensions.retrieval),
  }
}

function buildBaseOutput(
  input: ContextEngineInput,
  normalized: ReturnType<typeof normalizeInput>,
): MutableOutput {
  return {
    avatar: {
      ...(input.activeAvatarId !== undefined ? { avatarId: input.activeAvatarId } : {}),
      recentExchanges: EMPTY_EXCHANGES,
      workingMemory: {},
      longTermFacts: EMPTY_FACTS,
      userPersona: input.extensions.userPersona,
      gmNotes: input.extensions.gmDirective,
      scenario: input.scenario,
    },
    gm: {
      recentMessages: EMPTY_MESSAGES,
      memory: {},
      currentState: input.gmState,
      availableAvatars: input.availableAvatars,
      userPersona: input.extensions.userPersona,
      scenario: input.scenario,
      ...(normalized.retrieval !== undefined
        ? {
            knowledge: {
              memory: normalized.retrieval.memory,
              world: normalized.retrieval.world,
              media: normalized.retrieval.media,
            },
          }
        : {}),
    },
  }
}

function buildCandidates(
  input: ContextEngineInput,
  normalized: ReturnType<typeof normalizeInput>,
): CandidateSegment[] {
  const memory = input.extensions.memory
  const candidates: CandidateSegment[] = []

  pushScenarioCandidate(candidates, input)
  pushGmDirectiveCandidate(candidates, input)
  pushUserPersonaCandidate(candidates, input)
  pushShortTermCandidates(candidates, memory?.shortTerm?.recentExchanges ?? EMPTY_EXCHANGES)
  pushWorkingMemoryCandidates(candidates, memory)
  pushLongTermFactCandidates(candidates, normalized.longTermFacts)
  pushRetrievalCandidates(candidates, normalized.retrieval)
  pushRecentMessageCandidate(candidates, input.recentMessages)

  return candidates
}

function pushScenarioCandidate(candidates: CandidateSegment[], input: ContextEngineInput): void {
  const tokenEstimate = estimateTokens(
    [input.scenario.name, input.scenario.description, ...(input.scenario.goals ?? [])].join(' '),
  )
  candidates.push({
    projection: 'avatar',
    segmentId: 'scenario',
    tokenEstimate,
    apply: () => {},
  })
  candidates.push({
    projection: 'gm',
    segmentId: 'scenario',
    tokenEstimate,
    apply: () => {},
  })
}

function pushGmDirectiveCandidate(candidates: CandidateSegment[], input: ContextEngineInput): void {
  if (!hasText(input.extensions.gmDirective)) return
  const tokenEstimate = estimateTokens(input.extensions.gmDirective)
  candidates.push({
    projection: 'avatar',
    segmentId: 'gmDirective',
    tokenEstimate,
    apply: () => {},
  })
}

function pushUserPersonaCandidate(candidates: CandidateSegment[], input: ContextEngineInput): void {
  const personaText = toPersonaText(input.extensions.userPersona)
  if (personaText.length === 0) return
  const tokenEstimate = estimateTokens(personaText)
  candidates.push({
    projection: 'avatar',
    segmentId: 'userPersona',
    tokenEstimate,
    apply: () => {},
  })
  candidates.push({
    projection: 'gm',
    segmentId: 'userPersona',
    tokenEstimate,
    apply: () => {},
  })
}

function pushShortTermCandidates(
  candidates: CandidateSegment[],
  exchanges: ContextEngineOutput['avatar']['recentExchanges'],
): void {
  if (exchanges.length === 0) return
  const tokenEstimate = estimateTokens(
    exchanges.map((exchange) => `${exchange.user} ${exchange.avatar}`).join(' '),
  )
  candidates.push({
    projection: 'avatar',
    segmentId: 'shortTermMemory',
    tokenEstimate,
    apply: (draft) => {
      draft.avatar.recentExchanges = exchanges
    },
  })
  candidates.push({
    projection: 'gm',
    segmentId: 'shortTermMemory',
    tokenEstimate,
    apply: (draft) => {
      draft.gm.memory.shortTerm = { recentExchanges: exchanges }
    },
  })
}

function pushWorkingMemoryCandidates(
  candidates: CandidateSegment[],
  memory: ContextEngineInput['extensions']['memory'],
): void {
  const sessionSummary = memory?.working?.session?.summary
  const avatarSummary = memory?.working?.avatar?.summary
  const workingText = [sessionSummary, avatarSummary].filter(hasText).join(' ')
  if (workingText.length === 0) return
  const tokenEstimate = estimateTokens(workingText)
  candidates.push({
    projection: 'avatar',
    segmentId: 'workingMemory',
    tokenEstimate,
    apply: (draft) => {
      draft.avatar.workingMemory = {
        ...(memory?.working?.session !== undefined ? { session: memory.working.session } : {}),
        ...(memory?.working?.avatar !== undefined ? { avatar: memory.working.avatar } : {}),
      }
    },
  })
  candidates.push({
    projection: 'gm',
    segmentId: 'workingMemory',
    tokenEstimate,
    apply: (draft) => {
      const workingSummary = toWorkingSummary(memory)
      if (workingSummary !== undefined) {
        draft.gm.memory.workingSummary = workingSummary
      }
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
    segmentId: 'longTermFacts',
    tokenEstimate,
    apply: (draft) => {
      draft.avatar.longTermFacts = facts
    },
  })
  candidates.push({
    projection: 'gm',
    segmentId: 'longTermFacts',
    tokenEstimate,
    apply: (draft) => {
      draft.gm.memory.longTermFacts = facts
    },
  })
}

function pushRetrievalCandidates(
  candidates: CandidateSegment[],
  retrieval: ReturnType<typeof dedupeRetrieval>,
): void {
  if (retrieval === undefined) return
  pushRetrievalSegmentCandidate(candidates, 'typedRetrievalMemory', retrieval.memory)
  pushRetrievalSegmentCandidate(candidates, 'typedRetrievalWorld', retrieval.world)
  pushRetrievalSegmentCandidate(candidates, 'typedRetrievalMedia', retrieval.media)
}

function pushRetrievalSegmentCandidate(
  candidates: CandidateSegment[],
  segmentId: 'typedRetrievalMemory' | 'typedRetrievalWorld' | 'typedRetrievalMedia',
  items: RetrievedKnowledgeItem[],
): void {
  if (items.length === 0) return
  const tokenEstimate = estimateTokens(items.map((item) => item.content).join(' '))
  candidates.push({
    projection: 'avatar',
    segmentId,
    tokenEstimate,
    apply: (draft) => {
      const existing = draft.avatar.knowledge?.retrievedItems ?? []
      draft.avatar.knowledge = { retrievedItems: [...existing, ...items] }
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
    segmentId: 'recentMessages',
    tokenEstimate: estimateTokens(recentMessages.map((msg) => msg.content).join(' ')),
    apply: (draft) => {
      draft.gm.recentMessages = recentMessages
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
  const budgets = {
    avatar: policy.tokenBudget.avatarMaxTokens,
    gm: policy.tokenBudget.gmMaxTokens,
  }
  const used = { avatar: 0, gm: 0 }
  const kept: ContextEngineOutput['trace']['selection']['kept'] = []
  const trimmed: ContextEngineOutput['trace']['selection']['trimmed'] = []

  for (const candidate of stableSortCandidates(candidates, policy)) {
    const isProtected = policy.protectedSegments.includes(candidate.segmentId)
    const canFit =
      used[candidate.projection] + candidate.tokenEstimate <= budgets[candidate.projection]
    if (!isProtected && !canFit) {
      trimmed.push({
        projection: candidate.projection,
        segmentId: candidate.segmentId,
        tokenEstimate: candidate.tokenEstimate,
        reason: 'budget_exceeded',
      })
      continue
    }

    candidate.apply(draft)
    used[candidate.projection] += candidate.tokenEstimate
    kept.push({
      projection: candidate.projection,
      segmentId: candidate.segmentId,
      tokenEstimate: candidate.tokenEstimate,
      reason: isProtected ? 'protected' : 'within_budget',
    })
  }

  return { kept, trimmed }
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
        'policy-driven-precedence',
        'single-pass-assembly',
        'deterministic-trimming',
      ],
      gmProjection: ['policy-driven-precedence', 'single-pass-assembly', 'deterministic-trimming'],
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
    protectedSegments: [...policy.protectedSegments],
    precedence: [...policy.precedence],
  }
}

function buildTraceSelectedInputs(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs'] {
  return {
    hasActiveAvatar: input.activeAvatarId !== undefined,
    recentMessageCount: input.recentMessages.length,
    shortTermExchangeCount: input.extensions.memory?.shortTerm?.recentExchanges.length ?? 0,
    hasWorkingMemory: input.extensions.memory?.working !== undefined,
    longTermFactCount: input.extensions.memory?.longTerm?.facts.length ?? 0,
    retrievalCounts: buildTraceRetrievalCounts(input),
    hasUserPersona: input.extensions.userPersona !== null,
    hasGmDirective: hasText(input.extensions.gmDirective),
  }
}

function buildTraceRetrievalCounts(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs']['retrievalCounts'] {
  return {
    memory: input.extensions.retrieval?.memory.length ?? 0,
    world: input.extensions.retrieval?.world.length ?? 0,
    media: input.extensions.retrieval?.media.length ?? 0,
  }
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
  const memory = dedupeRetrievedItems(retrieval.memory)
  const world = dedupeRetrievedItems(retrieval.world, new Set(memory.map((item) => item.chunkId)))
  const media = dedupeRetrievedItems(
    retrieval.media,
    new Set([...memory, ...world].map((item) => item.chunkId)),
  )
  return { ...retrieval, memory, world, media }
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
