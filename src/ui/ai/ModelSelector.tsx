import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '../primitives/utils'

export type ModelSelectorProps = ComponentPropsWithoutRef<typeof BaseDialog.Root>

export function ModelSelector(props: ModelSelectorProps) {
  return <BaseDialog.Root {...props} />
}

export type ModelSelectorTriggerProps = ComponentPropsWithoutRef<typeof BaseDialog.Trigger>

export function ModelSelectorTrigger(props: ModelSelectorTriggerProps) {
  return <BaseDialog.Trigger {...props} />
}

export interface ModelSelectorContentProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseDialog.Popup>, 'className' | 'children'> {
  children: ReactNode
  className?: string
  dialogTitle?: ReactNode
}

export function ModelSelectorContent({
  children,
  className,
  dialogTitle = 'Model Selector',
  ...props
}: ModelSelectorContentProps) {
  return (
    <BaseDialog.Portal keepMounted={false}>
      <BaseDialog.Backdrop className="model-selector-backdrop" />
      <BaseDialog.Popup className={cx('model-selector-content', className)} {...props}>
        <BaseDialog.Title className="sr-only">{dialogTitle}</BaseDialog.Title>
        <div className="model-selector-command">{children}</div>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

export type ModelSelectorInputProps = ComponentPropsWithoutRef<'input'>

export function ModelSelectorInput({ className, ...props }: ModelSelectorInputProps) {
  return (
    <div className="model-selector-input-wrapper">
      <input className={cx('model-selector-input', className)} {...props} />
    </div>
  )
}

export type ModelSelectorListProps = ComponentPropsWithoutRef<'div'>

export function ModelSelectorList({ className, ...props }: ModelSelectorListProps) {
  return <div className={cx('model-selector-list', className)} role="listbox" {...props} />
}

export type ModelSelectorEmptyProps = ComponentPropsWithoutRef<'div'>

export function ModelSelectorEmpty({ className, ...props }: ModelSelectorEmptyProps) {
  return <div className={cx('model-selector-empty', className)} {...props} />
}

export interface ModelSelectorGroupProps extends ComponentPropsWithoutRef<'div'> {
  heading: ReactNode
}

export function ModelSelectorGroup({ children, className, heading, ...props }: ModelSelectorGroupProps) {
  return (
    <div className={cx('model-selector-group', className)} role="group" {...props}>
      <div className="model-selector-group-heading">{heading}</div>
      <div className="model-selector-group-items">{children}</div>
    </div>
  )
}

export interface ModelSelectorItemProps extends Omit<ComponentPropsWithoutRef<'button'>, 'onSelect'> {
  current?: boolean
  onSelect?: () => void
  value: string
}

export function ModelSelectorItem({
  children,
  className,
  current = false,
  onClick,
  onSelect,
  value,
  ...props
}: ModelSelectorItemProps) {
  return (
    <button
      className={cx('model-selector-item', current ? 'current' : '', className)}
      type="button"
      role="option"
      aria-selected={current ? 'true' : 'false'}
      data-ai-model-id={value}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          onSelect?.()
        }
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export type ModelSelectorShortcutProps = ComponentPropsWithoutRef<'span'>

export function ModelSelectorShortcut({ className, ...props }: ModelSelectorShortcutProps) {
  return <span className={cx('model-selector-shortcut', className)} {...props} />
}

export type ModelSelectorSeparatorProps = ComponentPropsWithoutRef<'div'>

export function ModelSelectorSeparator({ className, ...props }: ModelSelectorSeparatorProps) {
  return <div className={cx('model-selector-separator', className)} role="separator" {...props} />
}

export interface ModelSelectorLogoProps extends Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'> {
  provider: string
}

export function ModelSelectorLogo({ provider, className, ...props }: ModelSelectorLogoProps) {
  return (
    <img
      alt={`${provider} logo`}
      className={cx('model-selector-logo', className)}
      height={12}
      src={`https://models.dev/logos/${provider}.svg`}
      width={12}
      {...props}
    />
  )
}

export type ModelSelectorLogoGroupProps = ComponentPropsWithoutRef<'div'>

export function ModelSelectorLogoGroup({ className, ...props }: ModelSelectorLogoGroupProps) {
  return <div className={cx('model-selector-logo-group', className)} {...props} />
}

export type ModelSelectorNameProps = ComponentPropsWithoutRef<'span'>

export function ModelSelectorName({ className, ...props }: ModelSelectorNameProps) {
  return <span className={cx('model-selector-name', className)} {...props} />
}
