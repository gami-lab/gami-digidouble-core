import type { UserFact } from '../../domain/memory/memory.types.js'

export type ExtractUserFactsInput = {
  userId: string
  sessionId: string
  conversationId: string
  /** Langfuse trace id for the extraction LLM call. */
  requestId: string
  messages: Array<{
    role: 'user' | 'avatar' | 'system'
    content: string
  }>
}

export type ExtractedFact = Pick<UserFact, 'category' | 'key' | 'value'> & {
  confidence?: number
}

export interface IUserFactExtractor {
  extract(input: ExtractUserFactsInput): Promise<ExtractedFact[]>
}
