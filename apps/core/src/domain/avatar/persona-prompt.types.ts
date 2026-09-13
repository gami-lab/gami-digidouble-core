import type { RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import type { AvatarContextSections } from '../context/session-context.types.js'
import type { DialogueControlMode } from '../game-master/game-master.types.js'

export type AvatarAwarenessItem = {
  name: string
  description?: string
  scope?: string
  availability: 'available' | 'locked'
}

export type AvatarPromptRetrievalSections = {
  avatar_knowledge: RetrievedKnowledgeItem[]
  world: RetrievedKnowledgeItem[]
  media: RetrievedKnowledgeItem[]
}

export type AvatarPromptOptions = {
  /** Structured context is the only prompt input boundary. */
  sections: AvatarContextSections
  avatarAwareness?: AvatarAwarenessItem[]
  gmGuidance?: {
    mode: DialogueControlMode
    askFollowUp: boolean
    directorNotes?: string
    retrievalStatus?: 'insufficient_evidence'
  }
}
