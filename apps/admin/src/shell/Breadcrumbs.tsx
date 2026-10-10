import { Fragment } from 'react'
import type { JSX } from 'react'
import { Link } from '../routing/Link'
import { useDocumentTitle, type Route } from '../routing/router'

export type Crumb = { label: string; to?: Route }

export function Breadcrumbs({ items }: { items: Crumb[] }): JSX.Element {
  useDocumentTitle(items.map((item) => item.label))

  return (
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1
        return (
          <Fragment key={`${String(index)}-${item.label}`}>
            {index > 0 ? <span className="admin-breadcrumbs-separator" aria-hidden="true">›</span> : null}
            {isCurrent || item.to === undefined ? (
              <span aria-current={isCurrent ? 'page' : undefined}>{item.label}</span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
