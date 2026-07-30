import type { TokenCostEstimate } from './contracts.js'

type PublicPricing = {
  inputUsdPerMillionTokens: number
  outputUsdPerMillionTokens: number
  source: string
}

const PRICING_AS_OF = '2026-07-30'
const PRICING: Record<string, PublicPricing> = {
  'openai/gpt-5.5': {
    inputUsdPerMillionTokens: 5,
    outputUsdPerMillionTokens: 30,
    source: 'https://developers.openai.com/api/docs/models/gpt-5.5',
  },
  'openai/gpt-5.4': {
    inputUsdPerMillionTokens: 2.5,
    outputUsdPerMillionTokens: 15,
    source: 'https://developers.openai.com/api/docs/models/gpt-5.4',
  },
  'openai/gpt-4o': {
    inputUsdPerMillionTokens: 2.5,
    outputUsdPerMillionTokens: 10,
    source: 'https://developers.openai.com/api/docs/models/gpt-4o',
  },
  'openai/gpt-4o-mini': {
    inputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 0.6,
    source: 'https://developers.openai.com/api/docs/models/gpt-4o-mini',
  },
  'openai/gpt-5.4-mini': {
    inputUsdPerMillionTokens: 0.75,
    outputUsdPerMillionTokens: 4.5,
    source: 'https://developers.openai.com/api/docs/models/gpt-5.4-mini',
  },
  'openai/gpt-5.4-nano': {
    inputUsdPerMillionTokens: 0.2,
    outputUsdPerMillionTokens: 1.25,
    source: 'https://developers.openai.com/api/docs/models/gpt-5.4-nano',
  },
  'anthropic/claude-opus-4-7': {
    inputUsdPerMillionTokens: 5,
    outputUsdPerMillionTokens: 25,
    source: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
  },
  'anthropic/claude-sonnet-4-6': {
    inputUsdPerMillionTokens: 3,
    outputUsdPerMillionTokens: 15,
    source: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
  },
  'anthropic/claude-haiku-4-5': {
    inputUsdPerMillionTokens: 1,
    outputUsdPerMillionTokens: 5,
    source: 'https://docs.anthropic.com/en/docs/about-claude/pricing',
  },
  'mistral/mistral-medium-3.5': {
    inputUsdPerMillionTokens: 1.5,
    outputUsdPerMillionTokens: 7.5,
    source: 'https://mistral.ai/pricing/api/',
  },
  'mistral/mistral-small-4': {
    inputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 0.6,
    source: 'https://mistral.ai/pricing/api/',
  },
  'mistral/mistral-large-3': {
    inputUsdPerMillionTokens: 0.5,
    outputUsdPerMillionTokens: 1.5,
    source: 'https://mistral.ai/pricing/api/',
  },
  'mistral/ministral-3b': {
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.1,
    source: 'https://mistral.ai/pricing/api/',
  },
  'xai/grok-4.3': {
    inputUsdPerMillionTokens: 1.25,
    outputUsdPerMillionTokens: 2.5,
    source: 'https://docs.x.ai/developers/models/grok-4.3',
  },
  'xai/grok-build-0.1': {
    inputUsdPerMillionTokens: 1,
    outputUsdPerMillionTokens: 2,
    source: 'https://docs.x.ai/developers/pricing',
  },
}

const ALIASES: Record<string, string> = {
  'openai/gpt-4o-mini-2024-07-18': 'openai/gpt-4o-mini',
  'anthropic/claude-haiku-4-5-20251001': 'anthropic/claude-haiku-4-5',
  'mistral/mistral-medium-3-5': 'mistral/mistral-medium-3.5',
  'xai/grok-4.3-latest': 'xai/grok-4.3',
}

function normalizeModel(model: string): string {
  const normalized = model.trim().toLowerCase()
  return ALIASES[normalized] ?? normalized
}

function resolvePricingKey(model: string, providerHint?: string): string | undefined {
  const normalized = normalizeModel(model)
  if (PRICING[normalized] !== undefined) return normalized
  if (providerHint !== undefined) {
    const hinted = normalizeModel(`${providerHint}/${model}`)
    if (PRICING[hinted] !== undefined) return hinted
  }
  const matches = Object.keys(PRICING).filter((key) => key.endsWith(`/${normalized}`))
  return matches.length === 1 ? matches[0] : undefined
}

export function estimateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): TokenCostEstimate | null {
  const [provider, modelName] = model.split('/', 2)
  const key = resolvePricingKey(modelName ?? model, provider)
  if (key === undefined) return null
  const pricing = PRICING[key]
  if (pricing === undefined) return null
  const inputCostUsd = (inputTokens / 1_000_000) * pricing.inputUsdPerMillionTokens
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputUsdPerMillionTokens
  return {
    model: key,
    inputTokens,
    outputTokens,
    inputPriceUsdPerMillionTokens: pricing.inputUsdPerMillionTokens,
    outputPriceUsdPerMillionTokens: pricing.outputUsdPerMillionTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
    pricingSource: pricing.source,
    pricingAsOf: PRICING_AS_OF,
  }
}
