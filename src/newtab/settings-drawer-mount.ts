import './newtab-deferred.css'
import { ICON_PRESET_META } from './icon-settings.js'
import { SETTINGS_DRAWER_MARKUP } from './settings-drawer-template.js'

export interface SettingsDrawerMountResult {
  drawer: HTMLElement | null
  close: HTMLElement | null
  featuredPicker: HTMLElement | null
  featuredDisplaySize: HTMLElement | null
  featuredPositionX: HTMLElement | null
  featuredPositionY: HTMLElement | null
}

export interface SettingsDrawerMountCallbacks {
  onCloseClick: () => void
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

export function mountSettingsDrawer(
  callbacks: SettingsDrawerMountCallbacks
): SettingsDrawerMountResult | null {
  const template = document.createElement('template')
  template.innerHTML = SETTINGS_DRAWER_MARKUP.trim()
  document.body.appendChild(template.content.cloneNode(true))

  const drawer = document.getElementById('newtab-settings-drawer')
  const close = document.getElementById('newtab-settings-close')
  const featuredPicker = document.getElementById('background-featured-picker')
  const featuredDisplaySize = document.getElementById('background-featured-display-size')
  const featuredPositionX = document.getElementById('background-featured-position-x')
  const featuredPositionY = document.getElementById('background-featured-position-y')

  close?.addEventListener('click', callbacks.onCloseClick)
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
    featuredPositionY
  }
}

export function renderIconPresetCards(): void {
  const row = document.getElementById('icon-preset-row')
  if (!row || row.childElementCount > 0) return
  for (const [key, meta] of Object.entries(ICON_PRESET_META)) {
    const card = document.createElement('button')
    card.className = 'icon-preset-card'
    card.type = 'button'
    card.dataset.preset = key
    card.setAttribute('aria-pressed', 'false')
    card.setAttribute('aria-label', `${meta.name}布局，${meta.desc}，${meta.detail}`)

    const preview = document.createElement('div')
    preview.className = 'icon-preset-preview'
    preview.style.gridTemplateColumns = `repeat(${meta.cols}, 1fr)`
    preview.style.gap = key === 'compact' ? '3px' : key === 'spacious' ? '5px' : '4px'
    preview.style.padding = '0 4px'

    for (let i = 0; i < meta.cols * meta.rows; i++) {
      const cell = document.createElement('span')
      cell.className = 'icon-preset-preview-cell'
      cell.style.height = key === 'compact' ? '8px' : key === 'spacious' ? '12px' : '10px'
      preview.appendChild(cell)
    }

    const name = document.createElement('span')
    name.className = 'icon-preset-name'
    name.textContent = meta.name

    const desc = document.createElement('span')
    desc.className = 'icon-preset-desc'
    desc.textContent = meta.desc

    const detail = document.createElement('span')
    detail.className = 'icon-preset-detail'
    detail.textContent = meta.detail

    card.append(preview, name, desc, detail)
    row.appendChild(card)
  }
}
