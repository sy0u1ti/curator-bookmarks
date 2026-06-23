import { DotMatrixLoader } from '../../ui'
import { cx } from '../../ui'
import {
  LOADING_LABEL_BUTTON_LOADER_CLASS,
  LOADING_LABEL_BUTTON_WRAPPER_CLASS,
  LOADING_LABEL_STATUS_LOADER_CLASS,
  LOADING_LABEL_STATUS_WRAPPER_CLASS
} from './loading-label-classes.js'
import { useLoadingLabelState } from './loading-label-store.js'
import type { LoadingLabelState } from './loading-label-types.js'

export function getLoadingLabelWrapperClassName(className = ''): string {
  return cx(LOADING_LABEL_STATUS_WRAPPER_CLASS, className)
}

export function getLoadingLabelLoaderClassName(className = ''): string {
  return cx(LOADING_LABEL_STATUS_LOADER_CLASS, className)
}

export function BusyLoadingLabel({
  label,
  loaderClassName = '',
  variant = 'bar',
  wrapperClassName = ''
}: {
  label: string
  loaderClassName?: string
  variant?: LoadingLabelState['variant']
  wrapperClassName?: string
}) {
  return (
    <span className={getLoadingLabelWrapperClassName(wrapperClassName)}>
      <DotMatrixLoader variant={variant} className={getLoadingLabelLoaderClassName(loaderClassName)} />
      <span>{label}</span>
    </span>
  )
}

export function ButtonBusyLoadingLabel({
  label,
  variant = 'bar'
}: {
  label: string
  variant?: LoadingLabelState['variant']
}) {
  return (
    <BusyLoadingLabel
      label={label}
      loaderClassName={LOADING_LABEL_BUTTON_LOADER_CLASS}
      variant={variant}
      wrapperClassName={LOADING_LABEL_BUTTON_WRAPPER_CLASS}
    />
  )
}

export function StatusBusyLoadingLabel({
  label,
  variant = 'bar'
}: {
  label: string
  variant?: LoadingLabelState['variant']
}) {
  return (
    <BusyLoadingLabel
      label={label}
      loaderClassName={LOADING_LABEL_STATUS_LOADER_CLASS}
      variant={variant}
      wrapperClassName={LOADING_LABEL_STATUS_WRAPPER_CLASS}
    />
  )
}

export function LoadingLabel({
  fallback,
  stateKey
}: {
  fallback: LoadingLabelState
  stateKey: string
}) {
  const state = useLoadingLabelState(stateKey, fallback)

  if (!state.busy) {
    return <>{state.label}</>
  }

  return (
    <BusyLoadingLabel
      label={state.label}
      loaderClassName={state.loaderClass}
      variant={state.variant}
      wrapperClassName={state.wrapperClass}
    />
  )
}
