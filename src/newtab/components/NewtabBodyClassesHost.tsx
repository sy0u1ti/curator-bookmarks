import { useEffect } from 'react'
import { useNewtabBackgroundSettingsView } from '../newtab-background-settings-store'
import { useNewtabFolderSourceView } from '../newtab-folder-source-store'

export function NewtabBodyClassesHost() {
  const background = useNewtabBackgroundSettingsView()
  const folderSource = useNewtabFolderSourceView()

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

  return null
}
