/**
 * @gami/shared — shared types and utilities
 *
 * This package is the single source of truth for types
 * used across apps in this monorepo.
 */

export type { ApiResponse, ApiError, ResponseMeta, ErrorCode } from './api-response.js'
export { ok, fail } from './api-response.js'
export type {
  AvatarStatus,
  AvatarSummary,
  LifecycleStatus,
  ScenarioStatus,
  ScenarioSummary,
  SessionSummary,
  ConversationSummary,
} from './entity-types.js'
export type {
  ConversationEndReason,
  ConversationStartedBy,
  SessionMemorySummary,
  SessionTransitionRecord,
  AvatarTransitionRecord,
  LifecycleSummary,
  EndConversationResponse,
} from './lifecycle-types.js'
