import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { OptionsSectionKey } from './options-section-store'

export function useOptionsReadingPosition(
  section: OptionsSectionKey,
  anchor: string,
  mainRef: RefObject<HTMLElement | null>,
  shellRef: RefObject<HTMLElement | null>
): void {
  const positions = useRef(new Map<OptionsSectionKey, { main: number; shell: number }>())
  useLayoutEffect(() => {
    const main = mainRef.current
    const shell = shellRef.current
    if (!main || !shell) return
    const saved = positions.current.get(section)
    let latest = saved ?? { main: 0, shell: 0 }
    const remember = () => { latest = { main: main.scrollTop, shell: shell.scrollTop } }
    main.addEventListener('scroll', remember, { passive: true })
    shell.addEventListener('scroll', remember, { passive: true })
    main.toggleAttribute('data-reading-restored', Boolean(saved))
    let observer: MutationObserver | null = null
    let timer = 0
    const restore = () => {
      if (!main.querySelector(`#${section}`)) return false
      // A deep link owns its own position. Ordinary return navigation restores
      // the existing reading position only once, after a lazy panel is mounted.
      if (!anchor) {
        main.scrollTo({ top: saved?.main ?? 0, left: 0, behavior: 'instant' })
        shell.scrollTo({ top: saved?.shell ?? 0, left: 0, behavior: 'instant' })
      }
      remember()
      observer?.disconnect()
      window.clearTimeout(timer)
      return true
    }
    if (!restore()) {
      observer = new MutationObserver(restore)
      observer.observe(main, { childList: true, subtree: true })
      timer = window.setTimeout(() => observer?.disconnect(), 5000)
    }
    return () => {
      // Layout cleanup may run after the old content has been removed. Reading
      // scrollTop there would capture the browser's already-clamped zero.
      positions.current.set(section, latest)
      main.removeEventListener('scroll', remember)
      shell.removeEventListener('scroll', remember)
      observer?.disconnect()
      window.clearTimeout(timer)
      main.removeAttribute('data-reading-restored')
    }
  }, [section, anchor, mainRef, shellRef])
}
