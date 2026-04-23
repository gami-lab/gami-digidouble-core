/**
 * Avatar transition domain types.
 *
 * Defines the declarative rules that govern when and how users move from one
 * avatar to another. Rules are stored in ScenarioConfig and evaluated by the
 * transition engine (transition-engine.ts).
 */

export type TransitionTriggerType = 'progression' | 'topic_repeat' | 'manual'

export interface AvatarTransitionRule {
  /** Avatar that must be currently active for this rule to apply. */
  fromAvatarId: string
  /** Avatar to transition to when the rule fires. */
  toAvatarId: string
  /** What condition makes this rule eligible. */
  trigger: TransitionTriggerType
  /**
   * For 'topic_repeat' trigger: the specific topic string that must appear
   * in GameMasterState.topicsCovered for this rule to be eligible.
   * Ignored for other trigger types.
   */
  topic?: string
}

export interface EligibleTransition {
  toAvatarId: string
  /** Human-readable reason string included in event payloads and conversation.reason. */
  reason: string
  rule: AvatarTransitionRule
}
