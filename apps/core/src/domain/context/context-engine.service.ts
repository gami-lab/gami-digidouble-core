import type { ContextEngineInput, ContextEngineOutput } from './context-engine.types.js'

const EMPTY_EXCHANGES: ContextEngineOutput['avatar']['recentExchanges'] = []
const EMPTY_FACTS: ContextEngineOutput['avatar']['longTermFacts'] = []

export class ContextEngine {
  assemble(input: ContextEngineInput): ContextEngineOutput {
    const avatar = buildAvatarProjection(input)
    const gm = buildGmProjection(input)
    const trace = buildTrace(input)

    return {
      avatar,
      gm,
      trace,
    }
  }
}

function buildAvatarProjection(input: ContextEngineInput): ContextEngineOutput['avatar'] {
  const memory = input.extensions.memory
  const avatar: ContextEngineOutput['avatar'] = {
    ...(input.activeAvatarId !== undefined ? { avatarId: input.activeAvatarId } : {}),
    recentExchanges: memory?.shortTerm?.recentExchanges ?? EMPTY_EXCHANGES,
    workingMemory: buildAvatarWorkingMemory(memory),
    longTermFacts: memory?.longTerm?.facts ?? EMPTY_FACTS,
    userPersona: input.extensions.userPersona,
    gmNotes: input.extensions.gmDirective,
    scenario: input.scenario,
  }
  const knowledge = buildAvatarKnowledge(input.extensions.retrieval)
  if (knowledge !== undefined) avatar.knowledge = knowledge
  return avatar
}

function buildGmProjection(input: ContextEngineInput): ContextEngineOutput['gm'] {
  const memory = input.extensions.memory
  const retrieval = input.extensions.retrieval
  const workingSummary = toWorkingSummary(memory)
  return {
    recentMessages: input.recentMessages,
    memory: {
      ...(memory?.shortTerm?.recentExchanges !== undefined
        ? { shortTerm: { recentExchanges: memory.shortTerm.recentExchanges } }
        : {}),
      ...(workingSummary !== undefined ? { workingSummary } : {}),
      ...(memory?.longTerm?.facts !== undefined ? { longTermFacts: memory.longTerm.facts } : {}),
    },
    ...(retrieval !== undefined
      ? { knowledge: { memory: retrieval.memory, world: retrieval.world, media: retrieval.media } }
      : {}),
    currentState: input.gmState,
    availableAvatars: input.availableAvatars,
    userPersona: input.extensions.userPersona,
    scenario: input.scenario,
  }
}

function buildAvatarWorkingMemory(
  memory: ContextEngineInput['extensions']['memory'],
): ContextEngineOutput['avatar']['workingMemory'] {
  return {
    ...(memory?.working?.session !== undefined ? { session: memory.working.session } : {}),
    ...(memory?.working?.avatar !== undefined ? { avatar: memory.working.avatar } : {}),
  }
}

function buildAvatarKnowledge(
  retrieval: ContextEngineInput['extensions']['retrieval'],
): ContextEngineOutput['avatar']['knowledge'] | undefined {
  if (retrieval === undefined) return undefined
  return {
    retrievedItems: [...retrieval.memory, ...retrieval.world, ...retrieval.media],
  }
}

function buildTrace(input: ContextEngineInput): ContextEngineOutput['trace'] {
  return {
    deterministic: true,
    selectedInputs: buildSelectedInputs(input),
    rationale: {
      avatarProjection: ['single-pass-assembly', 'memory-first', 'retrieval-merged'],
      gmProjection: ['single-pass-assembly', 'shared-memory-source', 'shared-retrieval-source'],
    },
  }
}

function buildSelectedInputs(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs'] {
  const memory = input.extensions.memory
  return {
    hasActiveAvatar: input.activeAvatarId !== undefined,
    recentMessageCount: input.recentMessages.length,
    shortTermExchangeCount: memory?.shortTerm?.recentExchanges.length ?? 0,
    hasWorkingMemory: memory?.working !== undefined,
    longTermFactCount: memory?.longTerm?.facts.length ?? 0,
    retrievalCounts: buildRetrievalCounts(input.extensions.retrieval),
    hasUserPersona: input.extensions.userPersona !== null,
    hasGmDirective: hasText(input.extensions.gmDirective),
  }
}

function buildRetrievalCounts(
  retrieval: ContextEngineInput['extensions']['retrieval'],
): ContextEngineOutput['trace']['selectedInputs']['retrievalCounts'] {
  return {
    memory: retrieval?.memory.length ?? 0,
    world: retrieval?.world.length ?? 0,
    media: retrieval?.media.length ?? 0,
  }
}

function toWorkingSummary(memory: ContextEngineInput['extensions']['memory']): string | undefined {
  if (memory === undefined) return undefined
  const segments: string[] = []
  if (hasText(memory.working?.session?.summary)) {
    segments.push(memory.working.session.summary.trim())
  }
  if (hasText(memory.working?.avatar?.summary)) {
    segments.push(
      `Avatar (${memory.working.avatar.avatarId}): ${memory.working.avatar.summary.trim()}`,
    )
  }
  return segments.length > 0 ? segments.join('\n') : undefined
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
