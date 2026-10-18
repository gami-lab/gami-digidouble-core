import { createInterface } from 'node:readline/promises'
import { hashPassword } from '../application/auth/password-hash.js'

async function readPassword(): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stderr })
  try {
    return await readline.question('Admin password: ')
  } finally {
    readline.close()
  }
}

const password = await readPassword()
if (password.length < 12) {
  console.error('Use at least 12 characters.')
  process.exit(1)
}
console.log(await hashPassword(password))
