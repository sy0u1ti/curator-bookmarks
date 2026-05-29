import './newtab-deferred.css'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from '../ui'
import { ICON_PRESET_META, type IconLayoutPresetKey } from './icon-settings.js'
import { SettingsDrawer } from './components/SettingsDrawer'
import { renderIconPresetCardsIsland, type IconPresetCardState } from './components/IconSettingsIslands'

export interface SettingsDrawerMountResult {
  drawer: HTMLElement | null
  close: HTMLElement | null
  featuredPicker: HTMLElement | null
  featuredDisplaySize: HTMLElement | null
  featuredPositionX: HTMLElement | null
  featuredPositionY: HTMLElement | null
  setOpen: (open: boolean) => void
  isOpen: () => boolean
}

export interface SettingsDrawerMountCallbacks {
  onCloseRequest: (event: Event) => void
  onFeaturedPickerClick: () => void
  bindGeneralSettingsEvents: () => void
  bindFolderSettingsEvents: () => void
  bindBackgroundSettingsEvents: () => void
  bindSearchSettingsEvents: () => void
  bindIconSettingsEvents: () => void
  bindTimeSettingsEvents: () => void
  bindSettingsGroupTabs: () => void
  bindSettingsRangeVisuals: () => void
}

let settingsDrawerRoot: Root | null = null
let settingsDrawerOpen = false
let settingsDrawerCallbacks: SettingsDrawerMountCallbacks | null = null

function renderSettingsDrawer(): void {
  settingsDrawerRoot?.render(
    <ThemeProvider>
      <SettingsDrawer
        open={settingsDrawerOpen}
        onOpenChange={(open, event) => {
          if (!open && settingsDrawerOpen) {
            settingsDrawerCallbacks?.onCloseRequest(event ?? new Event('drawer-close'))
            return
          }
          settingsDrawerOpen = open
          renderSettingsDrawer()
        }}
      />
    </ThemeProvider>
  )
}

function setSettingsDrawerOpen(open: boolean): void {
  if (settingsDrawerOpen === open) return
  settingsDrawerOpen = open
  flushSync(renderSettingsDrawer)
}

export function mountSettingsDrawer(
  callbacks: SettingsDrawerMountCallbacks
): SettingsDrawerMountResult | null {
  settingsDrawerCallbacks = callbacks
  let mount = document.getElementById('newtab-settings-drawer-root')
  if (!mount) {
    mount = document.createElement('div')
    mount.id = 'newtab-settings-drawer-root'
    document.body.appendChild(mount)
  }

  if (!settingsDrawerRoot) {
    settingsDrawerRoot = createRoot(mount)
    flushSync(renderSettingsDrawer)
  }

  const drawer = document.getElementById('newtab-settings-drawer')
  const close = document.getElementById('newtab-settings-close')
  const featuredPicker = document.getElementById('background-featured-picker')
  const featuredDisplaySize = document.getElementById('background-featured-display-size')
  const featuredPositionX = document.getElementById('background-featured-position-x')
  const featuredPositionY = document.getElementById('background-featured-position-y')

  featuredPicker?.addEventListener('click', callbacks.onFeaturedPickerClick)

  callbacks.bindGeneralSettingsEvents()
  callbacks.bindFolderSettingsEvents()
  callbacks.bindBackgroundSettingsEvents()
  callbacks.bindSearchSettingsEvents()
  callbacks.bindIconSettingsEvents()
  callbacks.bindTimeSettingsEvents()
  callbacks.bindSettingsGroupTabs()
  callbacks.bindSettingsRangeVisuals()
  renderIconPresetCards()

  return {
    drawer,
    close,
    featuredPicker,
    featuredDisplaySize,
    featuredPositionX,
    featuredPositionY,
    setOpen: setSettingsDrawerOpen,
    isOpen: () => settingsDrawerOpen
  }
}

export function renderIconPresetCards(): void {
  const row = document.getElementById('icon-preset-row')
  if (!row || row.childElementCount > 0) return

  renderIconPresetCardsIsland(
    row,
    (Object.entries(ICON_PRESET_META) as Array<[IconLayoutPresetKey, typeof ICON_PRESET_META[IconLayoutPresetKey]]>)
      .map(([key, meta]): IconPresetCardState => ({
        desc: meta.desc,
        detail: meta.detail,
        key,
        name: meta.name,
        previewCellHeight: key === 'compact' ? '8px' : key === 'spacious' ? '12px' : '10px',
        previewColumnCount: meta.cols,
        previewGap: key === 'compact' ? '3px' : key === 'spacious' ? '5px' : '4px',
        previewPadding: '0 4px',
        previewRowCount: meta.rows
      }))
  )
}
