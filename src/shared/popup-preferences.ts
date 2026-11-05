export interface PopupPreferences {
  animatedCaret: boolean
  naturalSearchEnabled: boolean
}

export const DEFAULT_POPUP_PREFERENCES: PopupPreferences = {
  animatedCaret: true,
  naturalSearchEnabled: false
}

export function normalizePopupPreferences(value: unknown): PopupPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_POPUP_PREFERENCES }
  }

  const source = value as Record<string, unknown>
  return {
    animatedCaret: typeof source.animatedCaret === 'boolean'
      ? source.animatedCaret
      : typeof source.animatedSearchCaret === 'boolean'
        ? source.animatedSearchCaret
        : DEFAULT_POPUP_PREFERENCES.animatedCaret,
    naturalSearchEnabled: source.naturalSearchEnabled === true
  }
}
