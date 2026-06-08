import { useEffect } from 'react'
import { useNewtabBackgroundSettingsView } from '../newtab-background-settings-store'
import { useNewtabDragUiView } from '../newtab-drag-ui-store'
import { useNewtabFolderSourceView } from '../newtab-folder-source-store'
import { useNewtabSettingsDrawerView } from '../newtab-settings-drawer-store'

export function NewtabBodyClassesHost() {
  const background = useNewtabBackgroundSettingsView()
  const dragUi = useNewtabDragUiView()
  const folderSource = useNewtabFolderSourceView()
  const settingsDrawer = useNewtabSettingsDrawerView()

  useEffect(() => {
    document.body.classList.toggle('settings-open', settingsDrawer.open)
    return () => {
      document.body.classList.remove('settings-open')
    }
  }, [settingsDrawer.open])

  useEffect(() => {
    document.body.classList.toggle('background-mask-enabled', background.maskEnabled)
    document.body.dataset.backgroundMaskStyle = background.maskStyle
    return () => {
      document.body.classList.remove('background-mask-enabled')
      delete document.body.dataset.backgroundMaskStyle
    }
  }, [background.maskEnabled, background.maskStyle])

  useEffect(() => {
    document.body.classList.toggle('folder-names-hidden', folderSource.hideFolderNames)
    return () => {
      document.body.classList.remove('folder-names-hidden')
    }
  }, [folderSource.hideFolderNames])

  useEffect(() => {
    document.body.classList.toggle('settings-trigger-auto-hide', folderSource.general.hideSettingsTrigger)
    return () => {
      document.body.classList.remove('settings-trigger-auto-hide')
    }
  }, [folderSource.general.hideSettingsTrigger])

  useEffect(() => {
    document.body.classList.toggle('bookmark-dragging', dragUi.bookmarkDragging)
    document.body.classList.toggle('bookmark-drag-preview-initializing', dragUi.previewInitializing)
    document.body.classList.toggle('folder-order-dragging', dragUi.folderOrderDragging)
    document.body.classList.toggle('speed-dial-dragging', dragUi.speedDialDragging)
    return () => {
      document.body.classList.remove(
        'bookmark-dragging',
        'bookmark-drag-preview-initializing',
        'folder-order-dragging',
        'speed-dial-dragging'
      )
    }
  }, [
    dragUi.bookmarkDragging,
    dragUi.folderOrderDragging,
    dragUi.previewInitializing,
    dragUi.speedDialDragging
  ])

  return null
}
