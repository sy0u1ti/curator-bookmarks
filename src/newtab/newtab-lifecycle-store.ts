export interface NewtabLifecycleActions {
  onPageHide: (event: PageTransitionEvent) => void
  onVisibilityChange: (visibilityState: DocumentVisibilityState) => void
}

const EMPTY_LIFECYCLE_ACTIONS: NewtabLifecycleActions = {
  onPageHide: () => {},
  onVisibilityChange: () => {}
}

let newtabLifecycleActions: NewtabLifecycleActions = EMPTY_LIFECYCLE_ACTIONS

export function registerNewtabLifecycleActions(actions: NewtabLifecycleActions): () => void {
  newtabLifecycleActions = actions
  return () => {
    if (newtabLifecycleActions === actions) {
      newtabLifecycleActions = EMPTY_LIFECYCLE_ACTIONS
    }
  }
}

export function dispatchNewtabPageHide(event: PageTransitionEvent): void {
  newtabLifecycleActions.onPageHide(event)
}

export function dispatchNewtabVisibilityChange(visibilityState: DocumentVisibilityState): void {
  newtabLifecycleActions.onVisibilityChange(visibilityState)
}
