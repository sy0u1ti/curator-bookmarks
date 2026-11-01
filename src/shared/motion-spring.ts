export interface SpringAxis {
  position: number
  velocity: number
}

export interface SpringConfig {
  response: number
  damping: number
}

export const DEFAULT_SPRING: SpringConfig = { response: 0.42, damping: 0.84 }

/** Retarget the force, not the position or velocity, when an interaction reverses. */
export function advanceSpring(
  axis: SpringAxis,
  target: number,
  elapsedSeconds: number,
  { response, damping }: SpringConfig = DEFAULT_SPRING
): void {
  const elapsed = Math.min(1 / 30, Math.max(0, elapsedSeconds))
  const steps = Math.max(1, Math.ceil(elapsed * 240))
  const dt = elapsed / steps
  const stiffness = (2 * Math.PI / response) ** 2
  const friction = 4 * Math.PI * damping / response
  for (let step = 0; step < steps; step++) {
    axis.velocity += (stiffness * (target - axis.position) - friction * axis.velocity) * dt
    axis.position += axis.velocity * dt
  }
}

export function springSettled(
  axis: SpringAxis,
  target: number,
  distance = 0.25,
  speed = 4
): boolean {
  return Math.abs(target - axis.position) < distance && Math.abs(axis.velocity) < speed
}

