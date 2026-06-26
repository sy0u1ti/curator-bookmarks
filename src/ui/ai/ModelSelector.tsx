import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { SearchIcon, XIcon } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Button } from '../base/Button'
import { Input } from '../base/Input'
import { cx } from '../base/utils'

const MODEL_SELECTOR_TRIGGER_CLASS =
  'inline-flex min-h-[50px] w-full items-center justify-start gap-2 rounded-ds-sm border border-ds-border bg-ds-surface-2 px-3 text-sm font-semibold leading-none text-ds-text-primary shadow-none outline-none transition-[border-color,background-color,color] duration-ds-fast ease-ds-standard hover:not-disabled:border-ds-border-hover hover:not-disabled:bg-ds-surface-3 focus-visible:border-ds-focus focus-visible:bg-ds-surface-3 focus-visible:shadow-ds-focus disabled:cursor-not-allowed disabled:opacity-60'
const MODEL_SELECTOR_BACKDROP_CLASS =
  'fixed inset-0 z-[1200] min-h-dvh bg-ds-overlay transition-opacity duration-[var(--modal-open-dur)] ease-[var(--modal-ease)] data-ending-style:duration-[var(--modal-close-dur)] data-ending-style:opacity-0 data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute'
const MODEL_SELECTOR_CONTENT_CLASS =
  'fixed left-1/2 top-[46%] z-[1201] max-h-[min(520px,calc(100dvh-72px))] w-[min(520px,calc(100vw-36px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-ds-lg border border-ds-border bg-ds-surface-2 p-0 text-ds-text-primary shadow-ds-dialog outline-none transition-[opacity,transform] duration-[var(--modal-open-dur)] ease-[var(--modal-ease)] data-ending-style:duration-[var(--modal-close-dur)] data-ending-style:translate-y-[calc(-50%+8px)] data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:translate-y-[calc(-50%+8px)] data-starting-style:scale-[0.98] data-starting-style:opacity-0 max-[760px]:top-1/2 max-[760px]:w-[min(520px,calc(100vw-24px))]'
const MODEL_SELECTOR_COMMAND_CLASS = 'flex min-h-0 max-h-[inherit] flex-col bg-ds-surface-2'
const MODEL_SELECTOR_INPUT_WRAPPER_CLASS =
  'grid min-h-[50px] grid-cols-[18px_minmax(0,1fr)_18px] items-center gap-2.5 border-b border-ds-border-subtle px-3.5 text-ds-text-muted'
const MODEL_SELECTOR_INPUT_ICON_CLASS = 'size-[17px] text-ds-text-muted'
const MODEL_SELECTOR_CLEAR_BUTTON_CLASS =
  'm-0 inline-flex size-[22px] cursor-pointer items-center justify-center rounded-ds-sm border-0 bg-transparent p-0 text-ds-text-muted hover:bg-ds-hover hover:text-ds-text-primary focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline-none'
const MODEL_SELECTOR_CLEAR_SPACER_CLASS = 'size-[18px]'
const MODEL_SELECTOR_INPUT_CLASS =
  'h-[50px] min-h-[50px] w-full border-0 bg-transparent text-sm font-medium text-ds-text-primary shadow-none outline-none placeholder:text-ds-text-secondary'
const MODEL_SELECTOR_LIST_CLASS =
  'm-0 max-h-[min(400px,calc(100dvh-140px))] list-none overflow-y-auto p-1.5 [scrollbar-color:var(--ds-border-hover)_transparent] [scrollbar-width:thin]'
