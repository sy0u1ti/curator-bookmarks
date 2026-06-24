import { useEffect, useState } from 'react'

export function useMotionEntrance(active = true) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!active) {
      setEntered(false)
      return
    }

    setEntered(false)
    const frame = window.requestAnimationFrame(() => {
      setEntered(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [active])

  return entered
}
