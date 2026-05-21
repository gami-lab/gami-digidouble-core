import type { AdminSessionContextResponse, SessionContextTrace } from '@gami/shared'
import type { SessionContextSnapshot } from '../../../domain/context/session-context.types.js'

/**
 * Boundary mapper.
 *
 * Ownership:
 * - Internal context engine snapshot: domain/context/session-context.types.ts
 * - Public admin context DTO: @gami/shared AdminSessionContextResponse
 */
export function toAdminSessionContextResponse(
  snapshot: SessionContextSnapshot,
): AdminSessionContextResponse {
  return {
    sessionId: snapshot.sessionId,
    avatarContext: snapshot.avatarContext,
    gmContext: snapshot.gmContext,
    contextTrace: toSessionContextTrace(snapshot),
  }
}

const MAX_TRACE_SEGMENTS = 24
const MAX_POLICY_SEGMENTS = 16

function toSessionContextTrace(snapshot: SessionContextSnapshot): SessionContextTrace {
  const typedSnapshot = snapshot as SessionContextSnapshot & {
    contextTrace: {
      selection: {
        kept: Array<{
          segmentId: SessionContextTrace['selection']['kept'][number]['segmentId']
        }>
        trimmed: Array<{
          reason: SessionContextTrace['selection']['trimmed'][number]['reason']
        }>
      }
    }
  }
  const trace = typedSnapshot.contextTrace
  return {
    deterministic: true,
    policy: {
      tokenBudget: {
        avatarMaxTokens: trace.policy.tokenBudget.avatarMaxTokens,
        gmMaxTokens: trace.policy.tokenBudget.gmMaxTokens,
      },
      protectedSegments: trace.policy.protectedSegments.slice(0, MAX_POLICY_SEGMENTS),
      precedence: trace.policy.precedence.slice(0, MAX_POLICY_SEGMENTS),
    },
    selectedInputs: {
      hasActiveAvatar: trace.selectedInputs.hasActiveAvatar,
      recentMessageCount: trace.selectedInputs.recentMessageCount,
      shortTermExchangeCount: trace.selectedInputs.shortTermExchangeCount,
      hasWorkingMemory: trace.selectedInputs.hasWorkingMemory,
      longTermFactCount: trace.selectedInputs.longTermFactCount,
      retrievalCounts: {
        memory: trace.selectedInputs.retrievalCounts.memory,
        world: trace.selectedInputs.retrievalCounts.world,
        media: trace.selectedInputs.retrievalCounts.media,
      },
      ...(trace.selectedInputs.visibility !== undefined
        ? {
            visibility: {
              ...(trace.selectedInputs.visibility.activeAvatarId !== undefined
                ? { activeAvatarId: trace.selectedInputs.visibility.activeAvatarId }
                : {}),
              excludedCounts: {
                memory: trace.selectedInputs.visibility.excludedCounts.memory,
                world: trace.selectedInputs.visibility.excludedCounts.world,
                media: trace.selectedInputs.visibility.excludedCounts.media,
              },
            },
          }
        : {}),
      hasUserPersona: trace.selectedInputs.hasUserPersona,
      hasGmDirective: trace.selectedInputs.hasGmDirective,
    },
    rationale: {
      avatarProjection: [...trace.rationale.avatarProjection],
      gmProjection: [...trace.rationale.gmProjection],
    },
    selection: {
      kept: trace.selection.kept.slice(0, MAX_TRACE_SEGMENTS).map((entry) => ({
        projection: entry.projection,
        segmentId: entry.segmentId,
        tokenEstimate: entry.tokenEstimate,
        reason: entry.reason,
      })),
      trimmed: trace.selection.trimmed.slice(0, MAX_TRACE_SEGMENTS).map((entry) => ({
        projection: entry.projection,
        segmentId: entry.segmentId,
        tokenEstimate: entry.tokenEstimate,
        reason: entry.reason,
      })),
    },
  }
}
