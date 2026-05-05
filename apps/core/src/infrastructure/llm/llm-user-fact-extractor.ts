import type { ILlmAdapter } from '../../application/ports/ILlmAdapter.js'
import type {
  ExtractedFact,
  ExtractUserFactsInput,
  IUserFactExtractor,
} from '../../application/ports/IUserFactExtractor.js'

const MAX_FACTS = 5
const MAX_MESSAGES = 20
const ALLOWED_CATEGORIES = new Set(['preference', 'constraint', 'goal', 'identity', 'context'])

const FACT_EXTRACTION_SYSTEM_PROMPT = `You extract durable user facts from a conversation.

Rules:
- Identify 0-5 durable facts about the user only.
- Never extract facts about the avatar or scenario.
- Ground every fact in the provided conversation. Do not invent.
- If no durable facts exist, return [].
- Return JSON only: an array of objects with fields { category, key, value, confidence? }.
- category must be one of: preference, constraint, goal, identity, context.
- key must be compact lowercase snake_case.
- value must be a concise string.
- confidence is optional and should be a number between 0 and 1.`

export class LlmUserFactExtractor implements IUserFactExtractor {
  constructor(private readonly llm: ILlmAdapter) {}

  async extract(input: ExtractUserFactsInput): Promise<ExtractedFact[]> {
    try {
      const response = await this.llm.complete({
        systemPrompt: FACT_EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: this.buildTranscript(input) }],
        maxTokens: 400,
      })
      return this.parseFacts(response.content)
    } catch (error) {
      safeWarn('[user-fact-extractor] LLM extraction failed:', error)
      return []
    }
  }

  private buildTranscript(input: ExtractUserFactsInput): string {
    const lines = input.messages
      .slice(-MAX_MESSAGES)
      .map((message) => `${message.role}: ${message.content.trim()}`)
      .join('\n')

    return `userId: ${input.userId}
conversationId: ${input.conversationId}
conversation:
${lines}`
  }

  private parseFacts(content: string): ExtractedFact[] {
    const cleaned = stripMarkdownFences(content)
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch (error) {
      safeWarn('[user-fact-extractor] Could not parse JSON response:', error)
      return []
    }

    if (!Array.isArray(parsed)) return []

    const facts: ExtractedFact[] = []
    for (const item of parsed) {
      const fact = toExtractedFact(item)
      if (fact === null) continue
      facts.push(fact)
      if (facts.length >= MAX_FACTS) break
    }
    return facts
  }
}

function stripMarkdownFences(content: string): string {
  const trimmed = content.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match?.[1]?.trim() ?? trimmed
}

function toExtractedFact(value: unknown): ExtractedFact | null {
  if (!isRecord(value)) return null
  const category = readString(value['category'])
  const key = readString(value['key'])
  const factValue = readString(value['value'])
  if (category === null || key === null || factValue === null) return null
  if (!ALLOWED_CATEGORIES.has(category)) return null

  const confidenceRaw = value['confidence']
  const confidence =
    typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
      ? clamp(confidenceRaw, 0, 1)
      : undefined

  return {
    category,
    key,
    value: factValue,
    ...(confidence === undefined ? {} : { confidence }),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length === 0 ? null : normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeWarn(message: string, error: unknown): void {
  try {
    console.warn(message, error)
  } catch {
    // Never let diagnostic logging break extraction flow.
  }
}
