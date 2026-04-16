/**
 * Context domain types.
 *
 * The Context module assembles the three dimensions passed to the Avatar
 * on each turn: memory, experience/world, and retrieved knowledge.
 * It is responsible for respecting the token budget.
 */
export interface RuntimeContext {
  /** Recent messages included in the prompt window. */
  recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>
  /** Compacted summary of the session so far. */
  memorySummary?: string
  /** Persistent user facts relevant to this turn. */
  userFacts?: Record<string, string>
  /** Scenario world description and objectives. */
  scenarioContext?: string
  /** Retrieved knowledge passages (RAG — EPIC 4.1+). */
  retrievedKnowledge?: string[]
  /** Optional directive from the Game Master for this turn. */
  gmDirective?: string
}
