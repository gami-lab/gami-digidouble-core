import type { Route } from '../routing/router'

export type NavModuleId = 'scenarios' | 'model-config'

export type NavItem = {
  id: NavModuleId
  label: string
  route: Route
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'scenarios', label: 'Scenarios', route: { name: 'scenario-list' } },
  { id: 'model-config', label: 'Model Config', route: { name: 'model-config' } },
]
