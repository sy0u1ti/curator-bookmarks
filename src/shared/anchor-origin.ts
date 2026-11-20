export interface AnchorPoint {
  x: number
  y: number
}

export interface SurfaceBox {
  left: number
  top: number
  width: number
  height: number
}

export interface MenuAnchorOrigin {
  origin: string
  originX: number
  originY: number
  enterX: number
  enterY: number
}

export interface CardAnchorOrigin {
  origin: string
  originX: number
  originY: number
  enterX: number
  enterY: number
}

export interface DialogAnchorStyle {
  origin: string
  enterX: number
  enterY: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundPx(value: number): number {
  const rounded = Math.round(value * 2) / 2
  return Object.is(rounded, -0) ? 0 : rounded
}

export function isPopupSurfaceDocument(doc: Document | null | undefined = typeof document !== 'undefined' ? document : null): boolean {
  if (!doc) return false
  const surface = doc.documentElement?.dataset?.curatorSurface
  if (surface === 'popup' || surface === 'sidepanel') return true
  return Boolean(doc.getElementById('popup-app-shell'))
}

export function computeMenuAnchorOrigin(
  anchor: AnchorPoint,
  surface: SurfaceBox,
  maxShift = 4
): MenuAnchorOrigin {
  const safeWidth = Math.max(0, surface.width)
  const safeHeight = Math.max(0, surface.height)
  const originX = Math.round(clamp(anchor.x - surface.left, 0, safeWidth))
  const originY = Math.round(clamp(anchor.y - surface.top, 0, safeHeight))
  const normX = safeWidth > 0 ? (originX / safeWidth) * 2 - 1 : 0
  const normY = safeHeight > 0 ? (originY / safeHeight) * 2 - 1 : -1
  const enterX = Math.abs(normX) < 0.18 ? 0 : roundPx(clamp(normX * maxShift, -maxShift, maxShift))
  const enterY = Math.abs(normY) < 0.18 ? 0 : roundPx(clamp(normY * maxShift, -maxShift, maxShift))
  const resolvedEnterY = enterX === 0 && enterY === 0 ? -maxShift : enterY

  return {
    origin: `${originX}px ${originY}px`,
    originX,
    originY,
    enterX,
    enterY: resolvedEnterY
  }
}

export function computeCardAnchoredOrigin(
  card: SurfaceBox,
  preview: SurfaceBox,
  maxShift = 6
): CardAnchorOrigin {
  const cardCenter: AnchorPoint = {
    x: card.left + card.width / 2,
    y: card.top + card.height / 2
  }
  return computeMenuAnchorOrigin(cardCenter, preview, maxShift)
}

export function computeDialogAnchorStyle(
  panel: SurfaceBox,
  triggerBox: SurfaceBox | null,
  fallbackPoint: AnchorPoint | null = null
): DialogAnchorStyle {
  let focal: AnchorPoint | null = null
  if (triggerBox && (triggerBox.width > 0 || triggerBox.height > 0)) {
    focal = {
      x: triggerBox.left + triggerBox.width / 2,
      y: triggerBox.top + triggerBox.height / 2
    }
  } else if (fallbackPoint && Number.isFinite(fallbackPoint.x) && Number.isFinite(fallbackPoint.y)) {
    focal = fallbackPoint
  }

  if (!focal || panel.width <= 0 || panel.height <= 0) {
    return {
      origin: '50% 50%',
      enterX: 0,
      enterY: 12
    }
  }

  const pctX = Math.round(clamp(((focal.x - panel.left) / panel.width) * 100, 24, 76))
  const pctY = Math.round(clamp(((focal.y - panel.top) / panel.height) * 100, 20, 80))

  const panelCenterX = panel.left + panel.width / 2
  const panelCenterY = panel.top + panel.height / 2
  const rawEnterX = roundPx(clamp((focal.x - panelCenterX) * 0.08, -20, 20))
  const rawEnterY = roundPx(clamp((focal.y - panelCenterY) * 0.08, -16, 16))

  if (Math.abs(rawEnterX) < 2 && Math.abs(rawEnterY) < 2) {
    return {
      origin: `${pctX}% ${pctY}%`,
      enterX: 0,
      enterY: 10
    }
  }

  return {
    origin: `${pctX}% ${pctY}%`,
    enterX: rawEnterX,
    enterY: rawEnterY
  }
}
