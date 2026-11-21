import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref,
  type RefObject
} from 'react'
import { MotionPanel } from '../motion/MotionPanel'
import {
  computeDialogAnchorStyle,
  isPopupSurfaceDocument,
  type AnchorPoint
} from '../../shared/anchor-origin'
import { shouldSkipMotion } from '../../shared/motion'
import { getRecentPointerAnchor } from '../../shared/motion-preferences'
import { assignRef } from './input-sync'
import { cx, cxState } from './utils'
import { SurfaceMaterial } from './SurfaceMaterial'
import './dialog-layout.css'

interface DialogAnchorContextValue {
  open: boolean
  triggerId?: string | null
  openerRef: RefObject<HTMLElement | null>
  pointerRef: RefObject<AnchorPoint | null>
}

const DialogAnchorContext = createContext<DialogAnchorContextValue | null>(null)

export interface DialogAnchorProviderProps {
  open: boolean
  triggerId?: string | null
  children: ReactNode
}

export function DialogAnchorProvider({
  open,
  triggerId,
  children
}: DialogAnchorProviderProps) {
  const wasOpenRef = useRef(false)
  const openerRef = useRef<HTMLElement | null>(null)
  const pointerRef = useRef<AnchorPoint | null>(null)

  if (open && !wasOpenRef.current) {
    openerRef.current = typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
      ? document.activeElement
      : null
    pointerRef.current = getRecentPointerAnchor()
  }
  wasOpenRef.current = open

  const anchorContext = useMemo<DialogAnchorContextValue>(
    () => ({ open, triggerId, openerRef, pointerRef }),
    [open, triggerId]
  )

  return (
    <DialogAnchorContext.Provider value={anchorContext}>
      {children}
    </DialogAnchorContext.Provider>
  )
}

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

type BaseDialogRootProps = ComponentPropsWithoutRef<typeof BaseDialog.Root>
type BaseDialogPortalProps = ComponentPropsWithoutRef<typeof BaseDialog.Portal>
type BaseDialogPopupProps = ComponentPropsWithoutRef<typeof BaseDialog.Popup>
type BaseDialogTitleProps = ComponentPropsWithoutRef<typeof BaseDialog.Title>
type BaseDialogDescriptionProps = ComponentPropsWithoutRef<typeof BaseDialog.Description>
type BaseDialogBackdropProps = ComponentPropsWithoutRef<typeof BaseDialog.Backdrop>
type BaseDialogCloseProps = ComponentPropsWithoutRef<typeof BaseDialog.Close>

type DialogTitleElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export interface DialogOverlayProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  open: boolean
  onOpenChange?: (open: boolean, event?: Event) => void
  onOpenChangeComplete?: BaseDialogRootProps['onOpenChangeComplete']
  triggerId?: string | null
  modal?: BaseDialogRootProps['modal']
  disablePointerDismissal?: BaseDialogRootProps['disablePointerDismissal']
  keepMounted?: BaseDialogPortalProps['keepMounted']
  portalContainer?: BaseDialogPortalProps['container']
  ref?: Ref<HTMLDivElement>
}

export function DialogOverlay({
  open,
  onOpenChange,
  onOpenChangeComplete,
  triggerId,
  modal,
  disablePointerDismissal,
  keepMounted = true,
  portalContainer,
  children,
  ref,
  ...overlayProps
}: DialogOverlayProps) {
  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        onOpenChange?.(nextOpen, eventDetails.event)
      }}
      onOpenChangeComplete={onOpenChangeComplete}
      triggerId={triggerId}
      modal={modal}
      disablePointerDismissal={disablePointerDismissal}
    >
      <BaseDialog.Portal keepMounted={keepMounted} container={portalContainer}>
        <DialogAnchorProvider open={open} triggerId={triggerId}>
          <div ref={ref} {...overlayProps}>{children}</div>
        </DialogAnchorProvider>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

export interface DialogPanelProps extends Omit<BaseDialogPopupProps, 'className' | 'render'> {
  className?: string
  motionVariant?: ComponentPropsWithoutRef<typeof MotionPanel>['variant']
  motionClassName?: string
  ref?: Ref<HTMLDivElement>
  unanimated?: boolean
  layout?: 'centered' | 'workspace'
}

