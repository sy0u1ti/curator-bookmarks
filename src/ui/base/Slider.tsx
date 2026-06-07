import { Slider as BaseSlider } from '@base-ui/react/slider'
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type Ref
} from 'react'
import { cx } from './utils'

type BaseSliderRootProps = ComponentPropsWithoutRef<typeof BaseSlider.Root<number>>

export type SliderControlProps = Omit<
  BaseSliderRootProps,
  'children' | 'className' | 'defaultValue' | 'disabled' | 'max' | 'min' | 'onValueChange' | 'onValueCommitted' | 'step' | 'value'
> & {
  ariaLabel?: string
  className?: string
  controlClassName?: string
  defaultValue?: number | string
  disabled?: boolean
  indicatorClassName?: string
  inputAttributes?: Record<string, string | number | boolean | null | undefined>
  inputClassName?: string
  inputRef?: Ref<HTMLInputElement>
  max?: number | string
  min?: number | string
  onValueChange?: BaseSliderRootProps['onValueChange']
  onValueCommitted?: BaseSliderRootProps['onValueCommitted']
  rootId?: string
  step?: number | string
  syncInputState?: boolean
  thumbClassName?: string
  trackClassName?: string
  unstyled?: boolean
  value?: number | string
}

export function SliderControl({
  ariaLabel,
  className,
  controlClassName,
  defaultValue,
  disabled: disabledProp,
  id,
  indicatorClassName,
  inputAttributes,
  inputClassName,
  inputRef,
  max: maxProp,
  min: minProp,
  onValueChange,
  onValueCommitted,
  rootId,
  step: stepProp,
  syncInputState = false,
  thumbClassName,
  trackClassName,
  unstyled = false,
  value: valueProp,
  ...props
}: SliderControlProps) {
  const initialMin = normalizeNumber(minProp, 0)
  const initialMax = normalizeNumber(maxProp, 100)
  const initialStep = normalizeNumber(stepProp, 1)
  const initialValue = normalizeNumber(valueProp ?? defaultValue, initialMin)
  const [valueState, setValueState] = useState(initialValue)
  const [minState, setMinState] = useState(initialMin)
  const [maxState, setMaxState] = useState(initialMax)
  const [stepState, setStepState] = useState(initialStep)
  const [disabledState, setDisabledState] = useState(() => Boolean(disabledProp))
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const dispatchingLegacyEventRef = useRef(false)
  const valueRef = useRef(initialValue)
  const minRef = useRef(initialMin)
  const maxRef = useRef(initialMax)
  const stepRef = useRef(initialStep)
  const disabledRef = useRef(Boolean(disabledProp))
  const valueControlledRef = useRef(valueProp !== undefined)
  const minControlledRef = useRef(minProp !== undefined)
  const maxControlledRef = useRef(maxProp !== undefined)
  const stepControlledRef = useRef(stepProp !== undefined)
  const disabledControlledRef = useRef(disabledProp !== undefined)

  const minControlled = minProp !== undefined && !syncInputState
  const maxControlled = maxProp !== undefined && !syncInputState
  const stepControlled = stepProp !== undefined && !syncInputState
  const currentMin = minControlled ? normalizeNumber(minProp, minState) : minState
  const currentMax = maxControlled ? normalizeNumber(maxProp, maxState) : maxState
  const currentStep = Math.max(stepControlled ? normalizeNumber(stepProp, stepState) : stepState, Number.EPSILON)
  const currentValue = valueProp !== undefined ? normalizeNumber(valueProp, valueState) : valueState
  const resolvedMax = currentMax === currentMin ? currentMax + currentStep : currentMax
  const disabled = disabledProp ?? disabledState

  valueRef.current = currentValue
  minRef.current = currentMin
  maxRef.current = resolvedMax
  stepRef.current = currentStep
  disabledRef.current = Boolean(disabled)
  valueControlledRef.current = valueProp !== undefined
  minControlledRef.current = minControlled
  maxControlledRef.current = maxControlled
  stepControlledRef.current = stepControlled
  disabledControlledRef.current = disabledProp !== undefined

  const resolvedInputAttributes = useMemo(() => {
    const attributes: Record<string, string | number | boolean | null | undefined> = {
      ...inputAttributes
    }
    if (id) {
      attributes.id = id
    }
    if (ariaLabel) {
      attributes['aria-label'] = ariaLabel
    }
    return attributes
  }, [ariaLabel, id, inputAttributes])

  const handleInputRef = useCallback((node: HTMLInputElement | null) => {
    inputElementRef.current = node
    assignRef(inputRef, node)
  }, [inputRef])

  const syncInputValue = useCallback((nextValue: number) => {
    const input = inputElementRef.current
    if (input && input.value !== String(nextValue)) {
      input.value = String(nextValue)
    }
  }, [])

  const dispatchInputEvent = useCallback((type: 'change' | 'input') => {
    if (!syncInputState) {
      return
    }

    queueMicrotask(() => {
      const input = inputElementRef.current
      if (!input) {
        return
      }

      dispatchingLegacyEventRef.current = true
      try {
        input.dispatchEvent(new Event(type, { bubbles: true }))
      } finally {
        dispatchingLegacyEventRef.current = false
      }
    })
  }, [syncInputState])

  const handleValueChange: BaseSliderRootProps['onValueChange'] = (nextValue, eventDetails) => {
    if (dispatchingLegacyEventRef.current) {
      return
    }
    if (valueProp === undefined) {
      setValueState(nextValue)
    }
    syncInputValue(nextValue)
    onValueChange?.(nextValue, eventDetails)
    if (eventDetails.reason !== 'input-change') {
      dispatchInputEvent('input')
    }
  }

  const handleValueCommitted: BaseSliderRootProps['onValueCommitted'] = (nextValue, eventDetails) => {
    if (dispatchingLegacyEventRef.current) {
      return
    }
    syncInputValue(nextValue)
    onValueCommitted?.(nextValue, eventDetails)
    dispatchInputEvent('change')
  }

  useLayoutEffect(() => {
    const input = inputElementRef.current
    if (!input) {
      return undefined
    }

    const previousClassName = input.className
    const previousAttributes = new Map<string, string | null>()

    if (inputClassName !== undefined) {
      input.className = inputClassName
    }

    for (const [name, attributeValue] of Object.entries(resolvedInputAttributes)) {
      previousAttributes.set(name, input.getAttribute(name))
      if (attributeValue === false || attributeValue === null || attributeValue === undefined) {
        input.removeAttribute(name)
      } else {
        input.setAttribute(name, attributeValue === true ? '' : String(attributeValue))
      }
    }

    return () => {
      if (inputClassName !== undefined) {
        input.className = previousClassName
      }
      for (const [name, attributeValue] of previousAttributes) {
        if (attributeValue === null) {
          input.removeAttribute(name)
        } else {
          input.setAttribute(name, attributeValue)
        }
      }
    }
  }, [inputClassName, resolvedInputAttributes])

  useLayoutEffect(() => {
    if (!syncInputState) {
      return undefined
    }

    const input = inputElementRef.current
    if (!input) {
      return undefined
    }

    const valueDescriptor = findPropertyDescriptor(input, 'value')
    const disabledDescriptor = findPropertyDescriptor(input, 'disabled')
    const maxDescriptor = findPropertyDescriptor(input, 'max')
    const minDescriptor = findPropertyDescriptor(input, 'min')
    const stepDescriptor = findPropertyDescriptor(input, 'step')
    const ownValueDescriptor = Object.getOwnPropertyDescriptor(input, 'value')
    const ownDisabledDescriptor = Object.getOwnPropertyDescriptor(input, 'disabled')
    const ownMaxDescriptor = Object.getOwnPropertyDescriptor(input, 'max')
    const ownMinDescriptor = Object.getOwnPropertyDescriptor(input, 'min')
    const ownStepDescriptor = Object.getOwnPropertyDescriptor(input, 'step')

    if (
      !valueDescriptor?.get ||
      !valueDescriptor.set ||
      !disabledDescriptor?.get ||
      !disabledDescriptor.set ||
      !maxDescriptor?.get ||
      !maxDescriptor.set ||
      !minDescriptor?.get ||
      !minDescriptor.set ||
      !stepDescriptor?.get ||
      !stepDescriptor.set
    ) {
      return undefined
    }

    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        return valueDescriptor.get?.call(this)
      },
      set(nextValue) {
        valueDescriptor.set?.call(this, nextValue)
        const normalizedValue = normalizeNumber(nextValue, valueRef.current)
        if (!valueControlledRef.current && valueRef.current !== normalizedValue) {
          valueRef.current = normalizedValue
          setValueState(normalizedValue)
        }
      }
    })

    Object.defineProperty(input, 'disabled', {
      configurable: true,
      get() {
        return disabledDescriptor.get?.call(this)
      },
      set(nextDisabled) {
        disabledDescriptor.set?.call(this, nextDisabled)
        const normalizedDisabled = Boolean(nextDisabled)
        if (!disabledControlledRef.current && disabledRef.current !== normalizedDisabled) {
          disabledRef.current = normalizedDisabled
          setDisabledState(normalizedDisabled)
        }
      }
    })

    Object.defineProperty(input, 'max', {
      configurable: true,
      get() {
        return maxDescriptor.get?.call(this)
      },
      set(nextMax) {
        maxDescriptor.set?.call(this, nextMax)
        const normalizedMax = normalizeNumber(nextMax, maxRef.current)
        if (!maxControlledRef.current && maxRef.current !== normalizedMax) {
          maxRef.current = normalizedMax
          setMaxState(normalizedMax)
        }
      }
    })

    Object.defineProperty(input, 'min', {
      configurable: true,
      get() {
        return minDescriptor.get?.call(this)
      },
      set(nextMin) {
        minDescriptor.set?.call(this, nextMin)
        const normalizedMin = normalizeNumber(nextMin, minRef.current)
        if (!minControlledRef.current && minRef.current !== normalizedMin) {
          minRef.current = normalizedMin
          setMinState(normalizedMin)
        }
      }
    })

    Object.defineProperty(input, 'step', {
      configurable: true,
      get() {
        return stepDescriptor.get?.call(this)
      },
      set(nextStep) {
        stepDescriptor.set?.call(this, nextStep)
        const normalizedStep = normalizeNumber(nextStep, stepRef.current)
        if (!stepControlledRef.current && stepRef.current !== normalizedStep) {
          stepRef.current = normalizedStep
          setStepState(normalizedStep)
        }
      }
    })

    return () => {
      restorePropertyDescriptor(input, 'value', ownValueDescriptor)
      restorePropertyDescriptor(input, 'disabled', ownDisabledDescriptor)
      restorePropertyDescriptor(input, 'max', ownMaxDescriptor)
      restorePropertyDescriptor(input, 'min', ownMinDescriptor)
      restorePropertyDescriptor(input, 'step', ownStepDescriptor)
    }
  }, [syncInputState])

  return (
    <BaseSlider.Root
      id={rootId ?? (id ? `${id}-root` : undefined)}
      value={currentValue}
      min={currentMin}
      max={resolvedMax}
      step={currentStep}
      disabled={disabled}
      onValueChange={handleValueChange}
      onValueCommitted={handleValueCommitted}
      className={unstyled ? className : cx(
        'grid h-6 w-full items-center',
        className
      )}
      {...props}
    >
      <BaseSlider.Control
        className={unstyled ? controlClassName : cx(
          'relative h-6 w-full touch-none',
          controlClassName
        )}
      >
        <BaseSlider.Track
          className={unstyled ? trackClassName : cx(
            'absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-curator-muted',
            trackClassName
          )}
        >
          <BaseSlider.Indicator
            className={unstyled ? indicatorClassName : cx(
              'h-full rounded-full bg-curator-text',
              indicatorClassName
            )}
          />
        </BaseSlider.Track>
        <BaseSlider.Thumb
          className={unstyled ? thumbClassName : cx(
            'size-4 rounded-full border border-curator-border-strong bg-curator-text outline-none focus-within:ring-2 focus-within:ring-white/20',
            thumbClassName
          )}
          getAriaLabel={ariaLabel ? () => ariaLabel : undefined}
          inputRef={handleInputRef}
        />
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}

function normalizeNumber(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
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
