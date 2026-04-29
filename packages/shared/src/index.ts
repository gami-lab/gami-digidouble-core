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
  ScenarioStatus,
  ScenarioSummary,
  SessionSummary,
  ConversationSummary,
} from './entity-types.js'
