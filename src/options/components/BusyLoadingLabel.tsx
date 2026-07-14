import { DotMatrixLoader } from '../../ui/base/DotMatrixLoader'
import { cx } from '../../ui/base/utils'
import {
  LOADING_LABEL_STATUS_LOADER_CLASS,
  LOADING_LABEL_STATUS_WRAPPER_CLASS
} from './loading-label-classes.js'
import type { LoadingLabelState } from './loading-label-types.js'

function getLoadingLabelWrapperClassName(className = ''): string {
  return cx(LOADING_LABEL_STATUS_WRAPPER_CLASS, className)
}

function getLoadingLabelLoaderClassName(className = ''): string {
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
