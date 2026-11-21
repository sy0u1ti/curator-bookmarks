import { POPUP_PREBOOT_SHELL_ID } from './popup-preboot-input.js'

let shellPaint: Promise<void> | undefined
const SHELL_VISIBILITY_FALLBACK_MS = 320

function isPopupShellVisible(root: HTMLElement): boolean {
  if (!root.firstElementChild || root.dataset.popupReady !== 'true') {
    return false
  }
  const prebootShell = root.ownerDocument.getElementById(POPUP_PREBOOT_SHELL_ID)
  if (!prebootShell) {
    return true
  }
  return prebootShell.hasAttribute('hidden') || prebootShell.dataset.popupPrebootAdopted === 'true'
}

export function preparePopupShellPaint(root: HTMLElement): void {
  shellPaint ??= new Promise<void>(resolve => {
    let settled = false
    let fallbackTimer = 0
    let rootObserver: MutationObserver | null = null
    let prebootObserver: MutationObserver | null = null

    const cleanup = () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer)
        fallbackTimer = 0
      }
      rootObserver?.disconnect()
      prebootObserver?.disconnect()
      rootObserver = null
      prebootObserver = null
    }

    const settleAfterPaint = () => {
      if (settled) return
      settled = true
      cleanup()
      requestAnimationFrame(() => { window.setTimeout(resolve, 0) })
    }

    const checkReady = () => {
      if (settled) return true
      if (isPopupShellVisible(root)) {
        settleAfterPaint()
        return true
      }
      if (root.firstElementChild && !fallbackTimer) {
        fallbackTimer = window.setTimeout(settleAfterPaint, SHELL_VISIBILITY_FALLBACK_MS)
      }
      return false
    }

    if (checkReady()) return

    rootObserver = new MutationObserver(() => {
      checkReady()
    })
    rootObserver.observe(root, {
      attributes: true,
      attributeFilter: ['data-popup-ready'],
      childList: true
    })

    const prebootShell = root.ownerDocument.getElementById(POPUP_PREBOOT_SHELL_ID)
    if (prebootShell) {
      prebootObserver = new MutationObserver(() => {
        checkReady()
      })
      prebootObserver.observe(prebootShell, {
        attributes: true,
        attributeFilter: ['hidden', 'data-popup-preboot-adopted']
      })
    }
  })
}

export function waitForPopupShellPaint(): Promise<void> {
  return shellPaint ?? Promise.resolve()
}

export interface PopupBaseHydrationOptions<TBaseData> {
  loadBaseData: () => Promise<TBaseData>
  applyBaseData: (baseData: TBaseData) => void
  startDeferredHydration?: (baseData: TBaseData) => Promise<unknown>
}

export interface PopupBaseHydrationResult<TBaseData> {
  baseData: TBaseData
  deferredHydration: Promise<unknown>
}

export interface PopupDeferredHydrationOptions<TBaseData, TDeferredData> {
  baseData: TBaseData
  loadDeferredData: () => Promise<TDeferredData>
  applyDeferredData: (baseData: TBaseData, deferredData: TDeferredData) => void
}

export async function hydratePopupBaseData<TBaseData>({
  loadBaseData,
  applyBaseData,
  startDeferredHydration
}: PopupBaseHydrationOptions<TBaseData>): Promise<PopupBaseHydrationResult<TBaseData>> {
  const baseData = await loadBaseData()
  applyBaseData(baseData)
  const deferredHydration = startDeferredHydration
    ? startDeferredHydration(baseData)
    : Promise.resolve()

  return { baseData, deferredHydration }
}

export async function hydratePopupDeferredEnhancements<TBaseData, TDeferredData>({
  baseData,
  loadDeferredData,
  applyDeferredData
}: PopupDeferredHydrationOptions<TBaseData, TDeferredData>): Promise<TDeferredData> {
  const deferredData = await loadDeferredData()
  applyDeferredData(baseData, deferredData)
  return deferredData
}
