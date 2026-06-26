import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Icon, type IconName } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { InlineDialogPanel } from '../../ui/base/Dialog'
import { Input } from '../../ui/base/Input'
import { InlineMenuList, type InlineMenuAction } from '../../ui/base/Menu'
import { Select } from '../../ui/base/Select'
import { cx } from '../../ui/base/utils'
import {
  useNewtabBookmarkMenusView,
  type NewtabBookmarkAddMenuView,
  type NewtabBookmarkEditMenuView
} from '../newtab-bookmark-menu-store'
import type {
  BookmarkIconMode,
  BookmarkAddMenuViewModel,
  BookmarkEditMenuViewModel,
  BookmarkMenuActionIcon,
  BookmarkMenuActionViewModel,
  BookmarkMenuTextFieldViewModel
} from '../bookmark-menu-view-models'

const MENU_ACTION_ICON_BY_ACTION: Record<BookmarkMenuActionIcon, IconName> = {
  copy: 'Copy',
  pin: 'Pin',
  plus: 'Plus',
  refresh: 'RefreshCw',
  save: 'Save',
  trash: 'Trash2'
}

const MENU_SURFACE_CLASS = 't-resize fixed z-[10030] overflow-hidden rounded-[var(--ui-radius-panel)] border border-[var(--ui-divider)] bg-[var(--ui-bg-main)] p-[10px_12px_12px] text-[var(--ui-text-primary)] shadow-[var(--ui-shadow-panel)] origin-top-right animate-[newtab-menu-enter_var(--dropdown-open-dur)_var(--dropdown-ease)_both] motion-reduce:animate-none'
const MENU_CLOSING_CLASS = 'pointer-events-none animate-[newtab-menu-exit_var(--dropdown-close-dur)_var(--dropdown-ease)_both] motion-reduce:animate-none'
const MENU_FULL_WIDTH_CLASS = 'w-[252px]'
const MENU_ADD_COLLAPSED_CLASS = 'w-[196px]'
const MENU_ROW_CLASS = 'grid min-h-9 grid-cols-[42px_minmax(0,1fr)] items-center gap-2 rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] px-0 py-[3px] text-[13px] leading-[1.3] text-[var(--ui-text-secondary)] shadow-none'
const MENU_ROW_LABEL_CLASS = 'min-w-0 pl-0.5 leading-[1.3]'
const MENU_CONTROL_CLASS = 'min-h-[30px] w-full min-w-0 rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-[9px] text-[13px] text-[var(--ui-text-primary)] outline-none placeholder:text-[var(--ui-text-disabled)] focus:border-[var(--ui-focus-ring)] focus:outline focus:outline-1 focus:outline-offset-2 focus:outline-[var(--ui-focus-ring)] focus-visible:border-[var(--ui-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus-ring)] disabled:opacity-60'
const MENU_SELECT_TRIGGER_CLASS = 'base-select-trigger flex min-h-[30px] w-full min-w-0 items-center justify-start rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] px-2 text-[13px] text-[var(--ui-text-primary)] outline-none data-[popup-open]:border-[var(--ui-focus-ring)] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] focus-visible:border-[var(--ui-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus-ring)] disabled:opacity-60'
const MENU_SELECT_POPUP_CLASS = 'custom-select-list z-[10040] max-h-60 min-w-[var(--anchor-width)] overflow-hidden rounded-[var(--ui-radius-panel)] border border-[var(--ui-divider)] bg-[var(--ui-bg-main)] p-1 text-[13px] text-[var(--ui-text-primary)] shadow-[var(--ui-shadow-panel)] outline-none'
const MENU_SELECT_OPTION_CLASS = 'flex cursor-default items-center justify-between gap-3 rounded-[var(--ui-radius-control)] px-2.5 py-2 outline-none data-[highlighted]:bg-[var(--ui-surface-hover)] data-[disabled]:opacity-45'
const MENU_ACTION_CLASS = 'bookmark-menu-action flex min-h-[30px] w-full cursor-pointer items-center justify-start gap-2.5 rounded-[var(--ui-radius-control)] bg-transparent px-2 text-left text-[13px] leading-none text-[var(--ui-text-primary)] outline-none hover:bg-[var(--ui-surface-hover)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:shadow-[0_0_0_3px_var(--ui-accent-soft)] disabled:cursor-default disabled:opacity-60 data-[disabled]:cursor-default data-[disabled]:opacity-60 [&_svg]:h-[17px] [&_svg]:w-[17px] [&_svg]:shrink-0'
const MENU_DANGER_ACTION_CLASS = 'text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)] focus-visible:bg-[var(--ui-danger-soft)]'
const MENU_SEPARATOR_CLASS = 'my-2 mx-0.5 h-px bg-[var(--ui-divider)]'
const MENU_ACTIONS_CLASS = 'grid gap-0.5'
const MENU_FEEDBACK_CLASS = 'mt-2 mx-0.5 rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] text-xs leading-[1.45] shadow-none'
const MENU_ERROR_CLASS = `${MENU_FEEDBACK_CLASS} text-[var(--ui-danger)]`
const MENU_STATUS_CLASS = `${MENU_FEEDBACK_CLASS} text-[var(--ui-accent-text)]`
const MENU_WARNING_STATUS_CLASS = `${MENU_FEEDBACK_CLASS} text-[var(--ui-warning)]`

