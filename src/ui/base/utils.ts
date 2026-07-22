import { clsx, type ClassValue } from 'clsx'

export function cx(...values: ClassValue[]): string {
  return clsx(...values)
}

export function cxState<State>(
  baseClassName: string,
  className: string | ((state: State) => string | undefined) | undefined
): string | ((state: State) => string) {
  if (typeof className === 'function') {
    return (state) => cx(baseClassName, className(state))
  }

  return cx(baseClassName, className)
}
