import { Toggle as BaseToggle } from '@base-ui/react/toggle'
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group'
import { useMemo, useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react'
import { cx } from './utils'

type BaseToggleGroupProps = ComponentPropsWithoutRef<typeof BaseToggleGroup<string>>
type BaseToggleProps = ComponentPropsWithoutRef<typeof BaseToggle<string>>

export interface ToggleGroupItem {
  attributes?: Record<string, string | number | boolean | undefined>
  disabled?: boolean
  label: ReactNode
  value: string
}

export interface ToggleGroupProps extends Omit<BaseToggleGroupProps, 'children' | 'className' | 'defaultValue' | 'multiple' | 'value'> {
  className?: string
  defaultValue?: string
  itemClassName?: string
  items: ToggleGroupItem[]
  slidingIndicator?: boolean
  unstyled?: boolean
  value?: string
}

export function ToggleGroup({
  className,
  defaultValue,
  itemClassName,
  items,
  onValueChange,
  slidingIndicator = false,
  style,
  unstyled = false,
  value,
  ...props
}: ToggleGroupProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const controlledSelection = useMemo(() => value ? [value] : undefined, [value])
  const defaultSelection = useMemo(() => defaultValue ? [defaultValue] : undefined, [defaultValue])
  const selectedIndex = items.findIndex((item) => item.value === (value ?? uncontrolledValue))
  const motionStyle = {
    '--segment-count': Math.max(1, items.length),
    '--segment-index': Math.max(0, selectedIndex),
    '--segment-visible': selectedIndex < 0 ? 0 : 1
  } as CSSProperties
  const indicatorStyle: BaseToggleGroupProps['style'] = !slidingIndicator ? style
    : typeof style === 'function' ? (state) => ({ ...motionStyle, ...style(state) })
    : { ...motionStyle, ...style }

  return (
    <BaseToggleGroup
      className={cx(slidingIndicator && 't-segmented', unstyled ? className : cx(
        'base-toggle-group inline-flex items-center gap-1 rounded-ds-sm border border-ds-border bg-ds-surface-1 p-1',
        className
      ))}
      defaultValue={defaultSelection}
      multiple={false}
      onValueChange={(nextValue, eventDetails) => {
        if (value === undefined) setUncontrolledValue(nextValue[0])
        onValueChange?.(nextValue, eventDetails)
      }}
      style={indicatorStyle}
      value={controlledSelection}
      {...props}
    >
      {items.map((item) => (
        <ToggleGroupButton
          attributes={item.attributes}
          disabled={item.disabled}
          itemClassName={itemClassName}
          key={item.value}
          unstyled={unstyled}
          value={item.value}
        >
          {item.label}
        </ToggleGroupButton>
      ))}
    </BaseToggleGroup>
  )
}

interface ToggleGroupButtonProps extends Pick<BaseToggleProps, 'disabled' | 'value'> {
  attributes?: ToggleGroupItem['attributes']
  children: ReactNode
  itemClassName?: string
  unstyled?: boolean
}

function ToggleGroupButton({
  attributes,
  children,
  disabled,
  itemClassName,
  unstyled,
  value
}: ToggleGroupButtonProps) {
  return (
    <BaseToggle
      className={unstyled ? itemClassName : cx(
        'base-toggle-group-item touch-manipulation select-none rounded-ds-sm px-3 py-1.5 text-sm text-ds-text-secondary outline-none transition-[background-color,color,transform] duration-ds-fast ease-ds-standard data-[pressed]:bg-ds-hover data-[pressed]:text-ds-text-primary focus-visible:shadow-ds-focus active:scale-[var(--ds-press-scale)] disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100',
        itemClassName
      )}
      disabled={disabled}
      type="button"
      value={value}
      {...normalizeDataAttributes(attributes)}
    >
      {children}
    </BaseToggle>
  )
}

function normalizeDataAttributes(attributes: ToggleGroupItem['attributes']): Record<string, string | number | boolean> {
  if (!attributes) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(attributes).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
  )
}
