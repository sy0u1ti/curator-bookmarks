let shellPaint: Promise<void> | undefined

export function preparePopupShellPaint(root: HTMLElement): void {
  shellPaint ??= new Promise<void>(resolve => {
    const afterCommit = () => {
      if (!root.firstElementChild) return false
      requestAnimationFrame(() => { window.setTimeout(resolve, 0) })
      return true
    }
    if (afterCommit()) return
    const observer = new MutationObserver(() => {
      if (afterCommit()) observer.disconnect()
    })
    observer.observe(root, { childList: true })
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
