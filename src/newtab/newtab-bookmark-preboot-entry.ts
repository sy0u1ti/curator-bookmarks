import { installNewtabBookmarkPreboot } from './newtab-bookmark-preboot'
import { applyGlassSettingsCss, readGlassSettingsCache } from './glass-settings'

applyGlassSettingsCss(readGlassSettingsCache())
installNewtabBookmarkPreboot()
