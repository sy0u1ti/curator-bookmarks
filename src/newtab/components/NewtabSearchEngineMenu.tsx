import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { Ref, RefObject } from 'react'
import { Icon } from '../../ui/icons/Icon'
import { MotionPanel } from '../../ui/motion/MotionPanel'
import type { NewtabSearchWidgetView, SearchEngineMenuState } from '../newtab-search-widget-store'
import {
  SEARCH_ENGINE_BUTTON_CLASS,
  SEARCH_ENGINE_CARET_CLASS,
  SEARCH_ENGINE_ITEM_CLASS,
  SEARCH_ENGINE_ITEM_INDICATOR_CLASS,
  SEARCH_ENGINE_MENU_CLASS,
  SEARCH_ENGINE_MENU_HINT_CLASS,
  SEARCH_ENGINE_MENU_ITEMS_CLASS,
  SEARCH_ENGINE_MENU_POSITIONER_CLASS
} from './searchWidgetClasses'

export function NewtabSearchEngineMenu({
  buttonRef,
  menuRef,
  view
}: {
  buttonRef: RefObject<HTMLButtonElement | null>
  menuRef: Ref<HTMLDivElement>
  view: NewtabSearchWidgetView
}) {
  const { engineMenu } = view

  return (
    <BaseMenu.Root
      open={engineMenu.open}
      modal={false}
      onOpenChange={(open) => {
        view.interactions.onEngineOpenChange(open)
      }}
    >
      <SearchWidgetEngineButton view={view} buttonRef={buttonRef} />
      <BaseMenu.Portal keepMounted>
        <BaseMenu.Positioner
          className={SEARCH_ENGINE_MENU_POSITIONER_CLASS}
          positionMethod="absolute"
          sideOffset={8}
        >
          <BaseMenu.Popup
            render={<MotionPanel variant="menu" className={SEARCH_ENGINE_MENU_CLASS} />}
            data-origin="top-right"
            aria-label="搜索引擎"
            finalFocus={buttonRef}
            ref={menuRef}
          >
            <SearchEngineMenu state={engineMenu} />
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}

function SearchWidgetEngineButton({
  buttonRef,
  view
}: {
  buttonRef: Ref<HTMLButtonElement>
  view: NewtabSearchWidgetView
}) {
  const { engine } = view.buttons

  return (
    <BaseMenu.Trigger
      className={SEARCH_ENGINE_BUTTON_CLASS}
      type="button"
      aria-label={engine.ariaLabel}
      disabled={engine.disabled}
      title={engine.title}
      onMouseDown={(event) => {
        if (!engine.disabled) {
          event.preventDefault()
          view.interactions.onEngineOpenChange(true)
        }
      }}
      ref={buttonRef}
    >
      {engine.label}
      <Icon name="ChevronDown" className={SEARCH_ENGINE_CARET_CLASS} size={12} aria-hidden="true" />
    </BaseMenu.Trigger>
  )
}

function SearchEngineMenu({ state }: { state: SearchEngineMenuState }) {
  return (
    <>
      <BaseMenu.RadioGroup
        className={SEARCH_ENGINE_MENU_ITEMS_CLASS}
        value={state.items.find((item) => item.active)?.id || ''}
      >
        {state.items.map((item) => (
          <BaseMenu.RadioItem
            className={SEARCH_ENGINE_ITEM_CLASS}
            closeOnClick={false}
            key={item.id}
            label={item.label}
            onClick={() => {
              void item.onSelect()
            }}
            value={item.id}
          >
            <span>{item.label}</span>
            <BaseMenu.RadioItemIndicator className={SEARCH_ENGINE_ITEM_INDICATOR_CLASS}>
              <Icon name="Check" size={12} aria-hidden="true" />
            </BaseMenu.RadioItemIndicator>
          </BaseMenu.RadioItem>
        ))}
      </BaseMenu.RadioGroup>
      <div className={SEARCH_ENGINE_MENU_HINT_CLASS}>{state.hint}</div>
    </>
  )
}
