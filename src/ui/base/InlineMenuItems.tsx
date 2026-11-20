import { Menu as BaseMenu } from '@base-ui/react/menu'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Icon } from '../icons/Icon'
import { MotionPanel } from '../motion/MotionPanel'
import type { InlineMenuAction } from './InlineMenu.js'
import { createMenuIntent, type MenuIntent, type MenuIntentSnapshot } from './menu-intent.js'
import { getInlineMenuActionLabel } from './menu-labels.js'
import { cx } from './utils'
import './menu.css'

const pathKey = (path: readonly string[]) => JSON.stringify(path)
const hasChildren = (action: InlineMenuAction) =>
  typeof action.children === 'function' || Boolean(action.children?.length)
const SUBMENU_OVERLAP_PX = 8
const SUBMENU_INSET_PX = 4 // Border-box inset: 3px padding and a 1px border.

export function useMenuCascade({
  actions,
  open,
  anchor,
  onClose
}: {
  actions: InlineMenuAction[]
  open: boolean
  anchor?: RefObject<HTMLElement | null>
  onClose?: () => void
}) {
  const enabled = actions.some(hasChildren)
  const levels = useRef(new Map<string, { element: HTMLElement; path: readonly string[] }>())
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const intentRef = useRef<MenuIntent | null>(null)
  const [snapshot, setSnapshot] = useState<MenuIntentSnapshot>({ openPath: [], hovered: null, pointer: false })
  if (!intentRef.current) {
    intentRef.current = createMenuIntent({
      geometry(depth) {
        const path = intentRef.current!.getSnapshot().openPath
        if (depth >= path.length) return null
        const parent = levels.current.get(pathKey(path.slice(0, depth)))?.element
        const submenu = levels.current.get(pathKey(path.slice(0, depth + 1)))?.element
        if (!parent || !submenu) return null
        return {
          parent: parent.getBoundingClientRect(),
          submenu: submenu.getBoundingClientRect(),
          side: submenu.dataset.side === 'left' ? 'left' : 'right'
        }
      },
      onChange: setSnapshot,
      onClose: () => closeRef.current?.()
    })
  }
  const intent = intentRef.current

  useEffect(() => {
    if (!enabled || !open) {
      intent.reset()
      return
    }
    function track(event: PointerEvent | DragEvent) {
      if ('pointerType' in event && event.pointerType !== 'mouse') return
      const target = event.target
      const path = intent.getSnapshot().openPath
      const level = [...levels.current.values()].find(({ element, path: prefix }) =>
        prefix.every((id, index) => path[index] === id) && target instanceof Node && element.contains(target))
      // Entering the child must cancel protection before evaluating its new pointer position.
      if (level) intent.enterLevel(level.path.length)
      else if (target instanceof Node && anchor?.current?.contains(target)) intent.enter()
      intent.move({ x: event.clientX, y: event.clientY })
      if (!level && !(target instanceof Node && anchor?.current?.contains(target))) intent.leave()
    }
    const leaveWindow = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && !event.relatedTarget) intent.leave()
    }
    const cancelDrag = () => intent.reset()
    const press = () => {
      intent.cancelPending()
      intent.enter()
    }
    document.addEventListener('pointermove', track, true)
    document.addEventListener('dragover', track, true)
    document.addEventListener('pointerout', leaveWindow)
    document.addEventListener('pointerdown', press, true)
    document.addEventListener('dragend', cancelDrag)
    document.addEventListener('drop', cancelDrag)
    return () => {
      intent.dispose()
      document.removeEventListener('pointermove', track, true)
      document.removeEventListener('dragover', track, true)
      document.removeEventListener('pointerout', leaveWindow)
      document.removeEventListener('pointerdown', press, true)
      document.removeEventListener('dragend', cancelDrag)
      document.removeEventListener('drop', cancelDrag)
    }
  }, [anchor, enabled, intent, open])

  const containsEventTarget = (
    event: { type?: string; target?: EventTarget | null; relatedTarget?: EventTarget | null } | undefined,
    prefix: readonly string[] = []
  ) => {
    const target = event?.type === 'focusout' ? event.relatedTarget : event?.target
    return target instanceof Node && [...levels.current.values()].some(({ element, path }) =>
      prefix.every((id, index) => path[index] === id) && element.contains(target))
  }

  return { active: open, enabled, intent, levels, snapshot, containsEventTarget }
}

