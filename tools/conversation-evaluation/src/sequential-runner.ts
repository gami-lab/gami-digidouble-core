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
  onProgress?: (message: string) => void
  interQuestionDelayMs?: number
  waitBetweenQuestions?: (durationMs: number, signal?: AbortSignal) => Promise<void>
}

function normalizeAvatarName(name: string): string {
  return name.trim().toLowerCase()
}

function requestOptions(signal: AbortSignal | undefined): CoreApiRequestOptions {
  return signal === undefined ? {} : { signal }
}

function reportProgress(input: SequentialRunnerInput, message: string): void {
  input.onProgress?.(message)
}

function toEvaluationError(error: unknown): EvaluationError {
  if (error instanceof CoreApiError) {
    return {
      kind: 'api_error',
      message: error.safeMessage,
      ...(error.phase !== undefined ? { phase: error.phase } : {}),
      code: error.code,
      ...(error.status !== null ? { status: error.status } : {}),
    }
  }

  return {
    kind: 'api_error',
    message: 'Core API request failed.',
  }
}

function assertMessageResponseIdentity(
  response: SendMessageResponse,
  sessionId: string,
  conversationId: string,
): void {
  if (
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
      phase: 'avatar_message',
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
    judgeMetrics: null,
    judge: null,
    status: 'api_error',
    error: null,
  }
}

async function waitBeforeNextQuestion(
  input: SequentialRunnerInput,
  index: number,
  questionCount: number,
): Promise<void> {
  if (input.interQuestionDelayMs === undefined || index >= questionCount - 1) return
  const delaySeconds = input.interQuestionDelayMs / 1000
  reportProgress(
    input,
    `Waiting ${String(delaySeconds)} seconds for async runtime work before the next question.`,
  )
  await input.waitBetweenQuestions?.(input.interQuestionDelayMs, input.signal)
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
      phase: 'avatar_resolution',
    })
  }
  if (matches.length !== 1) {
    throw new CoreApiError({
      status: 409,
      code: 'CONFLICT',
      message: 'The configured initial Avatar name matched multiple Avatars.',
      path: `/v1/scenarios/${definition.scenarioId}/avatars`,
      kind: 'api_error',
      phase: 'avatar_resolution',
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
      phase: 'avatar_resolution',
    })
  }
  return match.avatarId
}

export async function runSequentialConversation(
  client: CoreApiClient,
  input: SequentialRunnerInput,
): Promise<ConversationExecution> {
  const { definition, userId } = input
  reportProgress(input, 'Resolving initial Avatar.')
  const avatarId = await resolveInitialAvatarId(client, definition, input.signal)
  reportProgress(input, 'Creating evaluation session.')
  const sessionResponse = await client.createSession(
    {
      userId,
      scenarioId: definition.scenarioId,
    },
    requestOptions(input.signal),
  )
  const sessionId = sessionResponse.session.sessionId
  reportProgress(input, 'Starting evaluation conversation.')
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
    reportProgress(
      input,
      `Question ${String(questionNumber)}/${String(definition.questions.length)}: sending Avatar request.`,
    )

    let shouldStop = false
    try {
      const response = await client.sendMessage(
        conversationId,
        question.question,
        requestOptions(input.signal),
      )
      assertMessageResponseIdentity(response, sessionId, conversationId)
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
    await waitBeforeNextQuestion(input, index, definition.questions.length)
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
