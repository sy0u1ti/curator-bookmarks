export interface MenuLabelSource {
  attributes?: Record<string, string>
  id: string
  label: unknown
}

export function getInlineMenuActionLabel(action: MenuLabelSource): string {
  const attributeLabel = String(action.attributes?.['aria-label'] || '').trim()
  if (attributeLabel) {
    return attributeLabel
  }

  if (typeof action.label === 'string') {
    return action.label
  }

  return String(action.id || 'menu-action')
}
