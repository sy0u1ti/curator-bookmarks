import { DotMatrixLoader } from '../../ui/base/DotMatrixLoader'
import { TextSwap } from '../../ui/motion/TextSwap'
import {
  LOADING_LABEL_BUTTON_LAYER_CLASS,
  LOADING_LABEL_BUTTON_LOADER_CLASS,
  LOADING_LABEL_BUTTON_RESERVE_CLASS,
  LOADING_LABEL_BUTTON_WRAPPER_CLASS
} from './loading-label-classes.js'
import type { LoadingLabelState } from './loading-label-types.js'

export function ButtonBusyLoadingLabel({
  busy,
  label,
  reserveLabels = [],
  variant = 'bar'
}: {
  busy: boolean
  label: string
  reserveLabels?: readonly string[]
  variant?: LoadingLabelState['variant']
}) {
  const labels = Array.from(new Set([...reserveLabels, label]))

  return (
    <span className={LOADING_LABEL_BUTTON_WRAPPER_CLASS}>
      {labels.map((reservedLabel) => (
        <span
          className={LOADING_LABEL_BUTTON_RESERVE_CLASS}
          aria-hidden="true"
          key={reservedLabel}
        >
          <span aria-hidden="true" />
          <span>{reservedLabel}</span>
          <span aria-hidden="true" />
        </span>
      ))}
      <span className={LOADING_LABEL_BUTTON_LAYER_CLASS}>
        <DotMatrixLoader
          variant={variant}
          className={[
            LOADING_LABEL_BUTTON_LOADER_CLASS,
            busy ? 'opacity-100' : 'opacity-0'
          ].join(' ')}
        />
        <TextSwap animate={busy} text={label} />
        <span aria-hidden="true" />
      </span>
    </span>
  )
}
