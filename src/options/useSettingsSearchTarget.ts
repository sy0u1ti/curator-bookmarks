import { useLayoutEffect, type RefObject } from 'react'
import type { OptionsSectionKey } from './options-section-store'
import { resolveSettingsSearchTarget } from './settings-search'

export function useSettingsSearchTarget(
  section: OptionsSectionKey,
  anchor: string,
  revision: number,
  mainRef: RefObject<HTMLElement | null>
): void {
  useLayoutEffect(() => {
    const destination = resolveSettingsSearchTarget(section, anchor)
    const main = mainRef.current
    if (!destination || !main) return
    let target: HTMLElement | null = null
    let focusTarget: HTMLElement | null = null
    let frame = 0
    let timer = 0
    let changedTabIndex = false
    let observer: MutationObserver | null = null
    let interrupted = false
    const stopListening = () => {
      document.removeEventListener('pointerdown', cancelPendingFocus, true)
      document.removeEventListener('keydown', cancelPendingFocus, true)
      document.removeEventListener('input', cancelPendingFocus, true)
    }
    function cancelPendingFocus() {
      interrupted = true
      observer?.disconnect()
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      stopListening()
    }
    document.addEventListener('pointerdown', cancelPendingFocus, true)
    document.addEventListener('keydown', cancelPendingFocus, true)
    document.addEventListener('input', cancelPendingFocus, true)
    const reveal = () => {
      const node = document.getElementById(destination.targetId)
      if (!node || !main.contains(node) || !node.getClientRects().length) return false
      target = node
      observer?.disconnect()
      window.clearTimeout(timer)
      frame = requestAnimationFrame(() => {
        stopListening()
        if (!node.isConnected || interrupted) return
        // Navigation is a direct request to see this control. Wait for a lazy
        // panel's DOM, then position and focus it without scrolling past it.
        node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
        const focusNode = node.matches(':disabled') ? node.closest<HTMLElement>('label') ?? node.parentElement ?? node : node
        focusTarget = focusNode
        if (!focusNode.hasAttribute('tabindex') && !focusNode.matches('input,button,select,textarea,a[href]')) {
          focusNode.tabIndex = -1
          changedTabIndex = true
        }
        focusNode.focus({ preventScroll: true })
        focusNode.setAttribute('data-settings-target', '')
        timer = window.setTimeout(() => {
          focusNode.removeAttribute('data-settings-target')
        }, 1800)
      })
      return true
    }
    if (!reveal()) {
      // Observe only the active panel while its lazy chunk is arriving. Never
      // scan the page per keypress or leave a permanent observer behind.
      observer = new MutationObserver(reveal)
      observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] })
      timer = window.setTimeout(() => {
        observer?.disconnect()
        stopListening()
        if (!interrupted) main.focus({ preventScroll: true })
      }, 5000)
    }
    return () => {
      observer?.disconnect()
      stopListening()
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      target?.removeAttribute('data-settings-target')
      focusTarget?.removeAttribute('data-settings-target')
      if (changedTabIndex) focusTarget?.removeAttribute('tabindex')
    }
  }, [section, anchor, revision, mainRef])
}
