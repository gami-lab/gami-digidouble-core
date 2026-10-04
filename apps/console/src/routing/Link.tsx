import type { JSX, ReactNode } from 'react'
import { formatRoute, navigate, type Route } from './router'

type LinkProps = {
  to: Route
  className?: string
  current?: boolean
  replace?: boolean
  children: ReactNode
}

// A real anchor: modified clicks (new tab/window) keep browser behavior, plain clicks navigate in-app.
export function Link({
  to,
  className,
  current = false,
  replace = false,
  children,
}: LinkProps): JSX.Element {
  return (
    <a
      href={formatRoute(to)}
      className={className}
      aria-current={current ? 'page' : undefined}
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
        navigate(to, { replace })
      }}
    >
      {children}
    </a>
  )
}
