import type { RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import type { LayeredMemorySnapshot } from '../memory/memory.types.js'
import type { UserPersona } from '../user/index.js'
import type { AvatarComputedTraits, AvatarConfig } from './avatar.types.js'
import type { AvatarContextSections } from '../context/session-context.types.js'

export type AvatarAwarenessItem = {
  name: string
  description?: string
  scope?: string
  availability: 'available' | 'locked'
}

export type AvatarPromptRetrievalSections = {
  memory: RetrievedKnowledgeItem[]
  world: RetrievedKnowledgeItem[]
  media: RetrievedKnowledgeItem[]
}

export type AvatarPromptOptions = {
  sections?: AvatarContextSections
  identitySource?: AvatarPromptIdentitySource | null
  gmNotes?: string
  worldContext?: string
  avatarAwareness?: AvatarAwarenessItem[]
  userPersona?: UserPersona
  memory?: LayeredMemorySnapshot
  retrieval?: AvatarPromptRetrievalSections
}

export type AvatarPromptIdentitySource =
  | {
      source: 'computedTraits'
      computedTraits: AvatarComputedTraits
    }
  | {
      source: 'personaPrompt'
      personaPrompt: string
    }

export type AvatarPromptIdentityInput = Pick<AvatarConfig, 'personaPrompt'> & {
  computedTraits?: AvatarComputedTraits | null
}
export type AvatarPromptIdentityConfig = Omit<AvatarConfig, 'computedTraits'> & {
  computedTraits?: AvatarComputedTraits | null
}
