export interface NewtabKeyboardActions {
  onDocumentKeyDown: (event: KeyboardEvent) => void
}

const EMPTY_KEYBOARD_ACTIONS: NewtabKeyboardActions = {
  onDocumentKeyDown: () => {}
}

let newtabKeyboardActions: NewtabKeyboardActions = EMPTY_KEYBOARD_ACTIONS

export function registerNewtabKeyboardActions(actions: NewtabKeyboardActions): () => void {
  newtabKeyboardActions = actions
  return () => {
    if (newtabKeyboardActions === actions) {
      newtabKeyboardActions = EMPTY_KEYBOARD_ACTIONS
    }
  }
}

export function dispatchNewtabDocumentKeyDown(event: KeyboardEvent): void {
  newtabKeyboardActions.onDocumentKeyDown(event)
}