const MODEL_SELECTOR_EMPTY_CLASS = 'px-3 py-7 text-center text-[13px] text-ds-text-muted'
const MODEL_SELECTOR_GROUP_CLASS = 'mt-1.5 first:mt-0'
const MODEL_SELECTOR_GROUP_HEADING_CLASS = 'px-2 pb-1.5 pt-[5px] text-xs font-semibold leading-[1.2] text-ds-accent-text'
const MODEL_SELECTOR_GROUP_ITEMS_CLASS = 'grid list-none gap-px p-0'
const MODEL_SELECTOR_ITEM_CLASS =
  'grid min-h-8 w-full grid-cols-[16px_minmax(0,1fr)_auto_16px] items-center gap-2 rounded-ds-sm border-0 bg-transparent px-2 text-left text-sm font-semibold text-ds-text-primary outline-none hover:bg-ds-hover focus-visible:bg-ds-hover'
const MODEL_SELECTOR_ITEM_CURRENT_CLASS = 'bg-ds-selected text-ds-accent-text'
const MODEL_SELECTOR_LOGO_CLASS = 'size-3 flex-none object-contain invert'
const MODEL_SELECTOR_LOGO_GROUP_CLASS = 'ml-auto inline-flex flex-none items-center'
const MODEL_SELECTOR_TAG_CLASS =
  '-ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-ds-border bg-ds-surface-1 px-[5px] text-[9px] font-bold leading-none text-ds-text-secondary'
const MODEL_SELECTOR_NAME_CLASS = 'min-w-0 overflow-hidden text-left text-ellipsis whitespace-nowrap'
const MODEL_SELECTOR_SHORTCUT_CLASS = 'text-xs text-ds-text-muted'
const MODEL_SELECTOR_SEPARATOR_CLASS = 'my-1 border-0 border-t border-ds-border-subtle'

export type ModelSelectorProps = ComponentPropsWithoutRef<typeof BaseDialog.Root>

export function ModelSelector(props: ModelSelectorProps) {
  return <BaseDialog.Root {...props} />
}

export type ModelSelectorTriggerProps = ComponentPropsWithoutRef<typeof BaseDialog.Trigger>

export function ModelSelectorTrigger({ className, ...props }: ModelSelectorTriggerProps) {
  const resolvedClassName: ModelSelectorTriggerProps['className'] =
    typeof className === 'function'
      ? (state) => cx(MODEL_SELECTOR_TRIGGER_CLASS, className(state))
      : cx(MODEL_SELECTOR_TRIGGER_CLASS, className)

  return <BaseDialog.Trigger className={resolvedClassName} {...props} />
}

export interface ModelSelectorContentProps
  extends Omit<ComponentPropsWithoutRef<typeof BaseDialog.Popup>, 'className' | 'children' | 'title'> {
  backdropClassName?: string
  children: ReactNode
  className?: string
  title?: ReactNode
}