export function BookmarkMenusHost() {
  const menus = useNewtabBookmarkMenusView()

  return (
    <>
      {menus.edit ? <BookmarkEditMenuHost view={menus.edit} /> : null}
      {menus.add ? <BookmarkAddMenuHost view={menus.add} /> : null}
    </>
  )
}

function BookmarkEditMenuHost({ view }: { view: NewtabBookmarkEditMenuView }) {
  const ref = useRef<HTMLElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)
  const actionRefs = useBookmarkActionRefs(view.menu.actions)
  const position = useBookmarkMenuPosition(ref, view.menu.x, view.menu.y)

  useBookmarkMenuLayout(ref, {
    actionRefs,
    closing: view.closing,
    firstInputRef,
    focusAction: view.focusAction,
    focusFirst: view.focusFirst
  })

  return (
    <section
      className={cx(
        'bookmark-edit-menu',
        MENU_SURFACE_CLASS,
        MENU_FULL_WIDTH_CLASS,
        view.closing && cx('is-closing', MENU_CLOSING_CLASS)
      )}
      data-newtab-bookmark-menu-surface=""
      style={{ left: position.left, top: position.top }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          view.menu.onCloseRequest()
        }
      }}
      ref={ref}
    >
      <BookmarkEditMenu actionRefs={actionRefs} firstInputRef={firstInputRef} menu={view.menu} />
    </section>
  )
}

function BookmarkAddMenuHost({ view }: { view: NewtabBookmarkAddMenuView }) {
  const ref = useRef<HTMLElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)
  const actionRefs = useBookmarkActionRefs(view.menu.actions)
  const position = useBookmarkMenuPosition(ref, view.menu.x, view.menu.y)
  const className = [
    'bookmark-add-menu',
    MENU_SURFACE_CLASS,
    view.menu.expanded ? cx('expanded', MENU_FULL_WIDTH_CLASS) : MENU_ADD_COLLAPSED_CLASS,
    view.closing ? cx('is-closing', MENU_CLOSING_CLASS) : ''
  ].filter(Boolean).join(' ')

  useBookmarkMenuLayout(ref, {
    actionRefs,
    closing: view.closing,
    firstInputRef,
    focusFirst: view.focusFirst
  })

  return (
    <section
      className={className}
      data-newtab-bookmark-menu-surface=""
      style={{ left: position.left, top: position.top }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          view.menu.onCloseRequest()
        }
      }}
      ref={ref}
    >
      <BookmarkAddMenu actionRefs={actionRefs} firstInputRef={firstInputRef} menu={view.menu} />
    </section>
  )
}

type BookmarkActionRefMap = Map<string, RefObject<HTMLElement | null>>

function useBookmarkActionRefs(actions: BookmarkMenuActionViewModel[]): BookmarkActionRefMap {
  const refMapRef = useRef<BookmarkActionRefMap | null>(null)
  if (refMapRef.current === null) {
    refMapRef.current = new Map()
  }

  return useMemo(() => {
    const next = new Map<string, RefObject<HTMLElement | null>>()
    for (const action of actions) {
      if (!action.actionId) {
        continue
      }
      next.set(action.actionId, refMapRef.current?.get(action.actionId) ?? { current: null })
    }
    refMapRef.current = next
    return next
  }, [actions])
}

