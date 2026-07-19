import { describe, expect, it } from 'vitest'
import viteConfig, { adminBasePath } from '../vite.config'

describe('admin vite config', () => {
  it('uses the /admin/ base path for production builds', () => {
    const config = viteConfig({
      command: 'build',
      mode: 'production',
      isSsrBuild: false,
      isPreview: false,
    })

    expect(config.base).toBe(adminBasePath)
  })

  it('keeps the root base path for local development', () => {
    const config = viteConfig({
      command: 'serve',
      mode: 'development',
      isSsrBuild: false,
      isPreview: false,
    })

    expect(config.base).toBe('/')
  })
})
