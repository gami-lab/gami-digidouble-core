import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'

describe('App inspector navigation', () => {
  it('exposes debug-shell and session inspector navigation paths', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('Scenario')
    expect(html).toContain('Debugging Shell')
    expect(html).toContain('Session Inspector')
  })
})
