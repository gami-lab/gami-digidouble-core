/** A model label declared by a definition for comparison, never a request override. */
export type DeclaredModel = string

export type TestQuestion = {
  question: string
  expectedResponse: string
}

export type TestDefinition = {
  version: 1
  name: string
  scenarioId: string
  initialAvatarId?: string
  initialAvatarName?: string
  model?: DeclaredModel
  judgeModel?: DeclaredModel
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

export type JudgeResult = {
  passed: boolean
  score: 1 | 2 | 3 | 4 | 5
  reason: string
  missingElements: string[]
  contradictions: string[]
}

export type EvaluationError = {
  kind: 'api_error' | 'judge_error'
  message: string
  code?: string
}

export type QuestionResultStatus = 'api_error' | 'judge_error' | 'passed' | 'failed'

export type QuestionResult = {
  questionNumber: number
  question: string
  expectedResponse: string
  actualResponse: string | null
  sessionId: string | null
  conversationId: string | null
  avatarId: string | null
  metrics: EvaluationMetrics | null
  judgeModel: string | null
  judge: JudgeResult | null
  status: QuestionResultStatus
  error: EvaluationError | null
}

export type RunReportStatus = 'completed' | 'api_error' | 'judge_error'

export type RunSummary = {
  questions: number
  evaluated: number
  passed: number
  failed: number
  passRate: number | null
  totalLatencyMs: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: number | null
  observedAvatarModels: string[]
  observedJudgeModels: string[]
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
}
