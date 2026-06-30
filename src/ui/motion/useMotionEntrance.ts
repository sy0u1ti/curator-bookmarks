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
    entered: false
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
