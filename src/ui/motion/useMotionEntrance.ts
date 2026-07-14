import { useEffect, useReducer } from 'react'

type MotionEntranceState = {
  active: boolean
  entered: boolean
}
type MotionEntranceAction =
  | { type: 'enter' }
  | { type: 'retarget'; active: boolean }

export function useMotionEntrance(active = true) {
  const [state, dispatch] = useReducer(motionEntranceReducer, active, createMotionEntranceState)

  if (active !== state.active) {
    dispatch({ type: 'retarget', active })
  }

  useEffect(() => {
    if (!state.active || state.entered) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      dispatch({ type: 'enter' })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [state.active, state.entered])

  return active && state.active === active && state.entered
}

function createMotionEntranceState(active: boolean): MotionEntranceState {
  return {
    active,
    // Initial content paints in its settled state. Only a later inactive ->
    // active transition gets an entrance frame, so refreshing a page never
    // makes headings or empty-state copy twitch after the first commit.
    entered: active
  }
}

function motionEntranceReducer(
  state: MotionEntranceState,
  action: MotionEntranceAction
): MotionEntranceState {
  switch (action.type) {
    case 'enter':
      return state.entered ? state : { ...state, entered: true }
    case 'retarget':
      if (action.active === state.active) {
        return state
      }
      return {
        active: action.active,
        entered: false
      }
  }
}
