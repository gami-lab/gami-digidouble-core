export type NavModuleId = 'scenarios' | 'knowledge' | 'model-config'

export type NavItem = {
  id: NavModuleId
  label: string
  comingSoon: boolean
}

// Extend this list as later scenario-builder slices (avatars live inside a
// scenario, knowledge sources, runtime model selection) add their own module.
export const NAV_ITEMS: NavItem[] = [
  { id: 'scenarios', label: 'Scenarios', comingSoon: false },
  { id: 'knowledge', label: 'Knowledge Sources', comingSoon: true },
  { id: 'model-config', label: 'Model Config', comingSoon: true },
]
