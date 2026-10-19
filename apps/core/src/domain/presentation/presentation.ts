import {
  AVATAR_PRESENTATION_MEDIA_SLOTS,
  SCENARIO_PRESENTATION_MEDIA_SLOTS,
  isAvatarPresentation,
  isScenarioPresentation,
  type AvatarPresentation,
  type MediaKind,
  type MediaRef,
  type ScenarioPresentation,
} from '@gami/shared'
import { DomainError } from '../errors.js'

/** Presentation is persisted in this config section and is never read by orchestration. */
export const PRESENTATION_CONFIG_KEY = 'uiHints'

type PresentationKind = 'scenario' | 'avatar'
type Presentation<K extends PresentationKind> = K extends 'scenario'
  ? ScenarioPresentation
  : AvatarPresentation

const GUARDS = {
  scenario: isScenarioPresentation,
  avatar: isAvatarPresentation,
} as const

const MEDIA_SLOTS: Record<PresentationKind, Record<string, readonly MediaKind[]>> = {
  scenario: SCENARIO_PRESENTATION_MEDIA_SLOTS,
  avatar: AVATAR_PRESENTATION_MEDIA_SLOTS,
}

type PresentationMediaReference = {
  slot: string
  assetId: MediaRef
  allowedKinds: readonly MediaKind[]
}

/** Every media asset a presentation references, with the kinds its slot accepts. */
export function presentationMediaReferences(
  kind: PresentationKind,
  presentation: ScenarioPresentation | AvatarPresentation | undefined,
): PresentationMediaReference[] {
  if (presentation === undefined) return []
  const values: Record<string, unknown> = { ...presentation }
  return Object.entries(MEDIA_SLOTS[kind]).flatMap(([slot, allowedKinds]) => {
    const assetId = values[slot]
    return typeof assetId === 'string' ? [{ slot, assetId, allowedKinds }] : []
  })
}

export function readPresentation<K extends PresentationKind>(
  kind: K,
  config: object,
): Presentation<K> | undefined {
  const value: unknown = configRecord(config)[PRESENTATION_CONFIG_KEY]
  return GUARDS[kind](value) ? (value as Presentation<K>) : undefined
}

export function withoutPresentation(config: object): Record<string, unknown> {
  const result = configRecord(config)
  Reflect.deleteProperty(result, PRESENTATION_CONFIG_KEY)
  return result
}

/**
 * Validates a create/update presentation mutation and returns the config to persist. `undefined`
 * keeps the presentation already in `baseConfig`; `null` clears it; an object replaces it whole.
 */
export function applyPresentationMutation(
  kind: PresentationKind,
  inputConfig: object | undefined,
  baseConfig: object,
  value: unknown,
): Record<string, unknown> {
  if (
    inputConfig !== undefined &&
    configRecord(inputConfig)[PRESENTATION_CONFIG_KEY] !== undefined
  ) {
    throw new DomainError(
      'INVALID_INPUT',
      'presentation must be provided as a top-level field, not inside config',
    )
  }
  const next = value === undefined ? readPresentation(kind, baseConfig) : normalize(kind, value)
  const config = withoutPresentation(inputConfig ?? baseConfig)
  return next === undefined ? config : { ...config, [PRESENTATION_CONFIG_KEY]: next }
}

function normalize(kind: PresentationKind, value: unknown): object | undefined {
  if (value === null) return undefined
  if (!GUARDS[kind](value)) {
    throw new DomainError('INVALID_INPUT', `presentation is not a valid ${kind} presentation`)
  }
  return trimStrings(value) as object
}

function trimStrings(value: unknown): unknown {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(trimStrings)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimStrings(item)]))
  }
  return value
}

function configRecord(config: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(config))
}
