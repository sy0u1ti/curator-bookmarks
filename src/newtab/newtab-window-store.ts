export interface NewtabWindowActions {
  onHashChange: (event: HashChangeEvent) => void
  onMessage: (event: MessageEvent) => void
  onPointerCancel: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onResize: (event: UIEvent) => void
}

const EMPTY_WINDOW_ACTIONS: NewtabWindowActions = {
  onHashChange: () => {},
  onMessage: () => {},
  onPointerCancel: () => {},
  onPointerMove: () => {},
  onPointerUp: () => {},
  onResize: () => {}
}

let newtabWindowActions: NewtabWindowActions = EMPTY_WINDOW_ACTIONS

export function registerNewtabWindowActions(actions: NewtabWindowActions): () => void {
  newtabWindowActions = actions
  return () => {
    if (newtabWindowActions === actions) {
      newtabWindowActions = EMPTY_WINDOW_ACTIONS
    }
  }
}

export function dispatchNewtabWindowResize(event: UIEvent): void {
  newtabWindowActions.onResize(event)
}

export function dispatchNewtabWindowHashChange(event: HashChangeEvent): void {
  newtabWindowActions.onHashChange(event)
}

export function dispatchNewtabWindowMessage(event: MessageEvent): void {
  newtabWindowActions.onMessage(event)
}

export function dispatchNewtabWindowPointerMove(event: PointerEvent): void {
  newtabWindowActions.onPointerMove(event)
}

export function dispatchNewtabWindowPointerUp(event: PointerEvent): void {
  newtabWindowActions.onPointerUp(event)
}

export function dispatchNewtabWindowPointerCancel(event: PointerEvent): void {
  newtabWindowActions.onPointerCancel(event)
}
