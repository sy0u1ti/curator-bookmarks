export const MENU_INTENT_TIMING = {
  open: 220,
  close: 360,
  safeWindow: 1200,
  recheck: 80,
  dragOpen: 420
} as const

export interface MenuPoint {
  x: number
  y: number
}

export interface MenuBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export interface MenuGeometry {
  parent: MenuBounds
  submenu: MenuBounds
  side: 'left' | 'right'
}

function cross(a: MenuPoint, b: MenuPoint, point: MenuPoint): number {
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
}

export function pointInMenuTriangle(
  point: MenuPoint,
  a: MenuPoint,
  b: MenuPoint,
  c: MenuPoint
): boolean {
  if (![point, a, b, c].every(value => Number.isFinite(value.x) && Number.isFinite(value.y))) return false
  if (Math.abs(cross(a, b, c)) < 0.001) return false
  const edges = [cross(a, b, point), cross(b, c, point), cross(c, a, point)]
  return !edges.some(value => value < 0) || !edges.some(value => value > 0)
}

export function pointInMenuBounds(point: MenuPoint, bounds: MenuBounds): boolean {
  return point.x >= bounds.left && point.x <= bounds.right &&
    point.y >= bounds.top && point.y <= bounds.bottom
}

export function isHeadingToSubmenu(
  previous: MenuPoint | null,
  current: MenuPoint | null,
  geometry: MenuGeometry | null
): boolean {
  if (!previous || !current || !geometry) return false
  const { parent, submenu, side } = geometry
  const width = parent.right - parent.left
  if (width <= 0 || submenu.bottom <= submenu.top || submenu.right <= submenu.left) return false
  if (pointInMenuBounds(current, submenu)) return false

  const band = Math.min(90, Math.max(56, width * 0.43))
  const right = side === 'right'
  const edge = right ? submenu.left : submenu.right
  // Reversing direction is an intentional return to the parent, not a safe transit.
  if (right ? current.x <= previous.x : current.x >= previous.x) return false
  if (right
    ? current.x < parent.right - band || current.x > edge
    : current.x > parent.left + band || current.x < edge) return false

  return pointInMenuTriangle(current, previous, { x: edge, y: submenu.top }, { x: edge, y: submenu.bottom })
}

export interface MenuIntentRow {
  depth: number
  id: string
  submenu: boolean
}

export interface MenuIntentSnapshot {
  openPath: readonly string[]
  hovered: MenuIntentRow | null
  pointer: boolean
}

export interface MenuIntentClock {
  now: () => number
  schedule: (callback: () => void, delay: number) => unknown
  cancel: (timer: unknown) => void
}