export function ModelSelectorContent({
  backdropClassName,
  children,
  className,
  title = 'Model Selector',
  ...props
}: ModelSelectorContentProps) {
  return (
    <BaseDialog.Portal keepMounted={false}>
      <BaseDialog.Backdrop className={cx(MODEL_SELECTOR_BACKDROP_CLASS, backdropClassName)} />
      <BaseDialog.Popup
        aria-describedby={undefined}
        className={cx(MODEL_SELECTOR_CONTENT_CLASS, className)}
        {...props}
      >
        <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
        <div className={MODEL_SELECTOR_COMMAND_CLASS}>{children}</div>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

export type ModelSelectorInputProps = ComponentPropsWithoutRef<typeof Input> & {
  onClear?: () => void
}

export function ModelSelectorInput({ className, onClear, value, ...props }: ModelSelectorInputProps) {
  return (
    <div className={MODEL_SELECTOR_INPUT_WRAPPER_CLASS}>
      <SearchIcon className={MODEL_SELECTOR_INPUT_ICON_CLASS} aria-hidden="true" />
      <Input className={cx(MODEL_SELECTOR_INPUT_CLASS, className)} unstyled value={value} {...props} />
      {onClear && value ? (
        <button
          type="button"
          className={MODEL_SELECTOR_CLEAR_BUTTON_CLASS}
          aria-label="清空模型搜索"
          onClick={onClear}
        >
          <XIcon className={MODEL_SELECTOR_INPUT_ICON_CLASS} aria-hidden="true" />
        </button>
      ) : (
        <span className={MODEL_SELECTOR_CLEAR_SPACER_CLASS} aria-hidden="true" />
      )}
    </div>
  )
}

export type ModelSelectorListProps = ComponentPropsWithoutRef<'ul'>

export function ModelSelectorList({ className, ...props }: ModelSelectorListProps) {
  return <ul className={cx(MODEL_SELECTOR_LIST_CLASS, className)} {...props} />
}

export type ModelSelectorEmptyProps = ComponentPropsWithoutRef<'li'>

export function ModelSelectorEmpty({ className, ...props }: ModelSelectorEmptyProps) {
  return <li className={cx(MODEL_SELECTOR_EMPTY_CLASS, className)} {...props} />
}

export interface ModelSelectorGroupProps extends ComponentPropsWithoutRef<'li'> {
  heading: ReactNode
}

export function ModelSelectorGroup({ children, className, heading, ...props }: ModelSelectorGroupProps) {
  return (
    <li className={cx(MODEL_SELECTOR_GROUP_CLASS, className)} {...props}>
      <div className={MODEL_SELECTOR_GROUP_HEADING_CLASS}>{heading}</div>
      <ul className={MODEL_SELECTOR_GROUP_ITEMS_CLASS}>{children}</ul>
    </li>
  )
}

export interface ModelSelectorItemProps extends Omit<ComponentPropsWithoutRef<typeof Button>, 'onSelect' | 'render'> {
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
    <li>
      <Button
        className={cx(MODEL_SELECTOR_ITEM_CLASS, current ? MODEL_SELECTOR_ITEM_CURRENT_CLASS : '', className)}
        type="button"
        aria-current={current ? 'true' : undefined}
        data-ai-model-id={value}
        unstyled
        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) {
            onSelect?.()
          }
        }}
        {...props}
      >
        {children}
      </Button>
    </li>
  )
}

export type ModelSelectorShortcutProps = ComponentPropsWithoutRef<'span'>

export function ModelSelectorShortcut({ className, ...props }: ModelSelectorShortcutProps) {
  return <span className={cx(MODEL_SELECTOR_SHORTCUT_CLASS, className)} {...props} />
}

export type ModelSelectorSeparatorProps = ComponentPropsWithoutRef<'hr'>

export function ModelSelectorSeparator({ className, ...props }: ModelSelectorSeparatorProps) {
  return <hr className={cx(MODEL_SELECTOR_SEPARATOR_CLASS, className)} {...props} />
}

export interface ModelSelectorLogoProps extends Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'> {
  provider: string
}

export function ModelSelectorLogo({ provider, className, ...props }: ModelSelectorLogoProps) {
  return (
    <img
      alt={`${provider} logo`}
      className={cx(MODEL_SELECTOR_LOGO_CLASS, className)}
      height={12}
      src={`https://models.dev/logos/${provider}.svg`}
      width={12}
      {...props}
    />
  )
}

export type ModelSelectorLogoGroupProps = ComponentPropsWithoutRef<'div'>

export function ModelSelectorLogoGroup({ className, ...props }: ModelSelectorLogoGroupProps) {
  return <div className={cx(MODEL_SELECTOR_LOGO_GROUP_CLASS, className)} {...props} />
}

export type ModelSelectorNameProps = ComponentPropsWithoutRef<'span'>

export function ModelSelectorName({ className, ...props }: ModelSelectorNameProps) {
  return <span className={cx(MODEL_SELECTOR_NAME_CLASS, className)} {...props} />
}

export type ModelSelectorTagProps = ComponentPropsWithoutRef<'span'>

export function ModelSelectorTag({ className, ...props }: ModelSelectorTagProps) {
  return <span className={cx(MODEL_SELECTOR_TAG_CLASS, className)} {...props} />
}