export function DialogPanel({
  className,
  motionClassName,
  motionVariant = 'dialog',
  ref,
  unanimated = false,
  layout = 'centered',
  ...props
}: DialogPanelProps) {
  const anchorContext = useContext(DialogAnchorContext)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const handlePanelRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node
    assignRef(ref, node)
  }, [ref])

  useLayoutEffect(() => {
    if (unanimated || motionVariant !== 'dialog' || !anchorContext?.open) {
      return
    }
    if (isPopupSurfaceDocument()) {
      return
    }
    const panel = panelRef.current
    if (!panel) {
      return
    }
    if (shouldSkipMotion()) {
      panel.style.removeProperty('--curator-dialog-origin')
      panel.style.removeProperty('--curator-overlay-enter-x')
      panel.style.removeProperty('--curator-overlay-enter-y')
      return
    }

    const explicitTrigger = anchorContext.triggerId ? document.getElementById(anchorContext.triggerId) : null
    const candidateTrigger = explicitTrigger ?? anchorContext.openerRef.current
    const triggerElement = candidateTrigger && candidateTrigger.isConnected && !panel.contains(candidateTrigger)
      ? candidateTrigger
      : null
    const rawTriggerRect = triggerElement?.getBoundingClientRect() ?? null
    const triggerBox = rawTriggerRect && (rawTriggerRect.width > 0 || rawTriggerRect.height > 0)
      ? {
          left: rawTriggerRect.left,
          top: rawTriggerRect.top,
          width: rawTriggerRect.width,
          height: rawTriggerRect.height
        }
      : null

    panel.style.removeProperty('--curator-dialog-origin')
    panel.style.removeProperty('--curator-overlay-enter-x')
    panel.style.removeProperty('--curator-overlay-enter-y')

    const rect = panel.getBoundingClientRect()
    const width = panel.offsetWidth || rect.width
    const height = panel.offsetHeight || rect.height
    const panelBox = {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height
    }

    const anchor = computeDialogAnchorStyle(panelBox, triggerBox, anchorContext.pointerRef.current)
    panel.style.setProperty('--curator-dialog-origin', anchor.origin)
    panel.style.setProperty('--curator-overlay-enter-x', `${anchor.enterX}px`)
    panel.style.setProperty('--curator-overlay-enter-y', `${anchor.enterY}px`)
  }, [anchorContext, motionVariant, unanimated])

  if (unanimated) {
    return <BaseDialog.Popup ref={handlePanelRef} render={<SurfaceMaterial />} className={cx(layout === 'workspace' && 'curator-dialog-workspace', className)} {...props} />
  }

  return (
    <BaseDialog.Popup
      ref={handlePanelRef}
      render={<MotionPanel variant={motionVariant} className={cx(layout === 'workspace' && 'curator-dialog-workspace', className, motionClassName)} />}
      {...props}
    />
  )
}

export function DialogHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('curator-dialog-header', className)} {...props} />
}

export function DialogBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('curator-dialog-body', className)} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cx('curator-dialog-footer', className)} {...props} />
}

export interface InlineDialogPanelProps extends Omit<BaseDialogPopupProps, 'className' | 'render'> {
  className?: string
}

export function InlineDialogPanel({ className, ...props }: InlineDialogPanelProps) {
  const portalContainerRef = useRef<HTMLDivElement>(null)

  return (
    <BaseDialog.Root open modal={false}>
      <div ref={portalContainerRef} />
      <BaseDialog.Portal keepMounted container={portalContainerRef}>
        <BaseDialog.Popup className={className} {...props} />
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

export interface DialogTitleProps extends BaseDialogTitleProps {
  as?: DialogTitleElement
}

export function DialogTitle({ as, render, ...props }: DialogTitleProps) {
  return (
    <BaseDialog.Title
      render={render ?? (as ? createElement(as) : undefined)}
      {...props}
    />
  )
}

export function DialogDescription(props: BaseDialogDescriptionProps) {
  return <BaseDialog.Description {...props} />
}

export function DialogBackdrop({ className, ...props }: BaseDialogBackdropProps) {
  return <BaseDialog.Backdrop className={cxState('t-modal-backdrop', className)} {...props} />
}

export function DialogClose(props: BaseDialogCloseProps) {
  return <BaseDialog.Close {...props} />
}
