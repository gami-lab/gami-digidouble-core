import type { AvatarRequestOptions, ConversationSummary, SessionSummary } from '@gami/shared'

/** A model label declared by a definition and requested from the selected LLM provider. */
export type DeclaredModel = string

export type EvaluationPhase =
  | 'avatar_resolution'
  | 'session_bootstrap'
  | 'conversation_bootstrap'
  | 'avatar_message'
  | 'judge_exchange'
  | 'runtime_usage'
  | 'report_persistence'

export type TestQuestion = {
  question: string
  expectedResponse: string
  requiredFacts?: string[]
  acceptedAlternatives?: string[]
  forbiddenClaims?: string[]
}

export type TestDefinition = {
  version: 1
  name: string
  scenarioId: string
  initialAvatarId?: string
  initialAvatarName?: string
  model?: DeclaredModel
  models?: DeclaredModel[]
  judgeModel?: DeclaredModel
  avatarOptions?: AvatarRequestOptions
  questions: TestQuestion[]
}

/** Metrics retained by the evaluator after normalizing API optionality. */
export type EvaluationMetrics = {
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number | null
}

export type JudgeMetrics = {
  model: string
  latencyMs: number
}

export type JudgeResult = {
  passed: boolean
  score: 1 | 2 | 3 | 4 | 5
  reason: string
  missingElements: string[]
  contradictions: string[]
}

export type QualityOutcome = 'passed' | 'partial' | 'failed'

export type HumanReview = {
  status: QualityOutcome
  originalStatus: QualityOutcome
  reviewedAt: string
}

export type EvaluationError = {
  kind: 'api_error' | 'judge_error'
  message: string
  phase?: EvaluationPhase
  code?: string
  status?: number
}

export type ModelMismatch = {
  role: 'avatar' | 'judge'
  questionNumber: number
  declaredModel: string
  observedModel: string
}

export type QuestionResultStatus = 'completed' | 'api_error' | 'judge_error' | QualityOutcome

export type QuestionResult = {
  questionNumber: number
  question: string
  expectedResponse: string
  requiredFacts?: string[]
  acceptedAlternatives?: string[]
  forbiddenClaims?: string[]
  actualResponse: string | null
  sessionId: string | null
  conversationId: string | null
  avatarId: string | null
  metrics: EvaluationMetrics | null
  judgeModel: string | null
  judgeMetrics: JudgeMetrics | null
  judge: JudgeResult | null
  humanReview?: HumanReview
  status: QuestionResultStatus
  error: EvaluationError | null
}

export type RunReportStatus = 'completed' | 'api_error' | 'judge_error'

export type RunSummary = {
  questions: number
  evaluated: number
  passed: number
  partial: number
  failed: number
  passRate: number | null
  totalLatencyMs: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: number | null
  totalRunInputTokens: number
  totalRunOutputTokens: number
  totalRunTokens: number
  totalJudgeLatencyMs: number
  gameMasterUsage: RuntimeRoleUsage
  memoryUsage: RuntimeRoleUsage
  runtimeUsageStatus: RuntimeUsageStatus
  observedAvatarModels: string[]
  observedJudgeModels: string[]
}

export type RuntimeUsageStatus = 'pending' | 'complete' | 'unavailable'

export type RuntimeRoleUsage = {
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  observedModels: string[]
}

export type RunReport = {
  version: 1
  testName: string
  scenarioId: string
  declaredModel: DeclaredModel | null
  declaredJudgeModel: DeclaredModel | null
  status: RunReportStatus
  sessionId: string | null
  conversationId: string | null
  startedAt: string
  finishedAt: string | null
  questions: QuestionResult[]
  summary: RunSummary
  modelMismatches: ModelMismatch[]
  error: EvaluationError | null
  costEstimate: RunCostEstimate
}

export type TokenCostEstimate = {
  model: string
  inputTokens: number
  outputTokens: number
  inputPriceUsdPerMillionTokens: number
  outputPriceUsdPerMillionTokens: number
  inputCostUsd: number
  outputCostUsd: number
  totalCostUsd: number
  pricingSource: string
  pricingAsOf: string
}

export type RunCostEstimate = {
  avatar: TokenCostEstimate | null
  gameMaster: TokenCostEstimate | null
  memory: TokenCostEstimate | null
  totalCostUsd: number | null
  unavailableModels: string[]
}

export type ModelComparisonRun = {
  model: DeclaredModel
  /** Stable identity for repeated selectors; omitted on legacy single-run entries. */
  runKey?: string
  reportPath: string
  report: RunReport
}

export type ModelComparisonReport = {
  version: 1
  reportType: 'model_comparison'
  testName: string
  scenarioId: string
  generatedAt: string
  runs: ModelComparisonRun[]
}

/**
 * The low-level result returned by the sequential Avatar runner.
 *
 * It intentionally contains no judge output or persisted report concerns. Prompt 03 can map
 * these records into a RunReport after applying semantic judging and aggregation.
 */
export type ConversationExecution = {
  status: 'completed' | 'api_error'
  scenarioId: string
  declaredModel: DeclaredModel | null
  session: SessionSummary
  conversation: ConversationSummary
  sessionId: string
  conversationId: string
  avatarId: string
  results: QuestionResult[]
  observedAvatarModels: string[]
  modelMismatches: Array<{
    questionNumber: number
    declaredModel: string
    observedModel: string
  }>
}
