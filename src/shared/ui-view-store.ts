import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

export type UiViewStoreScope = 'newtab' | 'options' | 'popup'

type UiViewContextState = Record<string, unknown>

const contextStores: Record<UiViewStoreScope, StoreApi<UiViewContextState>> = {
  newtab: createStore<UiViewContextState>()(() => ({})),
  options: createStore<UiViewContextState>()(() => ({})),
  popup: createStore<UiViewContextState>()(() => ({}))
}

export interface UiViewStoreSlice<State> {
  getState: () => State
  key: string
  scope: UiViewStoreScope
  setState: (nextState: State | ((currentState: State) => State)) => void
  subscribe: (listener: () => void) => () => void
}

interface InternalUiViewStoreSlice<State> extends UiViewStoreSlice<State> {
  readContextState: (contextState: UiViewContextState) => State
  store: StoreApi<UiViewContextState>
}

export function createUiViewStoreSlice<State>(
  scope: UiViewStoreScope,
  key: string,
  initialState: State
): UiViewStoreSlice<State> {
  const store = contextStores[scope]
  if (!Object.prototype.hasOwnProperty.call(store.getState(), key)) {
    store.setState({ [key]: initialState })
  }

  const readContextState = (contextState: UiViewContextState): State => {
    return Object.prototype.hasOwnProperty.call(contextState, key)
      ? contextState[key] as State
      : initialState
  }
  const getState = () => readContextState(store.getState())

  const slice: InternalUiViewStoreSlice<State> = {
    getState,
    key,
    readContextState,
    scope,
    setState(nextState) {
      const currentState = getState()
      const resolvedState = typeof nextState === 'function'
        ? (nextState as (currentState: State) => State)(currentState)
        : nextState
      if (Object.is(currentState, resolvedState)) {
        return
      }
      store.setState({ [key]: resolvedState })
    },
    store,
    subscribe(listener) {
      return store.subscribe((contextState, previousContextState) => {
        if (!Object.is(
          readContextState(contextState),
          readContextState(previousContextState)
        )) {
          listener()
        }
      })
    }
  }

  return slice
}

export function useUiViewStoreSlice<State>(slice: UiViewStoreSlice<State>): State
export function useUiViewStoreSlice<State, Selection>(
  slice: UiViewStoreSlice<State>,
  selector: (state: State) => Selection
): Selection
export function useUiViewStoreSlice<State, Selection>(
  slice: UiViewStoreSlice<State>,
  selector?: (state: State) => Selection
): State | Selection {
  const internalSlice = slice as InternalUiViewStoreSlice<State>
  return useStore(
    internalSlice.store,
    (contextState) => {
      const state = internalSlice.readContextState(contextState)
      return selector ? selector(state) : state
    }
  )
}
