export const TAG_MANAGEMENT_ACTION_EVENT = 'options:tag-management-action'
export const TAG_MANAGEMENT_FILL_EVENT = 'options:tag-management-fill'
export const TAG_MANAGEMENT_FORM_EVENT = 'options:tag-management-form'

export interface TagManagementActionDetail {
  action: 'delete' | 'refresh' | 'rename'
  sourceTag?: string
  targetTag?: string
}

export interface TagManagementFillDetail {
  tag: string
}

export interface TagManagementFormDetail {
  focusTarget?: boolean
  sourceTag?: string
  targetTag?: string
}

export function dispatchTagManagementAction(detail: TagManagementActionDetail): void {
  window.dispatchEvent(new CustomEvent<TagManagementActionDetail>(TAG_MANAGEMENT_ACTION_EVENT, { detail }))
}

export function dispatchTagManagementFill(tag: string): void {
  window.dispatchEvent(new CustomEvent<TagManagementFillDetail>(TAG_MANAGEMENT_FILL_EVENT, {
    detail: { tag }
  }))
}

export function dispatchTagManagementForm(detail: TagManagementFormDetail): void {
  window.dispatchEvent(new CustomEvent<TagManagementFormDetail>(TAG_MANAGEMENT_FORM_EVENT, { detail }))
}
