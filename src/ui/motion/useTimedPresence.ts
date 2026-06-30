import { useEffect, useReducer } from 'react'

function readTimeMs(variableName: string, fallback: number): number {
  if (typeof document === 'undefined') {
    return fallback
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) {
    return fallback
  }
  return raw.endsWith('s') && !raw.endsWith('ms') ? value * 1000 : value
}

export function useTimedPresence(
  open: boolean,
  durationVariable = '--dropdown-close-dur',
  fallbackDuration = 190
) {
  const [state, dispatch] = useReducer(timedPresenceReducer, open, createTimedPresenceState)

  if (open !== state.open) {
    dispatch({ type: 'retarget', open })
  }

  useEffect(() => {
    if (state.open || !state.closing) {
      return
    }

    const timeout = window.setTimeout(() => {
      dispatch({ type: 'closed' })
    }, readTimeMs(durationVariable, fallbackDuration))

    return () => {
      window.clearTimeout(timeout)
    }
  }, [durationVariable, fallbackDuration, state.closing, state.open])

  return {
    closing: state.open === open ? state.closing : !open && state.mounted,
    mounted: state.open === open ? state.mounted : open || state.mounted
  }
}

type TimedPresenceState = {
  closing: boolean
  mounted: boolean
  open: boolean
}
type TimedPresenceAction =
  | { type: 'closed' }
  | { type: 'retarget'; open: boolean }

function createTimedPresenceState(open: boolean): TimedPresenceState {
  return {
    closing: false,
    mounted: open,
    open
  }
}

function timedPresenceReducer(
  state: TimedPresenceState,
  action: TimedPresenceAction
): TimedPresenceState {
  switch (action.type) {
    case 'closed':
      if (state.open || !state.mounted) {
        return state
      }
      return {
        closing: false,
        mounted: false,
        open: state.open
      }
    case 'retarget':
      if (action.open === state.open) {
        return state
      }
      if (action.open) {
        return {
          closing: false,
          mounted: true,
          open: true
        }
      }
      return {
        closing: state.mounted,
        mounted: state.mounted,
        open: false
      }
  }
}
