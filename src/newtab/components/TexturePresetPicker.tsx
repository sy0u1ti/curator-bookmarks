import type { CSSProperties, KeyboardEvent } from 'react'
import { ToggleGroup } from '../../ui/base/ToggleGroup'
import { Icon } from '../../ui/icons/Icon'
import { TEXTURE_PRESETS, getTextureImageUrl, type TexturePreset } from '../texture-settings'
import { dispatchNewtabBackgroundSettingFieldChange } from '../newtab-background-settings-store'
import './texture-picker.css'

const items = TEXTURE_PRESETS.map(preset => ({
  value: preset.id,
  attributes: { 'data-texture-preset': preset.id },
  label: (
    <>
      <span className="texture-preset-swatch" aria-hidden="true" style={{
        '--texture-preview-image': `url("${getTextureImageUrl(preset.id)}")`
      } as CSSProperties} />
      <span className="texture-preset-label">{preset.label}</span>
      <Icon className="texture-preset-check" name="Check" size={13} aria-hidden="true" />
    </>
  )
}))

export function TexturePresetPicker({ value }: { value: TexturePreset }) {
  const moveRow = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-texture-preset]'))
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    const next = buttons[index + (event.key === 'ArrowDown' ? 2 : -2)]
    event.preventDefault()
    next?.focus()
  }
  return (
    <ToggleGroup
      id="background-texture-presets"
      aria-label="纹理样式"
      className="texture-preset-grid"
      itemClassName="texture-preset"
      items={items}
      onKeyDown={moveRow}
      onValueChange={values => {
        if (values[0]) dispatchNewtabBackgroundSettingFieldChange('texturePreset', values[0])
      }}
      value={value}
      unstyled
    />
  )
}