const defaultClock: MenuIntentClock = {
  now: () => performance.now(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancel: timer => clearTimeout(timer as ReturnType<typeof setTimeout>)
}

export function createMenuIntent({
  geometry,
  onChange,
  onClose,
  clock = defaultClock
}: {
  geometry: (depth: number) => MenuGeometry | null
  onChange: (snapshot: MenuIntentSnapshot) => void
  onClose?: () => void
  clock?: MenuIntentClock
}) {
  let snapshot: MenuIntentSnapshot = { openPath: [], hovered: null, pointer: false }
  let previous: MenuPoint | null = null
  let current: MenuPoint | null = null
  let pending: { row: MenuIntentRow; started: number; delay: number } | null = null
  let hoverTimer: unknown = null
  let closeTimer: unknown = null
  let outsideSince: number | null = null

  function publish(patch: Partial<MenuIntentSnapshot>) {
    const next = { ...snapshot, ...patch }
    if (next.pointer === snapshot.pointer &&
      next.hovered?.id === snapshot.hovered?.id && next.hovered?.depth === snapshot.hovered?.depth &&
      next.openPath.length === snapshot.openPath.length &&
      next.openPath.every((id, index) => id === snapshot.openPath[index])) return
    snapshot = next
    onChange(snapshot)
  }

  function cancelHover() {
    if (hoverTimer !== null) clock.cancel(hoverTimer)
    hoverTimer = null
    pending = null
  }

  function enter() {
    if (closeTimer !== null) clock.cancel(closeTimer)
    closeTimer = null
    outsideSince = null
  }

  function isSafe(depth: number) {
    return isHeadingToSubmenu(previous, current, geometry(depth))
  }

  function activate(row: MenuIntentRow) {
    cancelHover()
    const openPath = row.submenu
      ? [...snapshot.openPath.slice(0, row.depth), row.id]
      : snapshot.openPath.slice(0, row.depth)
    publish({ openPath, hovered: row })
  }

  function checkHover() {
    if (hoverTimer !== null) clock.cancel(hoverTimer)
    hoverTimer = null
    if (!pending) return
    const elapsed = clock.now() - pending.started
    if (elapsed < MENU_INTENT_TIMING.safeWindow && isSafe(pending.row.depth)) {
      hoverTimer = clock.schedule(checkHover, Math.min(MENU_INTENT_TIMING.recheck, MENU_INTENT_TIMING.safeWindow - elapsed))
      return
    }
    publish({ hovered: pending.row })
    if (elapsed >= pending.delay) activate(pending.row)
    else hoverTimer = clock.schedule(checkHover, pending.delay - elapsed)
  }

  function move(point: MenuPoint) {
    // Repeated/stationary events must not collapse the triangle onto its apex.
    if (current?.x === point.x && current?.y === point.y) return
    previous = current
    current = point
    if (pending) checkHover()
  }

  function hover(row: MenuIntentRow, point: MenuPoint, dragging = false) {
    move(point)
    enter()
    publish({ pointer: true })
    if (pending?.row.id === row.id && pending.row.depth === row.depth) return
    cancelHover()
    if (snapshot.openPath[row.depth] === row.id) {
      publish({ hovered: row })
      return
    }
    pending = { row, started: clock.now(), delay: dragging ? MENU_INTENT_TIMING.dragOpen : MENU_INTENT_TIMING.open }
    checkHover()
  }

  function leaveRow(row: MenuIntentRow) {
    if (pending?.row.id === row.id && pending.row.depth === row.depth) cancelHover()
    if (snapshot.hovered?.id === row.id && snapshot.hovered.depth === row.depth) publish({ hovered: null })
  }

  function enterLevel(depth: number) {
    enter()
    if (pending && depth > pending.row.depth) cancelHover()
  }

  function close() {
    cancelHover()
    enter()
    publish({ openPath: [], hovered: null })
    onClose?.()
  }

  function checkOutside() {
    closeTimer = null
    const elapsed = clock.now() - (outsideSince ?? clock.now())
    if (elapsed < MENU_INTENT_TIMING.safeWindow && snapshot.openPath.some((_, depth) => isSafe(depth))) {
      closeTimer = clock.schedule(checkOutside, MENU_INTENT_TIMING.recheck)
    } else {
      closeTimer = clock.schedule(close, MENU_INTENT_TIMING.close)
    }
  }

  function leave() {
    cancelHover()
    if (outsideSince !== null) return
    outsideSince = clock.now()
    checkOutside()
  }

  function keyboard() {
    cancelHover()
    enter()
    previous = current = null
    publish({ pointer: false, hovered: null })
  }

  function setOpen(depth: number, id: string, open: boolean) {
    cancelHover()
    enter()
    if (open) publish({ openPath: [...snapshot.openPath.slice(0, depth), id] })
    else if (snapshot.openPath[depth] === id) publish({ openPath: snapshot.openPath.slice(0, depth) })
  }

  function reset() {
    cancelHover()
    enter()
    previous = current = null
    publish({ openPath: [], hovered: null, pointer: false })
  }

  return {
    getSnapshot: () => snapshot,
    move,
    hover,
    leaveRow,
    enterLevel,
    enter,
    leave,
    keyboard,
    setOpen,
    cancelPending: cancelHover,
    reset,
    dispose() {
      cancelHover()
      enter()
    }
  }
}

export type MenuIntent = ReturnType<typeof createMenuIntent>
