import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'

describe('App inspector navigation', () => {
  it('exposes a single session inspector path and no debug-shell breadcrumb', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('Scenario')
    expect(html).toContain('Session Inspector')
    expect(html).not.toContain('Debugging Shell')
  })
})

