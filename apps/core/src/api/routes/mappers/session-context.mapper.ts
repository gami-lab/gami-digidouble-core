import type { AdminSessionContextResponse } from '@gami/shared'
import type { SessionContextSnapshot } from '../../../domain/context/session-context.types.js'
import { toRetrievalTraceDto } from '../../../application/services/runtime-inspector-event-context.js'

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
          ...(snapshot.avatarContext.sections.conversationState.workingMemory.conversation !==
          undefined
            ? {
                conversation: {
                  ...snapshot.avatarContext.sections.conversationState.workingMemory.conversation,
                  unresolvedThreads: [
                    ...snapshot.avatarContext.sections.conversationState.workingMemory.conversation
                      .unresolvedThreads,
                  ],
                  coveredTopics: [
                    ...snapshot.avatarContext.sections.conversationState.workingMemory.conversation
                      .coveredTopics,
                  ],
                  selectionReasons: [
                    ...snapshot.avatarContext.sections.conversationState.workingMemory.conversation
                      .selectionReasons,
                  ],
                },
              }
            : {}),
        },
        episodicMemories: snapshot.avatarContext.sections.conversationState.episodicMemories.map(
          (memory) => ({
            ...memory,
            keyDiscoveries: [...memory.keyDiscoveries],
            unresolvedTopics: [...memory.unresolvedTopics],
            selectionReasons: [...memory.selectionReasons],
          }),
        ),
        longTermFacts: snapshot.avatarContext.sections.conversationState.longTermFacts.map(
          (fact) => ({ ...fact }),
        ),
      },
      userPersona: snapshot.avatarContext.sections.userPersona,
      worldContext: snapshot.avatarContext.sections.worldContext,
      ...(snapshot.avatarContext.sections.retrievedContext !== undefined
        ? {
            retrievedContext: toSharedAvatarRetrievedContext(
              snapshot.avatarContext.sections.retrievedContext,
            ),
          }
        : {}),
      ...(snapshot.avatarContext.sections.avatarTraits !== undefined
        ? { avatarTraits: snapshot.avatarContext.sections.avatarTraits }
        : {}),
    },
  }
}

function toGmContext(snapshot: SessionContextSnapshot): AdminSessionContextResponse['gmContext'] {
  return {
    currentState: {
      progression: snapshot.gmContext.currentState.progression,
      interactionCount: snapshot.gmContext.currentState.interactionCount,
    },
    availableAvatars: snapshot.gmContext.availableAvatars.map((avatar) => ({ ...avatar })),
    sections: {
      conversationState: {
        recentMessages: snapshot.gmContext.sections.conversationState.recentMessages.map(
          (message) => ({ ...message }),
        ),
        recentExchanges: snapshot.gmContext.sections.conversationState.recentExchanges.map(
          (exchange) => ({ ...exchange }),
        ),
        ...(snapshot.gmContext.sections.conversationState.workingMemory !== undefined
          ? {
              workingMemory: {
                ...snapshot.gmContext.sections.conversationState.workingMemory,
                unresolvedThreads: [
                  ...snapshot.gmContext.sections.conversationState.workingMemory.unresolvedThreads,
                ],
                coveredTopics: [
                  ...snapshot.gmContext.sections.conversationState.workingMemory.coveredTopics,
                ],
              },
            }
          : {}),
        ...(snapshot.gmContext.sections.conversationState.workingSummary !== undefined
          ? {
              workingSummary: snapshot.gmContext.sections.conversationState.workingSummary,
            }
          : {}),
        episodicMemories: snapshot.gmContext.sections.conversationState.episodicMemories.map(
          (memory) => ({
            ...memory,
            keyDiscoveries: [...memory.keyDiscoveries],
            unresolvedTopics: [...memory.unresolvedTopics],
            selectionReasons: [...memory.selectionReasons],
          }),
        ),
        longTermFacts: snapshot.gmContext.sections.conversationState.longTermFacts.map((fact) => ({
          ...fact,
        })),
      },
      ...(snapshot.gmContext.sections.retrievedContext !== undefined
        ? {
            retrievedContext: toSharedGmRetrievedContext(
              snapshot.gmContext.sections.retrievedContext,
            ),
          }
        : {}),
      userPersona: snapshot.gmContext.sections.userPersona,
      worldContext: snapshot.gmContext.sections.worldContext,
    },
  }
}

function toSharedAvatarRetrievedContext(
  knowledge: NonNullable<SessionContextSnapshot['avatarContext']['sections']['retrievedContext']>,
) {
  const typedSections = knowledge.typedSections ?? {
    avatar_knowledge: knowledge.retrievedItems.filter(
      (item) => item.knowledgeType === 'avatar_knowledge',
    ),
    world: knowledge.retrievedItems.filter((item) => item.knowledgeType === 'world'),
    media: knowledge.retrievedItems.filter((item) => item.knowledgeType === 'media'),
  }
  return {
    retrievedItems: knowledge.retrievedItems.map((item) => ({ ...item })),
    typedSections: {
      avatar_knowledge: typedSections.avatar_knowledge.map((item) => ({ ...item })),
      world: typedSections.world.map((item) => ({ ...item })),
      media: typedSections.media.map((item) => ({ ...item })),
      ...(knowledge.trace !== undefined ? { trace: toRetrievalTraceDto(knowledge.trace) } : {}),
    },
  }
}

function toSharedGmRetrievedContext(
  knowledge: NonNullable<SessionContextSnapshot['gmContext']['sections']['retrievedContext']>,
) {
  return {
    avatar_knowledge: knowledge.avatar_knowledge.map((item) => ({ ...item })),
    world: knowledge.world.map((item) => ({ ...item })),
    media: knowledge.media.map((item) => ({ ...item })),
    ...(knowledge.trace !== undefined ? { trace: toRetrievalTraceDto(knowledge.trace) } : {}),
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
      ...(snapshot.contextTrace.selectedInputs.retrieval !== undefined
        ? { retrieval: toRetrievalTraceDto(snapshot.contextTrace.selectedInputs.retrieval) }
        : {}),
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