function useBookmarkMenuLayout(
  ref: React.RefObject<HTMLElement | null>,
  {
    actionRefs,
    closing,
    firstInputRef,
    focusAction = '',
    focusFirst
  }: {
    actionRefs: BookmarkActionRefMap
    closing: boolean
    firstInputRef: RefObject<HTMLInputElement | null>
    focusAction?: string
    focusFirst: boolean
  }
) {
  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) {
      return
    }

    if (closing) {
      return
    }

    const focusedAction = focusAction ? actionRefs.get(focusAction)?.current : null
    if (focusedAction && !isDisabledFocusTarget(focusedAction)) {
      focusedAction.focus()
      return
    }

    const firstInput = firstInputRef.current
    if (focusFirst && firstInput) {
      firstInput.focus()
      firstInput.select()
    }
  }, [actionRefs, closing, firstInputRef, focusAction, focusFirst, ref])
}

function useBookmarkMenuPosition(
  ref: React.RefObject<HTMLElement | null>,
  x: number,
  y: number
) {
  const [position, setPosition] = useState(() => ({ left: x, top: y }))

  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) {
      setPosition((current) =>
        current.left === x && current.top === y ? current : { left: x, top: y }
      )
      return
    }

    const updatePosition = () => {
      const next = getClampedMenuPosition(menu, x, y)
      setPosition((current) =>
        current.left === next.left && current.top === next.top ? current : next
      )
    }

    updatePosition()

    const observer = new ResizeObserver(updatePosition)
    observer.observe(menu)
    window.addEventListener('resize', updatePosition)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updatePosition)
    }
  }, [ref, x, y])

  return position
}

function isDisabledFocusTarget(element: HTMLElement): boolean {
  return (element instanceof HTMLButtonElement && element.disabled) ||
    element.getAttribute('aria-disabled') === 'true'
}

function getClampedMenuPosition(
  menu: HTMLElement,
  menuX: number,
  menuY: number
): { left: number; top: number } {
  const margin = 16
  const menuWidth = menu.offsetWidth || menu.getBoundingClientRect().width
  const menuHeight = menu.offsetHeight || menu.getBoundingClientRect().height
  const viewport = getMenuViewportSize()
  const left = Math.max(
    margin,
    Math.min(menuX, viewport.width - menuWidth - margin)
  )
  const top = Math.max(
    margin,
    Math.min(menuY, viewport.height - menuHeight - margin)
  )
  return { left, top }
}

function getMenuViewportSize(): { width: number; height: number } {
  const visualViewport = window.visualViewport
  return {
    width: Math.min(
      window.innerWidth,
      visualViewport?.width ?? window.innerWidth
    ),
    height: Math.min(
      window.innerHeight,
      visualViewport?.height ?? window.innerHeight
    )
  }
}

function BookmarkEditMenu({
  actionRefs,
  firstInputRef,
  menu
}: {
  actionRefs: BookmarkActionRefMap
  firstInputRef: RefObject<HTMLInputElement | null>
  menu: BookmarkEditMenuViewModel
}) {
  const customIconInputRef = useRef<HTMLInputElement | null>(null)
  const handleIconModeChange = (nextMode: string | null) => {
    const normalizedMode: BookmarkIconMode = nextMode === 'custom' ? 'custom' : 'website'
    if (normalizedMode === 'website') {
      void menu.onIconModeChange('website')
      return
    }

    const input = customIconInputRef.current
    if (!input) {
      void menu.onCustomIconFileSelect(null)
      return
    }

    input.value = ''
    input.click()
  }

  return (
    <InlineDialogPanel
      className="bookmark-menu-popover-shell"
      aria-label="书签设置"
      initialFocus={false}
      finalFocus={false}
    >
      <BookmarkMenuTextField field={menu.fields[0]} inputRef={firstInputRef} />
      <BookmarkMenuTextField field={menu.fields[1]} />
      <div className={cx('bookmark-menu-row', MENU_ROW_CLASS)}>
        <span className={MENU_ROW_LABEL_CLASS}>图标</span>
        <Select
          ariaLabel="图标"
          disabled={menu.iconModeDisabled}
          itemClassName={MENU_SELECT_OPTION_CLASS}
          value={menu.iconMode}
          options={[
            { value: 'website', label: '网站图标' },
            { value: 'custom', label: '自定义图片' }
          ]}
          onValueChange={handleIconModeChange}
          popupAttributes={{ 'data-newtab-bookmark-menu-surface': '' }}
          popupClassName={MENU_SELECT_POPUP_CLASS}
          positionerClassName="z-[10040]"
          triggerClassName={MENU_SELECT_TRIGGER_CLASS}
          unstyled
          valueClassName="min-w-0 truncate"
        />
        <Input
          ref={customIconInputRef}
          type="file"
          accept="image/*"
          hidden
          tabIndex={-1}
          onChange={(event) => {
            const input = event.currentTarget
            void menu.onCustomIconFileSelect(input.files?.[0] || null)
            input.value = ''
          }}
          unstyled
        />
      </div>
      <BookmarkMenuSeparator />
      <BookmarkMenuActions actionRefs={actionRefs} actions={menu.actions} label="书签操作" />
      <BookmarkMenuFeedback error={menu.error} status={menu.status} statusTone={menu.statusTone} />
    </InlineDialogPanel>
  )
}