type MenuCascade = ReturnType<typeof useMenuCascade>

export function InlineMenuItems({
  actions: source,
  cascade,
  closeOnSelect,
  path = [],
  submenuAttributes
}: {
  actions: InlineMenuAction[] | (() => InlineMenuAction[])
  cascade: MenuCascade
  closeOnSelect: boolean
  path?: readonly string[]
  submenuAttributes?: Record<string, string>
}) {
  const actions = useMemo(() => typeof source === 'function' ? source() : source, [source])
  const key = pathKey(path)
  const register = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const element = node.closest<HTMLElement>('[role="menu"]') || node
      cascade.levels.current.set(key, { element, path: JSON.parse(key) })
    } else {
      cascade.levels.current.delete(key)
    }
  }, [cascade.levels, key])
  const { intent, snapshot } = cascade
  const depth = path.length
  const live = cascade.active && path.every((id, index) => snapshot.openPath[index] === id)
  useEffect(() => {
    const activePath = intent.getSnapshot().openPath
    if (!(JSON.parse(key) as string[]).every((id, index) => activePath[index] === id)) return
    // Rendering new action objects does not invalidate a pending hover. Only a
    // removed/disabled row or changed submenu capability should cancel it.
    intent.reconcile(depth, actions.map(action => ({ id: action.id, disabled: action.disabled, submenu: hasChildren(action) })))
  }, [actions, depth, intent, key])
  const focusState = useRef({ live: false, pointer: true })
  useLayoutEffect(() => {
    const previous = focusState.current
    focusState.current = { live, pointer: snapshot.pointer }
    if (previous.live && previous.pointer === snapshot.pointer) return
    if (!live || !depth || snapshot.pointer || depth !== snapshot.openPath.length) return
    const menu = cascade.levels.current.get(key)?.element
    if (!menu || menu.contains(document.activeElement)) return
    // A controlled cascade opens outside Base UI's hover handler. When the
    // keyboard opens it, put focus in that level so Left/Escape reach the child.
    menu.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)')?.focus()
  }, [cascade.levels, depth, key, live, snapshot.openPath.length, snapshot.pointer])
  const items = actions.map(action => {
    const submenu = hasChildren(action)
    const row = { depth, id: action.id, submenu }
    const open = live && snapshot.openPath[depth] === action.id
    const label = getInlineMenuActionLabel(action)
    const highlighted = (keyboard: boolean) => snapshot.pointer
      ? snapshot.hovered?.depth === depth && snapshot.hovered.id === action.id
      : keyboard
    const content = (
      <>
        {action.icon ? (
          <Icon name={action.icon === 'Folder' && open ? 'FolderOpen' : action.icon} size={17} aria-hidden="true" />
        ) : null}
        {action.label}
      </>
    )
    const pointerHandlers = cascade.enabled ? {
      onPointerEnter(event) {
        if (!live || action.disabled || event.pointerType !== 'mouse' ||
          !event.currentTarget.contains(event.target)) return
        intent.enterLevel(depth)
        intent.hover(row, { x: event.clientX, y: event.clientY })
      },
      onPointerMove(event) {
        if (!live || action.disabled || event.pointerType !== 'mouse' ||
          !event.currentTarget.contains(event.target)) return
        intent.enterLevel(depth)
        intent.hover(row, { x: event.clientX, y: event.clientY })
      },
      onPointerLeave(event) {
        if (event.pointerType === 'mouse') intent.leaveRow(row)
      },
      onDragEnter(event) {
        if (live && !action.disabled && event.currentTarget.contains(event.target)) {
          intent.enterLevel(depth)
          intent.hover(row, { x: event.clientX, y: event.clientY }, true)
        }
      },
      onDragLeave(event) {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) intent.leaveRow(row)
      },
      // Base UI still owns clicks, focus, keyboard navigation and ARIA. Only
      // pointer hover is replaced, so its sibling-close timer cannot race ours.
      onMouseEnter(event) { event.preventBaseUIHandler() },
      onMouseMove(event) { event.preventBaseUIHandler() }
    } : {}

    const common = {
      ...action.attributes,
      ...pointerHandlers,
      disabled: action.disabled,
      label: typeof action.label === 'string' ? action.label : label,
      nativeButton: true,
      ref: action.itemRef,
      className: cx(cascade.enabled && 'curator-cascade-item', action.className || (action.destructive ? 'danger' : '')),
      render: (props, state) => (
        <button
          {...props}
          type="button"
          aria-label={label}
          data-cascade-highlighted={highlighted(state.highlighted) || undefined}
        />
      )
    }

    const itemNode = !submenu ? (
      <BaseMenu.Item
        {...common}
        closeOnClick={action.closeOnSelect ?? closeOnSelect}
        onClick={() => {
          if (cascade.enabled) intent.reset()
          void action.onSelect?.()
        }}
      >
        {content}
      </BaseMenu.Item>
    ) : (
      <BaseMenu.SubmenuRoot
        open={open}
        highlightItemOnHover={false}
        closeParentOnEsc
        onOpenChange={(nextOpen, details) => {
          if (!nextOpen && (details.reason === 'outside-press' || details.reason === 'focus-out') &&
            cascade.containsEventTarget(details.event, [...path, action.id])) {
            // Descendant menus are portalled outside this popup's DOM bounds.
            details.cancel()
            return
          }
          if (details.reason === 'trigger-hover' || details.reason === 'sibling-open') {
            details.cancel()
            return
          }
          if (!nextOpen && snapshot.pointer && details.reason === 'trigger-press') {
            // A mouse click confirms a submenu that opened during hover; it
            // must not toggle that newly opened branch closed.
            details.cancel()
            return
          }
          intent.setOpen(depth, action.id, nextOpen)
        }}
      >
        <BaseMenu.SubmenuTrigger {...common} openOnHover={false}>
          {content}
        </BaseMenu.SubmenuTrigger>
        {/* The root can be inline inside an overflow-clipped editor. Nested
            portals must escape that container, not inherit its clipping bounds. */}
        <BaseMenu.Portal container={typeof document === 'undefined' ? undefined : document.body}>
          <BaseMenu.Positioner
            side="right"
            align="start"
            sideOffset={-SUBMENU_OVERLAP_PX + (depth > 0 ? SUBMENU_INSET_PX : 0)}
            alignOffset={-SUBMENU_INSET_PX}
            positionMethod="fixed"
            sticky
            collisionAvoidance={{ side: 'flip', align: 'flip', fallbackAxisSide: 'none' }}
            collisionPadding={12}
            className="curator-cascade-positioner"
          >
            <BaseMenu.Popup
              {...submenuAttributes}
              aria-label={label}
              inert={!open}
              render={<MotionPanel variant="menu" className="curator-cascade-popup" />}
              onKeyDownCapture={() => intent.keyboard()}
              onScroll={() => {
                intent.cancelPending()
                const child = intent.getSnapshot().openPath[depth + 1]
                if (child) intent.setOpen(depth + 1, child, false)
              }}
            >
              <InlineMenuItems
                actions={action.children!}
                cascade={cascade}
                closeOnSelect={closeOnSelect}
                path={[...path, action.id]}
                submenuAttributes={submenuAttributes}
              />
            </BaseMenu.Popup>
          </BaseMenu.Positioner>
        </BaseMenu.Portal>
      </BaseMenu.SubmenuRoot>
    )

    return (
      <Fragment key={action.id}>
        {action.separatorBefore ? (
          <BaseMenu.Separator className="my-[1px] h-px bg-[var(--ui-divider,var(--ds-border-subtle))]" />
        ) : null}
        {itemNode}
      </Fragment>
    )
  })

  if (!cascade.enabled) return <>{items}</>
  return (
    <div ref={register} className="curator-menu-items" onKeyDownCapture={() => intent.keyboard()}>
      {items}
    </div>
  )
}
