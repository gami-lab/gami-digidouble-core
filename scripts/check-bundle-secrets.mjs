#!/usr/bin/env node
// Fails when a built browser bundle contains a Core auth secret name or a secret-shaped value.
// Provider key names may appear in operator help text, so provider keys are matched by shape.
// Usage: node scripts/check-bundle-secrets.mjs [distDir ...]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_DIST_DIRS = ['apps/web/dist', 'apps/admin/dist', 'apps/console/dist']

const FORBIDDEN = [
  { name: 'legacy shared key variable', pattern: /VITE_API_KEY|API_KEY_SECRET/ },
  {
    name: 'Core auth secret variable',
    pattern: /ADMIN_SERVICE_KEY|ADMIN_SESSION_SECRET|ADMIN_PASSWORD_HASH|PLAYER_TOKEN_SECRET/,
  },
  { name: 'service key header', pattern: /x-admin-service-key/i },
  { name: 'password hash', pattern: /scrypt:[\w-]{16,}:[\w-]{40,}/ },
  { name: 'provider key', pattern: /\b(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,})\b/ },
  { name: 'placeholder secret', pattern: /change_me_in_production/ },
]

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

export function findBundleSecrets(distDirs) {
  const findings = []
  for (const dir of distDirs) {
    let files
    try {
      files = listFiles(dir)
    } catch {
      findings.push(`${dir}: missing build output (run pnpm build first)`)
      continue
    }
    for (const file of files.filter((path) => /\.(js|mjs|css|html|map|json)$/.test(path))) {
      const content = readFileSync(file, 'utf8')
      for (const { name, pattern } of FORBIDDEN) {
        if (pattern.test(content)) findings.push(`${file}: contains a ${name}`)
      }
    }
  }
  return findings
}

const isMain = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1])
if (isMain) {
  const dirs = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_DIST_DIRS
  const findings = findBundleSecrets(dirs)
  if (findings.length > 0) {
    console.error(['Browser bundles must not contain secrets:', ...findings].join('\n'))
    process.exit(1)
  }
  console.log(`No secrets found in ${dirs.join(', ')}`)
}
