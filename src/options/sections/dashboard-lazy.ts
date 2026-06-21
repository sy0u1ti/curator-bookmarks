import type { BookmarkRecord } from '../../shared/types.js'
import type { NewTabSpeedDialStateMessage } from '../../shared/constants.js'
import type { DashboardViewActionDetail } from '../components/dashboard-view-types.js'

type DashboardModule = typeof import('./dashboard-controller.js')
type DashboardCallbacks = Parameters<DashboardModule['handleDashboardViewAction']>[1]

let dashboardModule: DashboardModule | null = null
let dashboardModulePromise: Promise<DashboardModule> | null = null

function loadDashboardModule(): Promise<DashboardModule> {
  if (!dashboardModulePromise) {
    dashboardModulePromise = import('./dashboard-controller.js').then((mod) => {
      dashboardModule = mod
      return mod
    })
  }
  return dashboardModulePromise
}

function loadedDashboardModule(): DashboardModule | null {
  return dashboardModule
}

export function cancelDashboardDrag(): boolean {
  return loadedDashboardModule()?.cancelDashboardDrag() ?? false
}

export function closeDashboardTagEditor(): boolean {
  return loadedDashboardModule()?.closeDashboardTagEditor() ?? false
}

export function closeDashboardTagPopover(): boolean {
  return loadedDashboardModule()?.closeDashboardTagPopover() ?? false
}

export function getSelectedDashboardBookmarks(): BookmarkRecord[] {
  return loadedDashboardModule()?.getSelectedDashboardBookmarks() ?? []
}

export function getSingleDashboardMoveBookmark(): BookmarkRecord | null {
  return loadedDashboardModule()?.getSingleDashboardMoveBookmark() ?? null
}

export function isDashboardViewReady(): boolean {
  return loadedDashboardModule()?.isDashboardViewReady() ?? false
}

export function removeDashboardSelectionIds(bookmarkIds: unknown[]): void {
  loadedDashboardModule()?.removeDashboardSelectionIds(bookmarkIds)
}

export function renderDashboardSection(): void {
  void loadDashboardModule().then((mod) => mod.renderDashboardSection())
}

export function prepareDashboardSectionEntry(): void {
  void loadDashboardModule().then((mod) => mod.prepareDashboardSectionEntry())
}

export function teardownDashboardSectionExit(): void {
  loadedDashboardModule()?.teardownDashboardSectionExit()
}

export async function hydrateDashboardSpeedDialState(): Promise<void> {
  const mod = await loadDashboardModule()
  await mod.hydrateDashboardSpeedDialState()
}

export function hydrateDashboardFaviconCache(rawCache: unknown, now = Date.now()): void {
  void loadDashboardModule().then((mod) => mod.hydrateDashboardFaviconCache(rawCache, now))
}

export function applyNewTabSpeedDialStateMessage(message: NewTabSpeedDialStateMessage): void {
  loadedDashboardModule()?.applyNewTabSpeedDialStateMessage(message)
}

export function handleDashboardKeydown(event: KeyboardEvent): void {
  loadedDashboardModule()?.handleDashboardKeydown(event)
}

export async function handleDashboardViewAction(
  detail: DashboardViewActionDetail,
  callbacks: DashboardCallbacks
): Promise<void> {
  const mod = await loadDashboardModule()
  await mod.handleDashboardViewAction(detail, callbacks)
}

export function handleDashboardPanelClick(event: MouseEvent): void {
  loadedDashboardModule()?.handleDashboardPanelClick(event)
}

export function handleDashboardPanelFocusIn(event: FocusEvent): void {
  loadedDashboardModule()?.handleDashboardPanelFocusIn(event)
}

export async function moveSelectedDashboardBookmarks(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const mod = await loadDashboardModule()
  await mod.moveSelectedDashboardBookmarks(folderId, callbacks)
}

export async function moveSingleDashboardBookmark(
  folderId: string,
  callbacks: DashboardCallbacks
): Promise<void> {
  const mod = await loadDashboardModule()
  await mod.moveSingleDashboardBookmark(folderId, callbacks)
}
