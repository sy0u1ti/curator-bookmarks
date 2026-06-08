export const SHORTCUT_ACTION_EVENT = 'options:shortcut-action'

export type ShortcutAction =
  | 'copy-url'
  | 'open-settings'
  | 'refresh'

export interface ShortcutActionDetail {
  action: ShortcutAction
}

export function dispatchShortcutAction(action: ShortcutAction): void {
  window.dispatchEvent(new CustomEvent<ShortcutActionDetail>(SHORTCUT_ACTION_EVENT, {
    detail: { action }
  }))
}
