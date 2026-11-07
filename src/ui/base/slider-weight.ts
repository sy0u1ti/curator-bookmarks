export interface SliderWeightOptions {
  min: number
  max: number
  step: number
  trackPixels: number
  detents?: readonly number[]
}

export interface SliderWeightState {
  position: number
  value: number
  detent: number | null
}

export const SLIDER_DRAG_RESISTANCE_PX = 2
export const SLIDER_DETENT_CAPTURE_PX = 2
export const SLIDER_DETENT_RELEASE_PX = 4

export function createSliderWeight(value: number): SliderWeightState {
  return { position: value, value, detent: null }
}

export function advanceSliderWeight(
  state: SliderWeightState,
  requested: number,
  options: SliderWeightOptions
): SliderWeightState {
  const { min, max, step, trackPixels, detents = [] } = options
  if (!Number.isFinite(requested) || !Number.isFinite(max - min) || max <= min ||
    !Number.isFinite(step) || step <= 0 || !Number.isFinite(trackPixels) || trackPixels <= 0) return state
  const target = Math.min(max, Math.max(min, requested))
  if (target === min || target === max) return createSliderWeight(target)
  const unit = (max - min) / trackPixels
  const resistance = Math.min(unit * SLIDER_DRAG_RESISTANCE_PX, (max - min) * 0.025)
  const releaseRadius = Math.min(unit * SLIDER_DETENT_RELEASE_PX, (max - min) * 0.025)
  const captureRadius = Math.min(unit * SLIDER_DETENT_CAPTURE_PX, (max - min) * 0.0125)
  const validDetents = detents.filter(value => Number.isFinite(value) && value > min && value < max &&
    Math.abs(snapSliderValue(value, min, max, step) - value) < step * 0.001)
  if (state.detent !== null && validDetents.includes(state.detent) && Math.abs(target - state.detent) <= releaseRadius) {
    return { position: state.detent, value: state.detent, detent: state.detent }
  }
  const detent = validDetents.find(value => Math.abs(target - value) <= captureRadius)
  if (detent !== undefined) return { position: detent, value: detent, detent }
  const distance = target - state.position
  const position = Math.abs(distance) <= resistance
    ? state.position
    : target - Math.sign(distance) * resistance
  return { position, value: snapSliderValue(position, min, max, step), detent: null }
}

function snapSliderValue(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step
  return Math.min(max, Math.max(min, Number(snapped.toPrecision(14))))
}
