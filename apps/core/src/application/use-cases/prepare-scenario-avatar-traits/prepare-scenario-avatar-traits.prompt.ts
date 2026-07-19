import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'

export const TRAIT_PREPARATION_SYSTEM_PROMPT = `You compute a fixed set of structured traits for one avatar from its authored source material.

Return JSON only, with exactly this shape:
{
  "identity": string[],
  "personality": string[],
  "speakingStyle": string[],
  "background": string[],
  "timeline": string[],
  "currentSituation": string[],
  "behaviouralRules": string[]
}

Field meanings:
- identity: stable core facts (name, role, position, defining identity markers). Not general world knowledge unless it directly defines the avatar.
- personality: how the avatar thinks, feels, decides, reacts — dominant traits, motivations, fears, emotional tendencies.
- speakingStyle: tone, vocabulary level, sentence length, rhythm, directness, recurring verbal habits.
- background: relevant biography and past experiences that explain how the avatar behaves.
- timeline: every distinct notable past event, in chronological order, plus the current point in time and explicit future expectations. One item per event — do not merge several events into one line.
- currentSituation: current objective, emotional state, constraints, relationship to the scenario, what the avatar knows now. Do not duplicate the whole world context.
- behaviouralRules: explicit boundaries, required/forbidden behaviours, interaction rules — preserve administrator intent directly.

Rules:
- Use the AVATAR DESCRIPTION as the primary source.
- Use MEMORY DOCUMENTS only when they clarify the avatar.
- Use WORLD CONTEXT only to avoid contradictions and remove redundancy — never copy generic world facts into avatar traits.
- Never invent details that are not supported by the provided sources.
- Preserve intentional ambiguity and meaningful contradictions from the authored character; do not force invented specificity.
- identity, personality, speakingStyle, background, currentSituation, and behaviouralRules must each contain at most 5-7 concise items. Return [] for a field with no strong signal.
- timeline has no fixed item cap: include one item per distinct notable event described in the sources, in chronological order. Do not compress multiple important events into a single summarized item, and never drop critical events (deaths, discoveries, confrontations, turning points) just to keep the list short.
- Generate the same fixed structure for every avatar. Do not add extra fields.`

/**
 * Builds the per-avatar user message from canonical existing storage only:
 * avatar author fields, `scenario.worldContext`, and `knowledge_sources`
 * (`memory` / `world`) inline text. No new storage or loader path is introduced.
 */
export function buildTraitPreparationUserMessage(args: {
  avatar: AvatarConfig
  scenario: Scenario
  memorySources: KnowledgeSource[]
  worldSources: KnowledgeSource[]
}): string {
  const parts: string[] = [buildAvatarDescriptionBlock(args.avatar)]

  const memoryText = joinInlineText(args.memorySources)
  if (memoryText !== null) {
    parts.push(`--- MEMORY DOCUMENTS ---\n${memoryText}`)
  }

  const worldText = buildWorldContextBlock(args.scenario, args.worldSources)
  if (worldText !== null) {
    parts.push(worldText)
  }

  return parts.join('\n\n')
}

function buildAvatarDescriptionBlock(avatar: AvatarConfig): string {
  const lines = [
    '--- AVATAR DESCRIPTION ---',
    `Name: ${avatar.name}`,
    ...(avatar.tone !== undefined ? [`Tone: ${avatar.tone}`] : []),
    ...(avatar.description !== undefined ? [`Description: ${avatar.description}`] : []),
    `Persona prompt: ${avatar.personaPrompt}`,
    ...(avatar.adjustments !== undefined && avatar.adjustments.length > 0
      ? [`Adjustments: ${avatar.adjustments.join('; ')}`]
      : []),
  ]
  return lines.join('\n')
}

function buildWorldContextBlock(
  scenario: Scenario,
  worldSources: KnowledgeSource[],
): string | null {
  const worldContext = scenario.worldContext.trim()
  const worldText = joinInlineText(worldSources)
  if (worldContext.length === 0 && worldText === null) return null

  const lines = ['--- WORLD CONTEXT ---']
  if (worldContext.length > 0) lines.push(worldContext)
  if (worldText !== null) lines.push(worldText)
  return lines.join('\n')
}

/**
 * Joins preserved inline text from knowledge sources. Sources without
 * `metadata.inlineText` are skipped — preparation operates on original
 * source text, not retrieval chunks, and Phase A has no other loader path.
 */
function joinInlineText(sources: KnowledgeSource[]): string | null {
  const texts = sources
    .map((source) => readInlineText(source))
    .filter((text): text is string => text !== null)

  return texts.length > 0 ? texts.join('\n\n') : null
}

function readInlineText(source: KnowledgeSource): string | null {
  const inlineText = source.metadata?.['inlineText']
  if (typeof inlineText !== 'string') return null
  const trimmed = inlineText.trim()
  return trimmed.length > 0 ? `[${source.name}]\n${trimmed}` : null
}
