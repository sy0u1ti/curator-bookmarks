import { Combobox } from '@base-ui/react/combobox'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../../ui/icons/Icon'
import { MotionPanel } from '../../ui/motion/MotionPanel'
import { SECTION_META } from '../shared-options/constants'
import { searchSettings, type SettingsSearchItem } from '../settings-search'

export function SettingsSearch({ onNavigate }: { onNavigate: (hash: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const items = useMemo(() => searchSettings(query), [query])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey ||
        !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
      // A dialog owns its keyboard session. Do not pull focus out of a provider
      // editor, confirmation or mobile navigation.
      if (document.activeElement?.closest('[role="dialog"],[role="alertdialog"]')) return
      event.preventDefault()
      input.current?.focus()
      input.current?.select()
      if (input.current?.value.trim()) setOpen(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const navigate = (item: SettingsSearchItem | null) => {
    if (!item || composing) return
    setOpen(false)
    setQuery('')
    onNavigate(`#${item.id}`)
  }

  return (
    <div className="options-settings-search" role="search" aria-label="查找设置">
      <Combobox.Root
        items={items}
        filter={null}
        value={null}
        inputValue={query}
        open={open && Boolean(query.trim())}
        autoHighlight
        itemToStringLabel={(item: SettingsSearchItem) => item.label}
        onInputValueChange={(value, details) => {
          if (!['input-change', 'input-clear', 'clear-press'].includes(details.reason)) return
          setQuery(value)
          setOpen(Boolean(value.trim()))
        }}
        onOpenChange={setOpen}
        onValueChange={navigate}
      >
        <div className="options-settings-search-field">
          <Icon name="Search" size={15} aria-hidden="true" />
          <Combobox.Input
            id="options-settings-search"
            ref={input}
            aria-label="搜索设置"
            aria-keyshortcuts="Control+k Meta+k"
            placeholder="搜索设置"
            autoComplete="off"
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={(event) => {
              const isComposing = composing || event.nativeEvent.isComposing
              if (event.key === 'Enter' && isComposing) {
                event.preventDefault()
                event.stopPropagation()
              } else if (event.key === 'Escape' && !isComposing) {
                event.preventDefault()
                event.stopPropagation()
                if (open) setOpen(false)
                else setQuery('')
              }
            }}
          />
        </div>
        <Combobox.Portal>
          <Combobox.Positioner className="options-settings-search-positioner" side="bottom" align="start" sideOffset={6} collisionPadding={12}>
            <Combobox.Popup
              finalFocus={false}
              render={<MotionPanel variant="popover" className="options-settings-search-popup" />}
            >
              <Combobox.Empty className="options-settings-search-empty">没有匹配的设置</Combobox.Empty>
              <Combobox.List>
                {(item: SettingsSearchItem) => (
                  <Combobox.Item className="options-settings-search-item" key={item.id} value={item}>
                    <span>{item.label}</span>
                    {item.label !== SECTION_META[item.section].title &&
                      <span className="options-settings-search-section">{SECTION_META[item.section].title}</span>}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  )
}
