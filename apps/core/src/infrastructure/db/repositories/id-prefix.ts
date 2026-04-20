/**
 * Utility for prefixed-ID handling in Postgres repositories.
 *
 * Domain IDs are stored in the DB as raw UUIDs but exposed to callers with a
 * type prefix (e.g. `scenario_<uuid>`, `session_<uuid>`).  These helpers
 * translate between the two representations.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Strips a known prefix from `id` and validates the remaining part is a UUID.
 * If `id` does not start with the prefix the whole value is treated as the
 * candidate UUID (supports callers that already pass a raw UUID).
 * Returns the raw UUID string on success, or `null` when the UUID is invalid
 * (so callers can return `null` / empty instead of crashing with a DB error).
 */
export function extractUuid(prefix: string, id: string): string | null {
  const uuid = id.startsWith(prefix) ? id.slice(prefix.length) : id
  return UUID_PATTERN.test(uuid) ? uuid : null
}

/**
 * Strips a known prefix from `id` without UUID validation.
 * Use this in INSERT / UPDATE paths where the caller is trusted
 * (e.g. a FK value that was just read from another repo).
 */
export function stripPrefix(prefix: string, id: string): string {
  return id.startsWith(prefix) ? id.slice(prefix.length) : id
}
