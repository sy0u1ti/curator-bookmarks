export type PopupSearchFocusSource = 'command-intent' | 'in-page-shortcut'

export interface PopupSearchFocusPlan {
  select: boolean
}

export function getPopupSearchFocusPlan(source: PopupSearchFocusSource): PopupSearchFocusPlan {
  if (source === 'in-page-shortcut') {
    return { select: true }
  }

  return { select: false }
}
