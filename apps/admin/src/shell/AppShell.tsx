import type { JSX, ReactNode } from 'react'
import { apiUrl } from '../env'
import { NAV_ITEMS, type NavModuleId } from './nav-items'

type AppShellProps = {
  activeModuleId: NavModuleId
  onSelectModule: (moduleId: NavModuleId) => void
  children: ReactNode
}

export function AppShell({ activeModuleId, onSelectModule, children }: AppShellProps): JSX.Element {
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
                <button
                  type="button"
                  className={
                    item.id === activeModuleId
                      ? 'admin-nav-item admin-nav-item-active'
                      : 'admin-nav-item'
                  }
                  aria-current={item.id === activeModuleId ? 'page' : undefined}
                  onClick={() => { onSelectModule(item.id) }}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
