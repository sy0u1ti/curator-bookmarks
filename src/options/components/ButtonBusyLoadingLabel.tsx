import { BusyLoadingLabel } from './BusyLoadingLabel.js'
import {
  LOADING_LABEL_BUTTON_LOADER_CLASS,
  LOADING_LABEL_BUTTON_WRAPPER_CLASS
} from './loading-label-classes.js'
import type { LoadingLabelState } from './loading-label-types.js'

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
