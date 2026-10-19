/**
 * Player-facing presentation authored in admin and stored in the scenario/avatar `uiHints` config
 * section. Core orchestration (Avatar prompts, Game Master, retrieval) never reads it.
 *
 * `cover` and `portrait` hold an image URL; the field names deliberately describe the concept so
 * the value can later become a media reference without a rename.
 */

export const PRESENTATION_LIMITS = {
  imageUrlMaxLength: 2048,
  taglineMaxLength: 160,
  introTextMaxLength: 1200,
  entryQuestionMaxLength: 200,
  outroTextMaxLength: 1200,
  hookMaxLength: 160,
  starterQuestionMaxLength: 200,
  starterQuestionsMax: 3,
} as const

export const PRESENTATION_IMAGE_URL_PATTERN = '^https?://\\S+$'

/** Persona fields an entry question may fill; relationship and dialog guidance stay admin-only. */
export const ENTRY_QUESTION_PERSONA_FIELDS = ['name', 'roleInWorld'] as const

export type EntryQuestionPersonaField = (typeof ENTRY_QUESTION_PERSONA_FIELDS)[number]

export type ScenarioEntryQuestion = {
  prompt: string
  personaField: EntryQuestionPersonaField
}

export type ScenarioPresentation = {
  cover?: string
  tagline?: string
  introText?: string
  entryQuestion?: ScenarioEntryQuestion
  outroText?: string
}

export type AvatarPresentation = {
  portrait?: string
  hook?: string
  starterQuestions?: string[]
}

/** Create sends an object; update replaces the whole object, and `null` clears it. */
export type ScenarioPresentationUpdate = ScenarioPresentation | null
export type AvatarPresentationUpdate = AvatarPresentation | null

const SCENARIO_PRESENTATION_KEYS = ['cover', 'tagline', 'introText', 'entryQuestion', 'outroText']
const AVATAR_PRESENTATION_KEYS = ['portrait', 'hook', 'starterQuestions']

export function isScenarioPresentation(value: unknown): value is ScenarioPresentation {
  if (!isRecord(value) || !hasOnlyKeys(value, SCENARIO_PRESENTATION_KEYS)) return false
  return (
    isOptional(value['cover'], isImageUrl) &&
    isOptional(value['tagline'], (v) => isText(v, PRESENTATION_LIMITS.taglineMaxLength)) &&
    isOptional(value['introText'], (v) => isText(v, PRESENTATION_LIMITS.introTextMaxLength)) &&
    isOptional(value['entryQuestion'], isEntryQuestion) &&
    isOptional(value['outroText'], (v) => isText(v, PRESENTATION_LIMITS.outroTextMaxLength))
  )
}

export function isAvatarPresentation(value: unknown): value is AvatarPresentation {
  if (!isRecord(value) || !hasOnlyKeys(value, AVATAR_PRESENTATION_KEYS)) return false
  return (
    isOptional(value['portrait'], isImageUrl) &&
    isOptional(value['hook'], (v) => isText(v, PRESENTATION_LIMITS.hookMaxLength)) &&
    isOptional(value['starterQuestions'], isStarterQuestions)
  )
}

function isEntryQuestion(value: unknown): value is ScenarioEntryQuestion {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['prompt', 'personaField']) &&
    isText(value['prompt'], PRESENTATION_LIMITS.entryQuestionMaxLength) &&
    (ENTRY_QUESTION_PERSONA_FIELDS as readonly unknown[]).includes(value['personaField'])
  )
}

function isStarterQuestions(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= PRESENTATION_LIMITS.starterQuestionsMax &&
    value.every((question) => isText(question, PRESENTATION_LIMITS.starterQuestionMaxLength))
  )
}

function isImageUrl(value: unknown): value is string {
  return (
    isText(value, PRESENTATION_LIMITS.imageUrlMaxLength) &&
    new RegExp(PRESENTATION_IMAGE_URL_PATTERN).test(value)
  )
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function isOptional(value: unknown, guard: (value: unknown) => boolean): boolean {
  return value === undefined || guard(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
