export function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function readStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function readOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

export function readOptionalCandidateFacts(
  value: unknown,
): Array<{ category: string; key: string; value: string }> | undefined {
  if (!Array.isArray(value)) return undefined

  const facts: Array<{ category: string; key: string; value: string }> = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const category = readOptionalString(item['category'])
    const key = readOptionalString(item['key'])
    const factValue = readOptionalString(item['value'])
    if (category === undefined || key === undefined || factValue === undefined) continue
    facts.push({ category, key, value: factValue })
  }
  return facts
}

export function readOptionalStringField<
  K extends
    | 'routingAvatarId'
    | 'routingReason'
    | 'switchedAvatarId'
    | 'mediaCueAssetId'
    | 'cueId'
    | 'reason'
    | 'correlationId'
    | 'injectedNote'
    | 'errorCode'
    | 'llmTraceId'
    | 'avatarId'
    | 'error'
    | 'objectiveId',
>(value: Record<string, unknown>, key: K): Partial<Record<K, string>> {
  const field = readOptionalString(value[key])
  return field !== undefined ? ({ [key]: field } as Partial<Record<K, string>>) : {}
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function readOptionalStringArrayField(
  value: Record<string, unknown>,
  key: 'unlockedAvatarIds',
): { unlockedAvatarIds?: string[] } {
  const field = readStringArray(value[key])
  return field.length > 0 ? { unlockedAvatarIds: field } : {}
}

export function readOptionalNumberField<
  T extends
    | 'retrievalLatencyMs'
    | 'otherOverheadMs'
    | 'avatarFirstTokenLatencyMs'
    | 'speechToTextLatencyMs'
    | 'cueToReportMs'
    | 'clientLatencyMs',
>(value: Record<string, unknown>, key: T): Partial<Record<T, number>> {
  const field = readOptionalNumber(value[key])
  return field !== undefined ? ({ [key]: field } as Partial<Record<T, number>>) : {}
}

export function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readBoolean(value: unknown): boolean {
  return value === true
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}
