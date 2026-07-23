import type { CSSProperties } from 'react'
import { useNewtabBackgroundSettingsView } from '../newtab-background-settings-store'
import { useNewtabDragUiView } from '../newtab-drag-ui-store'
import { useNewtabFolderSourceView } from '../newtab-folder-source-store'
import { useNewtabInstantWallpaperView } from '../newtab-instant-wallpaper-store'
import { useNewtabSettingsDrawerOpen } from '../newtab-settings-drawer-store'

const DRAG_ACTIVE_CLASS = 'cursor-default select-none'

export function useNewtabAppChromeAttributes() {
  const background = useNewtabBackgroundSettingsView()
  const dragUi = useNewtabDragUiView()
  const folderSource = useNewtabFolderSourceView()
  const instantWallpaper = useNewtabInstantWallpaperView()
  const settingsDrawerOpen = useNewtabSettingsDrawerOpen()
  const dragActive = dragUi.bookmarkDragging || dragUi.folderOrderDragging || dragUi.speedDialDragging

  const className = [
    'newtab-app',
    instantWallpaper.loading ? 'loading-wallpaper' : '',
    instantWallpaper.booting ? 'newtab-booting' : '',
    instantWallpaper.ready ? 'instant-wallpaper-ready' : '',
    instantWallpaper.remoteReady ? 'instant-wallpaper-remote-ready' : '',
    settingsDrawerOpen ? 'settings-open' : '',
    background.maskEnabled ? 'background-mask-enabled' : '',
    folderSource.hideFolderNames ? 'folder-names-hidden' : '',
    folderSource.general.hideSettingsTrigger ? 'settings-trigger-auto-hide' : '',
    dragUi.bookmarkDragging ? 'bookmark-dragging' : '',
    dragUi.previewInitializing ? 'bookmark-drag-preview-initializing' : '',
    dragUi.folderOrderDragging ? 'folder-order-dragging' : '',
    dragUi.speedDialDragging ? 'speed-dial-dragging' : '',
    dragActive ? DRAG_ACTIVE_CLASS : ''
  ].filter(Boolean).join(' ')
  const style = {
    '--bg': instantWallpaper.backgroundColor,
    '--wallpaper-placeholder-bg': instantWallpaper.placeholderColor,
    '--instant-wallpaper-image': instantWallpaper.image || undefined,
    '--instant-wallpaper-preview-image': instantWallpaper.previewImage || undefined,
    '--instant-wallpaper-size': instantWallpaper.size,
    '--instant-wallpaper-position': instantWallpaper.position
  } as CSSProperties

  return {
    'data-background-media': background.type === 'color' ? undefined : 'true',
    'data-background-type': background.type,
    'data-instant-wallpaper-pending': instantWallpaper.pending ? 'true' : undefined,
    'data-instant-wallpaper-remote-ready': instantWallpaper.remoteReady ? 'true' : undefined,
    'data-instant-wallpaper-signature': instantWallpaper.signature || undefined,
    'data-background-mask-style': background.maskStyle,
    className,
    style
  }
}
