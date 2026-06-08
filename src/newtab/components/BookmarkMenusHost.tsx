import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { Icon, type IconName } from '../../ui/icons/Icon'
import { Button } from '../../ui/primitives/Button'
import { InlineDialogPanel } from '../../ui/primitives/Dialog'
import { Input } from '../../ui/primitives/Input'
import { InlineMenuList, type InlineMenuAction } from '../../ui/primitives/Menu'
import { Select } from '../../ui/primitives/Select'
import {
  useNewtabBookmarkMenusView,
  type NewtabBookmarkAddMenuView,
  type NewtabBookmarkEditMenuView
} from '../newtab-bookmark-menu-store'
import type {
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

  useBookmarkMenuLayout(ref, {
    actionRefs,
    closing: view.closing,
    firstInputRef,
    focusAction: view.focusAction,
    focusFirst: view.focusFirst,
    x: view.menu.x,
    y: view.menu.y
  })

  return (
    <section
      className={view.closing ? 'bookmark-edit-menu is-closing' : 'bookmark-edit-menu'}
      style={{ left: `${view.menu.x}px`, top: `${view.menu.y}px` }}
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
  const className = [
    'bookmark-add-menu',
    view.menu.expanded ? 'expanded' : '',
    view.closing ? 'is-closing' : ''
  ].filter(Boolean).join(' ')

  useBookmarkMenuLayout(ref, {
    actionRefs,
    closing: view.closing,
    firstInputRef,
    focusFirst: view.focusFirst,
    x: view.menu.x,
    y: view.menu.y
  })

  return (
    <section
      className={className}
      style={{ left: `${view.menu.x}px`, top: `${view.menu.y}px` }}
      ref={ref}
    >
      <BookmarkAddMenu actionRefs={actionRefs} firstInputRef={firstInputRef} menu={view.menu} />
    </section>
  )
}

type BookmarkActionRefMap = Map<string, RefObject<HTMLElement | null>>

function useBookmarkActionRefs(actions: BookmarkMenuActionViewModel[]): BookmarkActionRefMap {
  const refMapRef = useRef<BookmarkActionRefMap>(new Map())

  return useMemo(() => {
    const next = new Map<string, RefObject<HTMLElement | null>>()
    for (const action of actions) {
      if (!action.actionId) {
        continue
      }
      next.set(action.actionId, refMapRef.current.get(action.actionId) ?? { current: null })
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
    focusFirst,
    x,
    y
  }: {
    actionRefs: BookmarkActionRefMap
    closing: boolean
    firstInputRef: RefObject<HTMLInputElement | null>
    focusAction?: string
    focusFirst: boolean
    x: number
    y: number
  }
) {
  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) {
      return
    }

    positionMenu(menu, x, y)

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
  }, [actionRefs, closing, firstInputRef, focusAction, focusFirst, ref, x, y])
}

function isDisabledFocusTarget(element: HTMLElement): boolean {
  return (element instanceof HTMLButtonElement && element.disabled) ||
    element.getAttribute('aria-disabled') === 'true'
}

function positionMenu(menu: HTMLElement, menuX: number, menuY: number): void {
  const margin = 8
  const rect = menu.getBoundingClientRect()
  const left = Math.max(
    margin,
    Math.min(menuX, window.innerWidth - rect.width - margin)
  )
  const top = Math.max(
    margin,
    Math.min(menuY, window.innerHeight - rect.height - margin)
  )
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
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
  return (
    <InlineDialogPanel
      className="bookmark-menu-popover-shell"
      aria-label="书签设置"
      initialFocus={false}
      finalFocus={false}
    >
      <BookmarkMenuTextField field={menu.fields[0]} inputRef={firstInputRef} />
      <BookmarkMenuTextField field={menu.fields[1]} />
      <div className="bookmark-menu-row">
        <span>图标</span>
        <Select
          disabled={menu.iconModeDisabled}
          inputAttributes={{ 'aria-label': '图标' }}
          itemClassName="custom-select-option"
          value={menu.iconMode}
          options={[
            { value: 'website', label: '网站图标' },
            { value: 'custom', label: '自定义图片' }
          ]}
          onValueChange={(value) => {
            void menu.onIconModeChange(value || menu.iconMode)
          }}
          popupClassName="custom-select-list"
          positionerClassName="custom-select-positioner"
          triggerClassName="bookmark-menu-control custom-select-trigger"
          unstyled
          valueClassName="custom-select-trigger-label"
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
          <BookmarkMenuTextField field={menu.fields[0]} inputRef={firstInputRef} />
          <BookmarkMenuTextField field={menu.fields[1]} />
          <BookmarkMenuSeparator />
          <BookmarkMenuActions actionRefs={actionRefs} actions={menu.actions} label="添加书签操作" />
        </>
      ) : (
        <Button
          className="bookmark-add-trigger"
          type="button"
          onClick={() => {
            void menu.onExpand()
          }}
          unstyled
        >
          <MenuActionIcon icon="plus" />
          添加书签
        </Button>
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
    <label className="bookmark-menu-row">
      <span>{field.label}</span>
      <Input
        className="bookmark-menu-input"
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
  return <div className="bookmark-menu-separator" />
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
      className="bookmark-menu-actions"
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
    className: action.variant ? `bookmark-menu-action ${action.variant}` : 'bookmark-menu-action',
    onSelect: action.onSelect,
    closeOnSelect: false,
    itemRef: action.actionId ? actionRefs.get(action.actionId) : undefined,
    attributes: {
      ...(action.actionId ? { 'data-menu-action': action.actionId } : {}),
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
      {error ? <p className="bookmark-menu-error">{error}</p> : null}
      {status ? (
        <p className={statusTone === 'warning' ? 'bookmark-menu-status is-warning' : 'bookmark-menu-status'}>
          {status}
        </p>
      ) : null}
    </>
  )
}
