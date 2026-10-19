import {
  AVATAR_MEDIA_TRIGGER_SLOTS,
  isAvatarMediaTriggers,
  type AvatarMediaTriggers,
  type MediaKind,
  type MediaRef,
} from '@gami/shared'
import { DomainError } from '../errors.js'

/** Avatar media triggers are persisted in this config section. */
export const MEDIA_TRIGGERS_CONFIG_KEY = 'mediaTriggers'

export function readMediaTriggers(config: object): AvatarMediaTriggers | undefined {
  const value: unknown = configRecord(config)[MEDIA_TRIGGERS_CONFIG_KEY]
  return isAvatarMediaTriggers(value) && Object.keys(value).length > 0 ? value : undefined
}

export function withoutMediaTriggers(config: object): Record<string, unknown> {
  const result = configRecord(config)
  Reflect.deleteProperty(result, MEDIA_TRIGGERS_CONFIG_KEY)
  return result
}

/**
 * Applies a create/update trigger mutation to `config` (the config about to be persisted).
 * `undefined` keeps the triggers stored in `baseConfig`; `null` clears them; an object replaces
 * them whole. Triggers smuggled inside the raw input config are rejected.
 */
export function applyMediaTriggersMutation(
  inputConfig: object | undefined,
  config: Record<string, unknown>,
  baseConfig: object,
  value: unknown,
): Record<string, unknown> {
  if (
    inputConfig !== undefined &&
    configRecord(inputConfig)[MEDIA_TRIGGERS_CONFIG_KEY] !== undefined
  ) {
    throw new DomainError(
      'INVALID_INPUT',
      'mediaTriggers must be provided as a top-level field, not inside config',
    )
  }
  const next = value === undefined ? readMediaTriggers(baseConfig) : normalize(value)
  const result = withoutMediaTriggers(config)
  return next === undefined ? result : { ...result, [MEDIA_TRIGGERS_CONFIG_KEY]: next }
}

/** Every asset the triggers reference, with the kinds each trigger accepts. */
export function mediaTriggerReferences(
  triggers: AvatarMediaTriggers | undefined,
): { slot: string; assetId: MediaRef; allowedKinds: readonly MediaKind[] }[] {
  if (triggers === undefined) return []
  return Object.entries(AVATAR_MEDIA_TRIGGER_SLOTS).flatMap(([slot, allowedKinds]) => {
    const assetId = triggers[slot as keyof AvatarMediaTriggers]
    return assetId === undefined ? [] : [{ slot, assetId, allowedKinds }]
  })
}

function normalize(value: unknown): AvatarMediaTriggers | undefined {
  if (value === null) return undefined
  if (!isAvatarMediaTriggers(value)) {
    throw new DomainError('INVALID_INPUT', 'mediaTriggers is not a valid trigger set')
  }
  return Object.keys(value).length > 0 ? value : undefined
}

function configRecord(config: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(config))
}
