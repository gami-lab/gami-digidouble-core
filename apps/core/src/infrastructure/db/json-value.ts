import type { JSONValue } from 'postgres'

/** Serialize a domain payload through JSON before passing it to postgres.js. */
export function toJsonValue(value: unknown): JSONValue {
  return JSON.parse(JSON.stringify(value)) as JSONValue
}
