export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
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