function BookmarkAddMenu({
  actionRefs,
  firstInputRef,
  menu
}: {
  actionRefs: BookmarkActionRefMap
  firstInputRef: RefObject<HTMLInputElement | null>
  menu: BookmarkAddMenuViewModel
}) {
  return (
    <InlineDialogPanel
      className="bookmark-menu-popover-shell"
      aria-label="添加新标签页书签"
      initialFocus={false}
      finalFocus={false}
    >
      {menu.expanded ? (
        <>
          <div className="bookmark-add-menu-content is-expanded">
            <BookmarkMenuTextField field={menu.fields[0]} inputRef={firstInputRef} />
            <BookmarkMenuTextField field={menu.fields[1]} />
            <BookmarkMenuSeparator />
            <BookmarkMenuActions actionRefs={actionRefs} actions={menu.actions} label="添加书签操作" />
          </div>
        </>
      ) : (
        <div className="bookmark-add-menu-content is-collapsed">
          <Button
            className={MENU_ACTION_CLASS}
            type="button"
            onClick={() => {
              void menu.onExpand()
            }}
            unstyled
          >
            <MenuActionIcon icon="plus" />
            添加书签
          </Button>
        </div>
      )}
      <BookmarkMenuFeedback error={menu.error} status="" />
    </InlineDialogPanel>
  )
}

function BookmarkMenuTextField({
  field,
  inputRef
}: {
  field: BookmarkMenuTextFieldViewModel
  inputRef?: RefObject<HTMLInputElement | null>
}) {
  return (
    <label className={cx('bookmark-menu-row', MENU_ROW_CLASS)}>
      <span className={MENU_ROW_LABEL_CLASS}>{field.label}</span>
      <Input
        className={MENU_CONTROL_CLASS}
        type={field.type}
        placeholder={field.placeholder}
        defaultValue={field.value}
        disabled={field.disabled}
        spellCheck={false}
        ref={inputRef}
        onChange={(event) => {
          field.onChange(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void field.onEnter()
          }
        }}
        unstyled
      />
    </label>
  )
}

function BookmarkMenuSeparator() {
  return <div className={MENU_SEPARATOR_CLASS} />
}

function BookmarkMenuActions({
  actionRefs,
  actions,
  label
}: {
  actionRefs: BookmarkActionRefMap
  actions: BookmarkMenuActionViewModel[]
  label: string
}) {
  return (
    <InlineMenuList
      actions={actions.map((action) => toInlineMenuAction(action, actionRefs))}
      className={MENU_ACTIONS_CLASS}
      label={label}
    />
  )
}

function toInlineMenuAction(
  action: BookmarkMenuActionViewModel,
  actionRefs: BookmarkActionRefMap
): InlineMenuAction {
  return {
    id: action.id,
    label: <BookmarkMenuActionContent icon={action.icon} label={action.label} />,
    disabled: action.disabled,
    destructive: action.variant === 'danger',
    className: cx(MENU_ACTION_CLASS, action.variant === 'danger' && MENU_DANGER_ACTION_CLASS),
    onSelect: action.onSelect,
    closeOnSelect: false,
    itemRef: action.actionId ? actionRefs.get(action.actionId) : undefined,
    attributes: {
      'aria-label': action.ariaLabel
    }
  }
}

function BookmarkMenuActionContent({ icon, label }: { icon: BookmarkMenuActionIcon; label: string }) {
  return (
    <>
      <MenuActionIcon icon={icon} />
      {label}
    </>
  )
}

function MenuActionIcon({ icon }: { icon: BookmarkMenuActionIcon }) {
  return <Icon name={MENU_ACTION_ICON_BY_ACTION[icon]} aria-hidden="true" />
}

function BookmarkMenuFeedback({
  error,
  status,
  statusTone
}: {
  error: string
  status: string
  statusTone?: 'warning' | ''
}) {
  return (
    <>
      {error ? <p className={MENU_ERROR_CLASS}>{error}</p> : null}
      {status ? (
        <p className={statusTone === 'warning' ? MENU_WARNING_STATUS_CLASS : MENU_STATUS_CLASS}>
          {status}
        </p>
      ) : null}
    </>
  )
}
