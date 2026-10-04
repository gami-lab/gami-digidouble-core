import type { JSX, ReactNode } from 'react'
import { formatRoute, navigate, type Route } from './router'

type LinkProps = {
  to: Route
  className?: string
  ariaCurrent?: boolean
  children: ReactNode
}

// A real anchor: modified clicks (new tab/window) keep browser behavior, plain clicks navigate in-app.
export function Link({ to, className, ariaCurrent = false, children }: LinkProps): JSX.Element {
  return (
    <a
      href={formatRoute(to)}
      className={className}
      aria-current={ariaCurrent ? 'page' : undefined}
      onClick={(event) => {
        // Rows can also be clickable; the link must not trigger the row as well.
        event.stopPropagation()
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
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
