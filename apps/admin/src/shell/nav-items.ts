export type NavModuleId = 'scenarios' | 'model-config'

export type NavItem = {
  id: NavModuleId
  label: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'model-config', label: 'Model Config' },
]
