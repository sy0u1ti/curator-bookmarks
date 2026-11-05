export const INPUT_CARET_REST_AFTER_MS = 8_000
export const INPUT_CARET_FAST_INPUT_MS = 120
export const INPUT_CARET_TRAIL_MAX_WIDTH = 96
export const INPUT_CARET_TRAIL_THROTTLE_MS = 32
export const INPUT_CARET_WIDTH_PX = 2.5

export const INPUT_CARET_BIDI_PATTERN = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/

export interface InputCaretPosition {
  left: number
  top: number
}

export interface InputCaretTrailGeometry {
  direction: 'left' | 'right'
  left: number
  width: number
}

const CARET_NAVIGATION_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Backspace',
  'Delete'
])

export function isInputCaretNavigationKey(key: string): boolean {
  return CARET_NAVIGATION_KEYS.has(key)
}

export function isFastInputCaretUpdate(previousInputAt: number | null, inputAt: number): boolean {
  if (previousInputAt === null) return false
  const interval = inputAt - previousInputAt
  return interval >= 0 && interval < INPUT_CARET_FAST_INPUT_MS
}

export function clampInputCaretLeft(left: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(left)) return minimum
  return Math.min(maximum, Math.max(minimum, left))
}

export function shouldSnapInputCaret(
  previous: InputCaretPosition | null,
  next: InputCaretPosition,
  snapRequested = false
): boolean {
  return previous === null || snapRequested || Math.abs(previous.top - next.top) >= 0.5
}

export function getInputCaretTrailGeometry(
  previous: InputCaretPosition,
  next: InputCaretPosition
): InputCaretTrailGeometry | null {
  if (Math.abs(previous.top - next.top) >= 0.5) return null

  const delta = next.left - previous.left
  const width = Math.min(Math.abs(delta), INPUT_CARET_TRAIL_MAX_WIDTH)
  if (width < 2) return null

  const direction = delta > 0 ? 'right' : 'left'
  return {
    direction,
    left: direction === 'right' ? next.left - width : next.left,
    width
  }
}

export function maskInputCaretPasswordText(text: string): string {
  return Array.from(text).map(() => '•').join('')
}
