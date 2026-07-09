import type { JSX, ReactNode } from 'react'
import { apiUrl } from '../env'
import { NAV_ITEMS, type NavModuleId } from './nav-items'

type AppShellProps = {
  activeModuleId: NavModuleId
  children: ReactNode
}

export function AppShell({ activeModuleId, children }: AppShellProps): JSX.Element {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Gami DigiDouble — Admin</h1>
        <p className="admin-header-meta">API URL: {apiUrl}</p>
      </header>
      <div className="admin-body">
        <nav className="admin-nav" aria-label="Scenario builder modules">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <span
                  className={
                    item.id === activeModuleId
                      ? 'admin-nav-item admin-nav-item-active'
                      : 'admin-nav-item'
                  }
                  aria-current={item.id === activeModuleId ? 'page' : undefined}
                >
                  {item.label}
                  {item.comingSoon ? <em className="admin-nav-badge"> (coming soon)</em> : null}
                </span>
              </li>
            ))}
          </ul>
        </nav>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
