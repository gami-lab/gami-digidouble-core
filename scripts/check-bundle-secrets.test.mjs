import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findBundleSecrets } from './check-bundle-secrets.mjs'

function bundle(content) {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'assets', 'index.js'), content)
  return dir
}

test('accepts a bundle without secrets', () => {
  assert.deepEqual(findBundleSecrets([bundle('fetch("/v1/sessions",{headers:{authorization:t}})')]), [])
})

test('flags secret variable names, the service key header, and secret-shaped values', () => {
  for (const content of [
    'const k=import.meta.env.VITE_API_KEY',
    'headers:{"x-admin-service-key":k}',
    'const h="scrypt:r2WcBG9TXEC5g-2G5hcZog:I-D7PYkt9-dkFHMBP3kwxYUdHFEhOL43kdP3He2PJPsWV"',
    'const k="sk-proj-abcdefghijklmnopqrstuvwxyz"',
  ]) {
    assert.equal(findBundleSecrets([bundle(content)]).length, 1, content)
  }
})

test('reports a missing build output instead of passing silently', () => {
  assert.match(findBundleSecrets(['does/not/exist'])[0] ?? '', /missing build output/)
})
