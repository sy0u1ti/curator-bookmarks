import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type Ref
} from 'react'
import { cx } from './utils'

type NumberFieldRootProps = ComponentPropsWithoutRef<typeof BaseNumberField.Root>
type NumberFieldInputProps = ComponentPropsWithoutRef<typeof BaseNumberField.Input>

export type NumberInputProps = Omit<
  NumberFieldRootProps,
  'children' | 'className' | 'defaultValue' | 'id' | 'max' | 'min' | 'onValueChange' | 'step' | 'value'
> & {
  ariaLabel?: string
  className?: string
  defaultValue?: number | string
  id?: string
  inputClassName?: string
  inputMode?: NumberFieldInputProps['inputMode']
  inputRef?: Ref<HTMLInputElement>
  max?: number | string
  min?: number | string
  onValueChange?: NumberFieldRootProps['onValueChange']
  placeholder?: string
  rootClassName?: string
  step?: number | string
  syncInputState?: boolean
  unstyled?: boolean
  value?: number | string | null
}

export function NumberInput({
  ariaLabel,
  className,
  defaultValue,
  disabled,
  id,
  inputClassName,
  inputMode,
  inputRef,
  max,
  min,
  onValueChange,
  placeholder,
  rootClassName,
  step,
  syncInputState = false,
  unstyled = false,
  value,
  ...props
}: NumberInputProps) {
  const initialValue = normalizeNumber(value ?? defaultValue, null)
  const [valueState, setValueState] = useState<number | null>(initialValue)
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const hiddenInputElementRef = useRef<HTMLInputElement | null>(null)
  const valueRef = useRef<number | null>(initialValue)
  const valueControlledRef = useRef(value !== undefined)

  const currentValue = value !== undefined ? normalizeNumber(value, valueState) : valueState
  valueRef.current = currentValue
  valueControlledRef.current = value !== undefined

  const handleInputRef = useCallback((node: HTMLInputElement | null) => {
    inputElementRef.current = node
    assignRef(inputRef, node)
  }, [inputRef])

  const handleHiddenInputRef = useCallback((node: HTMLInputElement | null) => {
    hiddenInputElementRef.current = node
  }, [])

  const handleValueChange: NumberFieldRootProps['onValueChange'] = (nextValue, eventDetails) => {
    if (value === undefined) {
      setValueState(nextValue)
    }
    onValueChange?.(nextValue, eventDetails)
    if (syncInputState) {
      queueMicrotask(() => {
        inputElementRef.current?.dispatchEvent(new Event('input', { bubbles: true }))
        inputElementRef.current?.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }
  }

  useLayoutEffect(() => {
    const input = inputElementRef.current
    if (!input || !syncInputState) {
      return undefined
    }

    const hiddenInput = hiddenInputElementRef.current
    const valueDescriptor = findPropertyDescriptor(input, 'value')
    const ownValueDescriptor = Object.getOwnPropertyDescriptor(input, 'value')

    if (!valueDescriptor?.get || !valueDescriptor.set) {
      return undefined
    }

    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return hiddenInput?.value ?? valueDescriptor.get?.call(this)
      },
      set(nextValue) {
        valueDescriptor.set?.call(this, nextValue)
        if (hiddenInput) {
          hiddenInput.value = String(nextValue ?? '')
        }
        const normalizedValue = normalizeNumber(nextValue, valueRef.current)
        if (!valueControlledRef.current && valueRef.current !== normalizedValue) {
          valueRef.current = normalizedValue
          setValueState(normalizedValue)
        }
      }
    })

    return () => {
      restorePropertyDescriptor(input, 'value', ownValueDescriptor)
    }
  }, [syncInputState])

  return (
    <BaseNumberField.Root
      className={cx('base-number-field', rootClassName)}
      defaultValue={value === undefined ? normalizeNumber(defaultValue, undefined) : undefined}
      disabled={disabled}
      id={id}
      inputRef={handleHiddenInputRef}
      max={normalizeNumber(max, undefined)}
      min={normalizeNumber(min, undefined)}
      onValueChange={handleValueChange}
      step={normalizeStep(step)}
      value={value !== undefined ? currentValue : undefined}
      {...props}
    >
      <BaseNumberField.Input
        ref={handleInputRef}
        aria-label={ariaLabel}
        className={unstyled ? className : cx(
          'base-number-input h-9 w-full rounded-ds-sm border border-ds-border bg-ds-surface-1 px-3 text-sm text-ds-text-primary outline-none transition-colors placeholder:text-ds-text-muted focus:border-ds-focus focus:shadow-ds-focus disabled:opacity-50',
          className
        )}
        inputMode={inputMode}
        placeholder={placeholder}
      />
      <span className={cx('base-number-stepper', inputClassName)} aria-hidden="true" />
    </BaseNumberField.Root>
  )
}

function normalizeNumber(value: number | string | null | undefined, fallback: number | null): number | null
function normalizeNumber(value: number | string | null | undefined, fallback: undefined): number | undefined
function normalizeNumber(value: number | string | null | undefined, fallback: number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

function normalizeStep(value: number | string | null | undefined): number | 'any' | undefined {
  if (value === 'any') {
    return value
  }
  return normalizeNumber(value, undefined)
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
