import { Switch as BaseSwitch } from '@base-ui/react/switch'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref
} from 'react'
import { cx } from './utils'

type BaseSwitchRootProps = ComponentPropsWithoutRef<typeof BaseSwitch.Root>

export type SwitchControlProps = Omit<BaseSwitchRootProps, 'className' | 'children' | 'inputRef'> & {
  className?: string
  inputRef?: Ref<HTMLInputElement>
  rootRef?: Ref<HTMLElement>
  syncInputState?: boolean
  thumbClassName?: string
  unstyled?: boolean
}

export type SwitchProps = SwitchControlProps & {
  children?: ReactNode
  label?: ReactNode
}

export function SwitchControl({
  className,
  checked: checkedProp,
  defaultChecked,
  disabled: disabledProp,
  inputRef,
  onCheckedChange,
  rootRef,
  syncInputState = false,
  thumbClassName,
  unstyled = false,
  ...props
}: SwitchControlProps) {
  const [checkedState, setCheckedState] = useState(() => Boolean(checkedProp ?? defaultChecked))
  const [disabledState, setDisabledState] = useState(() => Boolean(disabledProp))
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const checkedRef = useRef(Boolean(checkedProp ?? defaultChecked))
  const disabledRef = useRef(Boolean(disabledProp))
  const checkedControlledRef = useRef(checkedProp !== undefined)
  const disabledControlledRef = useRef(disabledProp !== undefined)

  const checked = checkedProp ?? checkedState
  const disabled = disabledProp ?? disabledState

  checkedRef.current = Boolean(checked)
  disabledRef.current = Boolean(disabled)
  checkedControlledRef.current = checkedProp !== undefined
  disabledControlledRef.current = disabledProp !== undefined

  const handleInputRef = useCallback((node: HTMLInputElement | null) => {
    inputElementRef.current = node
    assignRef(inputRef, node)
  }, [inputRef])

  const handleCheckedChange: BaseSwitchRootProps['onCheckedChange'] = (nextChecked, eventDetails) => {
    if (checkedProp === undefined) {
      setCheckedState(nextChecked)
    }
    onCheckedChange?.(nextChecked, eventDetails)
  }

  useLayoutEffect(() => {
    if (!syncInputState) {
      return undefined
    }

    const input = inputElementRef.current
    if (!input) {
      return undefined
    }

    const checkedDescriptor = findPropertyDescriptor(input, 'checked')
    const disabledDescriptor = findPropertyDescriptor(input, 'disabled')
    const ownCheckedDescriptor = Object.getOwnPropertyDescriptor(input, 'checked')
    const ownDisabledDescriptor = Object.getOwnPropertyDescriptor(input, 'disabled')

    if (!checkedDescriptor?.get || !checkedDescriptor.set || !disabledDescriptor?.get || !disabledDescriptor.set) {
      return undefined
    }

    Object.defineProperty(input, 'checked', {
      configurable: true,
      get() {
        return checkedDescriptor.get?.call(this)
      },
      set(value) {
        checkedDescriptor.set?.call(this, value)
        const nextChecked = Boolean(value)
        if (!checkedControlledRef.current && checkedRef.current !== nextChecked) {
          checkedRef.current = nextChecked
          setCheckedState(nextChecked)
        }
      }
    })

    Object.defineProperty(input, 'disabled', {
      configurable: true,
      get() {
        return disabledDescriptor.get?.call(this)
      },
      set(value) {
        disabledDescriptor.set?.call(this, value)
        const nextDisabled = Boolean(value)
        if (!disabledControlledRef.current && disabledRef.current !== nextDisabled) {
          disabledRef.current = nextDisabled
          setDisabledState(nextDisabled)
        }
      }
    })

    return () => {
      restorePropertyDescriptor(input, 'checked', ownCheckedDescriptor)
      restorePropertyDescriptor(input, 'disabled', ownDisabledDescriptor)
    }
  }, [syncInputState])

  return (
    <BaseSwitch.Root
      checked={checked}
      className={unstyled ? className : cx(
        'relative inline-block h-6 w-11 rounded-full border border-curator-border bg-curator-muted outline-none transition-colors data-[checked]:border-curator-border-strong data-[checked]:bg-curator-text focus-visible:border-[var(--ui-focus-ring)] focus-visible:ring-2 focus-visible:ring-white/14 data-[disabled]:opacity-50',
        className
      )}
      disabled={disabled}
      inputRef={handleInputRef}
      onCheckedChange={handleCheckedChange}
      ref={rootRef}
      {...props}
    >
      <BaseSwitch.Thumb
        className={unstyled ? thumbClassName : cx(
          'absolute left-0.5 top-0.5 size-5 rounded-full bg-curator-text-subtle transition-transform data-[checked]:translate-x-5 data-[checked]:bg-curator-bg',
          thumbClassName
        )}
      />
    </BaseSwitch.Root>
  )
}

export function Switch({ className, label, children, thumbClassName, ...props }: SwitchProps) {
  return (
    <label className="inline-flex items-center gap-3 text-sm text-curator-text">
      <SwitchControl className={className} thumbClassName={thumbClassName} {...props} />
      {label ?? children}
    </label>
  )
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) {
    return
  }
  if (typeof ref === 'function') {
    ref(value)
    return
  }
  ref.current = value
}

function findPropertyDescriptor(element: object, property: string): PropertyDescriptor | undefined {
  let prototype: object | null = Object.getPrototypeOf(element)
  while (prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property)
    if (descriptor) {
      return descriptor
    }
    prototype = Object.getPrototypeOf(prototype)
  }
  return undefined
}

function restorePropertyDescriptor(
  element: object,
  property: string,
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) {
    Object.defineProperty(element, property, descriptor)
    return
  }
  delete (element as Record<string, unknown>)[property]
}
