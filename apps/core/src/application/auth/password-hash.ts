import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>

const KEY_LENGTH = 64
const SALT_LENGTH = 16
const PREFIX = 'scrypt'

/** Hash format: `scrypt:<salt base64url>:<hash base64url>` (Node's default scrypt cost). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const hash = await scrypt(password, salt, KEY_LENGTH)
  return [PREFIX, salt.toString('base64url'), hash.toString('base64url')].join(':')
}

export function isPasswordHash(value: string): boolean {
  return parsePasswordHash(value) !== null
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(storedHash)
  if (parsed === null) return false
  const candidate = await scrypt(password, parsed.salt, parsed.hash.length)
  return timingSafeEqual(candidate, parsed.hash)
}

function parsePasswordHash(value: string): { salt: Buffer; hash: Buffer } | null {
  const [prefix, salt, hash, ...rest] = value.split(':')
  if (prefix !== PREFIX || salt === undefined || hash === undefined || rest.length > 0) return null
  const saltBytes = Buffer.from(salt, 'base64url')
  const hashBytes = Buffer.from(hash, 'base64url')
  if (saltBytes.length < SALT_LENGTH || hashBytes.length !== KEY_LENGTH) return null
  return { salt: saltBytes, hash: hashBytes }
}
