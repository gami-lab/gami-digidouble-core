import type { AdminSessionContextResponse } from '@gami/shared'
import type { SessionContextSnapshot } from '../../../domain/context/session-context.types.js'

export function toAdminSessionContextResponse(
  snapshot: SessionContextSnapshot,
): AdminSessionContextResponse {
  return {
    sessionId: snapshot.sessionId,
    avatarContext: toAvatarContext(snapshot),
    gmContext: toGmContext(snapshot),
    contextTrace: toContextTrace(snapshot),
  }
}

function toAvatarContext(
  snapshot: SessionContextSnapshot,
): AdminSessionContextResponse['avatarContext'] {
  return {
    ...(snapshot.avatarContext.avatarId !== undefined
      ? { avatarId: snapshot.avatarContext.avatarId }
      : {}),
    sections: {
      directorNotes: snapshot.avatarContext.sections.directorNotes,
      responseRules: {
        items: [...snapshot.avatarContext.sections.responseRules.items],
      },
      conversationState: {
        recentExchanges: snapshot.avatarContext.sections.conversationState.recentExchanges.map(
          (exchange) => ({ ...exchange }),
        ),
        workingMemory: {
          ...(snapshot.avatarContext.sections.conversationState.workingMemory.session !== undefined
            ? {
                session: {
                  ...snapshot.avatarContext.sections.conversationState.workingMemory.session,
                },
              }
            : {}),
          ...(snapshot.avatarContext.sections.conversationState.workingMemory.avatar !== undefined
            ? {
                avatar: {
                  ...snapshot.avatarContext.sections.conversationState.workingMemory.avatar,
                },
              }
            : {}),
        },
        longTermFacts: snapshot.avatarContext.sections.conversationState.longTermFacts.map(
          (fact) => ({ ...fact }),
        ),
      },
      userPersona: snapshot.avatarContext.sections.userPersona,
      worldContext: snapshot.avatarContext.sections.worldContext,
      ...(snapshot.avatarContext.sections.avatarTraits !== undefined
        ? { avatarTraits: snapshot.avatarContext.sections.avatarTraits }
        : {}),
    },
  }
}

function toGmContext(snapshot: SessionContextSnapshot): AdminSessionContextResponse['gmContext'] {
  return {
    currentState: {
      ...snapshot.gmContext.currentState,
    },
    availableAvatars: snapshot.gmContext.availableAvatars.map((avatar) => ({ ...avatar })),
    sections: {
      conversationState: {
        recentMessages: snapshot.gmContext.sections.conversationState.recentMessages.map(
          (message) => ({ ...message }),
        ),
        memory: {
          ...(snapshot.gmContext.sections.conversationState.memory.shortTerm !== undefined
            ? {
                shortTerm: {
                  recentExchanges:
                    snapshot.gmContext.sections.conversationState.memory.shortTerm.recentExchanges.map(
                      (exchange) => ({ ...exchange }),
                    ),
                },
              }
            : {}),
          ...(snapshot.gmContext.sections.conversationState.memory.workingSummary !== undefined
            ? {
                workingSummary: snapshot.gmContext.sections.conversationState.memory.workingSummary,
              }
            : {}),
          ...(snapshot.gmContext.sections.conversationState.memory.longTermFacts !== undefined
            ? {
                longTermFacts:
                  snapshot.gmContext.sections.conversationState.memory.longTermFacts.map(
                    (fact) => ({
                      ...fact,
                    }),
                  ),
              }
            : {}),
        },
      },
      userPersona: snapshot.gmContext.sections.userPersona,
      worldContext: snapshot.gmContext.sections.worldContext,
    },
  }
}

function toContextTrace(
  snapshot: SessionContextSnapshot,
): AdminSessionContextResponse['contextTrace'] {
  return {
    ...snapshot.contextTrace,
    policy: {
      ...snapshot.contextTrace.policy,
      sectionPrecedence: [...snapshot.contextTrace.policy.sectionPrecedence],
      protectedSegments: [...snapshot.contextTrace.policy.protectedSegments],
      precedence: [...snapshot.contextTrace.policy.precedence],
    },
    selectedInputs: {
      ...snapshot.contextTrace.selectedInputs,
      retrievalCounts: { ...snapshot.contextTrace.selectedInputs.retrievalCounts },
      ...(snapshot.contextTrace.selectedInputs.visibility !== undefined
        ? {
            visibility: {
              ...snapshot.contextTrace.selectedInputs.visibility,
              excludedCounts: {
                ...snapshot.contextTrace.selectedInputs.visibility.excludedCounts,
              },
              ...(snapshot.contextTrace.selectedInputs.visibility.gmRetrievalCounts !== undefined
                ? {
                    gmRetrievalCounts: {
                      ...snapshot.contextTrace.selectedInputs.visibility.gmRetrievalCounts,
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
    rationale: {
      avatarProjection: [...snapshot.contextTrace.rationale.avatarProjection],
      gmProjection: [...snapshot.contextTrace.rationale.gmProjection],
    },
    selection: {
      kept: snapshot.contextTrace.selection.kept.map((item) => ({ ...item })),
      trimmed: snapshot.contextTrace.selection.trimmed.map((item) => ({ ...item })),
    },
  }
}
