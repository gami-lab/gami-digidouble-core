/**
 * Builds a spreadable `{ [key]: value }` only when the value is present, so
 * mappers can keep optional properties absent under `exactOptionalPropertyTypes`.
 */
export function optionalField<K extends string, V>(
  key: K,
  value: V | null | undefined,
): Partial<Record<K, V>>
export function optionalField<K extends string, V, R>(
  key: K,
  value: V | null | undefined,
  map: (value: V) => R,
): Partial<Record<K, R>>
export function optionalField<K extends string, V, R>(
  key: K,
  value: V | null | undefined,
  map?: (value: V) => R,
): Partial<Record<K, V | R>> {
  const field: Partial<Record<K, V | R>> = {}
  if (value === null || value === undefined) return field
  field[key] = map === undefined ? value : map(value)
  return field
}
