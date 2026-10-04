import type { CSSProperties, JSX, ReactNode } from 'react'
import { formatRoute, navigate, type Route } from './router'

type LinkProps = {
  to: Route
  style?: CSSProperties
  children: ReactNode
}

// A real anchor: modified clicks (new tab/window) keep browser behavior, plain clicks navigate in-app.
export function Link({ to, style, children }: LinkProps): JSX.Element {
  return (
    <a
      href={formatRoute(to)}
      style={style}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        event.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
