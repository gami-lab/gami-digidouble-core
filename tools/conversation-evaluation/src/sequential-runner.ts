import type { SendMessageResponse } from '@gami/shared'

import type {
  ConversationExecution,
  EvaluationError,
  QuestionResult,
  TestDefinition,
} from './contracts.js'
import { normalizeMetrics } from './metrics.js'
import { CoreApiClient, CoreApiError, type CoreApiRequestOptions } from './core-api-client.js'

export type SequentialRunnerInput = {
  definition: TestDefinition
  userId: string
  signal?: AbortSignal
  onResult?: (result: QuestionResult) => Promise<void> | void
}

function normalizeAvatarName(name: string): string {
  return name.trim().toLowerCase()
}

function requestOptions(signal: AbortSignal | undefined): CoreApiRequestOptions {
  return signal === undefined ? {} : { signal }
}

function toEvaluationError(error: unknown): EvaluationError {
  if (error instanceof CoreApiError) {
    return {
      kind: 'api_error',
      message: error.safeMessage,
      code: error.code,
      ...(error.status !== null ? { status: error.status } : {}),
    }
  }

  return {
    kind: 'api_error',
    message: 'Core API request failed.',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMessageResponse(value: unknown): value is SendMessageResponse {
  if (!isRecord(value)) return false
  const session = value['session']
  const conversation = value['conversation']
  const avatarMessage = value['avatarMessage']
  if (!isRecord(session) || !isRecord(conversation) || !isRecord(avatarMessage)) return false
  const metadata = avatarMessage['metadata']
  return (
    isRecord(metadata) &&
    typeof session['sessionId'] === 'string' &&
    typeof conversation['sessionId'] === 'string' &&
    typeof conversation['conversationId'] === 'string' &&
    typeof avatarMessage['conversationId'] === 'string'
  )
}

function assertMessageResponseIdentity(
  response: unknown,
  sessionId: string,
  conversationId: string,
): asserts response is SendMessageResponse {
  if (
    !isMessageResponse(response) ||
    response.session.sessionId !== sessionId ||
    response.conversation.sessionId !== sessionId ||
    response.conversation.conversationId !== conversationId ||
    response.avatarMessage.conversationId !== conversationId
  ) {
    throw new CoreApiError({
      status: null,
      code: 'INVALID_RESPONSE',
      message: 'Core API returned mismatched conversation identity.',
      path: `/v1/conversations/${conversationId}/messages`,
      kind: 'contract_error',
    })
  }
}

function assertMessageResponseMetrics(response: SendMessageResponse): void {
  const metadata = response.avatarMessage.metadata
  if (
    typeof response.avatarMessage.content !== 'string' ||
    typeof metadata.model !== 'string' ||
    !Number.isFinite(metadata.latencyMs) ||
    !Number.isFinite(metadata.inputTokens) ||
    !Number.isFinite(metadata.outputTokens) ||
    (metadata.totalTokens !== undefined && !Number.isFinite(metadata.totalTokens)) ||
    (metadata.costUsd !== undefined && !Number.isFinite(metadata.costUsd))
  ) {
    throw new CoreApiError({
      status: null,
      code: 'INVALID_RESPONSE',
      message: 'Core API returned incomplete Avatar response metadata.',
      path: '/v1/conversations/messages',
      kind: 'contract_error',
    })
  }
}

function createQuestionResult(
  definition: TestDefinition,
  questionNumber: number,
  sessionId: string,
  conversationId: string,
  avatarId: string,
): QuestionResult {
  const question = definition.questions[questionNumber - 1]
  if (question === undefined) throw new Error('Question number is outside the definition.')

  return {
    questionNumber,
    question: question.question,
    expectedResponse: question.expectedResponse,
    actualResponse: null,
    sessionId,
    conversationId,
    avatarId,
    metrics: null,
    judgeModel: null,
    judge: null,
    status: 'api_error',
    error: null,
  }
}

export async function resolveInitialAvatarId(
  client: CoreApiClient,
  definition: TestDefinition,
  signal?: AbortSignal,
): Promise<string> {
  if (definition.initialAvatarId !== undefined) return definition.initialAvatarId

  const avatarName = definition.initialAvatarName
  if (avatarName === undefined) {
    throw new Error('Definition must provide an initial Avatar selector.')
  }

  const response = await client.listScenarioAvatars(definition.scenarioId, requestOptions(signal))
  const matches = response.avatars.filter(
    (avatar) => normalizeAvatarName(avatar.name) === normalizeAvatarName(avatarName),
  )
  if (matches.length === 0) {
    throw new CoreApiError({
      status: 404,
      code: 'NOT_FOUND',
      message: `No Avatar matched the configured initial Avatar name.`,
      path: `/v1/scenarios/${definition.scenarioId}/avatars`,
      kind: 'api_error',
    })
  }
  if (matches.length !== 1) {
    throw new CoreApiError({
      status: 409,
      code: 'CONFLICT',
      message: 'The configured initial Avatar name matched multiple Avatars.',
      path: `/v1/scenarios/${definition.scenarioId}/avatars`,
      kind: 'api_error',
    })
  }

  const match = matches[0]
  if (match === undefined) {
    throw new CoreApiError({
      status: 404,
      code: 'NOT_FOUND',
      message: 'No Avatar matched the configured initial Avatar name.',
      path: `/v1/scenarios/${definition.scenarioId}/avatars`,
      kind: 'api_error',
    })
  }
  return match.avatarId
}

export async function runSequentialConversation(
  client: CoreApiClient,
  input: SequentialRunnerInput,
): Promise<ConversationExecution> {
  const { definition, userId } = input
  const avatarId = await resolveInitialAvatarId(client, definition, input.signal)
  const sessionResponse = await client.createSession(
    {
      userId,
      scenarioId: definition.scenarioId,
    },
    requestOptions(input.signal),
  )
  const sessionId = sessionResponse.session.sessionId
  const conversationResponse = await client.startConversation(
    sessionId,
    { avatarId },
    requestOptions(input.signal),
  )
  const conversationId = conversationResponse.conversation.conversationId
  const results: QuestionResult[] = []
  const observedAvatarModels: string[] = []
  const modelMismatches: ConversationExecution['modelMismatches'] = []

  for (let index = 0; index < definition.questions.length; index += 1) {
    const questionNumber = index + 1
    const question = definition.questions[index]
    if (question === undefined) continue
    const result = createQuestionResult(
      definition,
      questionNumber,
      sessionId,
      conversationId,
      avatarId,
    )

    let shouldStop = false
    try {
      const response = await client.sendMessage(
        conversationId,
        question.question,
        requestOptions(input.signal),
      )
      assertMessageResponseIdentity(response, sessionId, conversationId)
      assertMessageResponseMetrics(response)
      const metadata = response.avatarMessage.metadata
      result.actualResponse = response.avatarMessage.content
      result.metrics = normalizeMetrics(metadata)
      result.status = 'completed'
      result.error = null
      observedAvatarModels.push(metadata.model)
      if (definition.model !== undefined && definition.model !== metadata.model) {
        modelMismatches.push({
          questionNumber,
          declaredModel: definition.model,
          observedModel: metadata.model,
        })
      }
    } catch (error: unknown) {
      result.status = 'api_error'
      result.error = toEvaluationError(error)
      shouldStop = true
      // A failed/timed-out JSON request may have been committed by Core. Stopping avoids sending
      // the next scripted question into an unknown conversation state or duplicating a turn.
    }

    if (input.onResult !== undefined) await input.onResult(result)

    results.push(result)
    if (shouldStop) break
  }

  return {
    status: results.some((result) => result.status === 'api_error') ? 'api_error' : 'completed',
    scenarioId: definition.scenarioId,
    declaredModel: definition.model ?? null,
    session: sessionResponse.session,
    conversation: conversationResponse.conversation,
    sessionId,
    conversationId,
    avatarId,
    results,
    observedAvatarModels: [...new Set(observedAvatarModels)],
    modelMismatches,
  }
}

export class SequentialConversationRunner {
  constructor(private readonly client: CoreApiClient) {}

  run(input: SequentialRunnerInput): Promise<ConversationExecution> {
    return runSequentialConversation(this.client, input)
  }
}
