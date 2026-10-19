import {
  isMediaRef,
  type MediaKind,
  type MediaRef,
  type PublicMediaAsset,
} from './media-contract-types.js'

/**
 * Player-facing presentation authored in admin and stored in the scenario/avatar `uiHints` config
 * section. Core orchestration (Avatar prompts, Game Master, retrieval) never reads it.
 *
 * Media slots hold a `MediaRef`; public projections resolve them to `PublicMediaAsset`.
 */

export const PRESENTATION_LIMITS = {
  taglineMaxLength: 160,
  introTextMaxLength: 1200,
  entryQuestionMaxLength: 200,
  outroTextMaxLength: 1200,
  hookMaxLength: 160,
  starterQuestionMaxLength: 200,
  starterQuestionsMax: 3,
} as const

/** Persona fields an entry question may fill; relationship and dialog guidance stay admin-only. */
export const ENTRY_QUESTION_PERSONA_FIELDS = ['name', 'roleInWorld'] as const

export type EntryQuestionPersonaField = (typeof ENTRY_QUESTION_PERSONA_FIELDS)[number]

export type ScenarioEntryQuestion = {
  prompt: string
  personaField: EntryQuestionPersonaField
}

export type ScenarioPresentation = {
  cover?: MediaRef
  tagline?: string
  introText?: string
  introMedia?: MediaRef
  entryQuestion?: ScenarioEntryQuestion
  outroText?: string
  outroMedia?: MediaRef
}

export type AvatarPresentation = {
  portrait?: MediaRef
  idleLoop?: MediaRef
  hook?: string
  starterQuestions?: string[]
}

/** The asset kinds each presentation media slot accepts. */
export const SCENARIO_PRESENTATION_MEDIA_SLOTS = {
  cover: ['image'],
  introMedia: ['image', 'video'],
  outroMedia: ['image', 'video'],
} as const satisfies Record<string, readonly MediaKind[]>

export const AVATAR_PRESENTATION_MEDIA_SLOTS = {
  portrait: ['image'],
  idleLoop: ['video'],
} as const satisfies Record<string, readonly MediaKind[]>

export type ScenarioPresentationMediaSlot = keyof typeof SCENARIO_PRESENTATION_MEDIA_SLOTS
export type AvatarPresentationMediaSlot = keyof typeof AVATAR_PRESENTATION_MEDIA_SLOTS

/** Player projections: media slots arrive resolved; a ref to a missing asset is omitted. */
export type PublicScenarioPresentation = Omit<ScenarioPresentation, ScenarioPresentationMediaSlot> &
  Partial<Record<ScenarioPresentationMediaSlot, PublicMediaAsset>>

export type PublicAvatarPresentation = Omit<AvatarPresentation, AvatarPresentationMediaSlot> &
  Partial<Record<AvatarPresentationMediaSlot, PublicMediaAsset>>

/** Create sends an object; update replaces the whole object, and `null` clears it. */
export type ScenarioPresentationUpdate = ScenarioPresentation | null
export type AvatarPresentationUpdate = AvatarPresentation | null

const SCENARIO_PRESENTATION_KEYS = [
  'cover',
  'tagline',
  'introText',
  'introMedia',
  'entryQuestion',
  'outroText',
  'outroMedia',
]
const AVATAR_PRESENTATION_KEYS = ['portrait', 'idleLoop', 'hook', 'starterQuestions']

export function isScenarioPresentation(value: unknown): value is ScenarioPresentation {
  if (!isRecord(value) || !hasOnlyKeys(value, SCENARIO_PRESENTATION_KEYS)) return false
  return (
    isOptional(value['cover'], isMediaRef) &&
    isOptional(value['tagline'], (v) => isText(v, PRESENTATION_LIMITS.taglineMaxLength)) &&
    isOptional(value['introText'], (v) => isText(v, PRESENTATION_LIMITS.introTextMaxLength)) &&
    isOptional(value['introMedia'], isMediaRef) &&
    isOptional(value['entryQuestion'], isEntryQuestion) &&
    isOptional(value['outroText'], (v) => isText(v, PRESENTATION_LIMITS.outroTextMaxLength)) &&
    isOptional(value['outroMedia'], isMediaRef)
  )
}

export function isAvatarPresentation(value: unknown): value is AvatarPresentation {
  if (!isRecord(value) || !hasOnlyKeys(value, AVATAR_PRESENTATION_KEYS)) return false
  return (
    isOptional(value['portrait'], isMediaRef) &&
    isOptional(value['idleLoop'], isMediaRef) &&
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
