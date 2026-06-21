import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { TagCloudItem } from '../../shared/tag-cloud.js'

interface CloudParticle {
  element: HTMLElement
  tag: string
  tier: string
  layoutLeftPercent: number
  layoutTopPercent: number
  layoutX: number
  layoutY: number
  homeX: number
  homeY: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  width: number
  height: number
  collisionStrength: number
  mass: number
  phase: number
  flowStrength: number
  pointerId: number | null
  targetX: number
  targetY: number
  pointerOffsetX: number
  pointerOffsetY: number
  lastPointerX: number
  lastPointerY: number
  lastPointerTime: number
  pointerVelocityX: number
  pointerVelocityY: number
  dragStartX: number
  dragStartY: number
  dragged: boolean
}

interface TagCloudSimulation {
  root: HTMLElement
  particles: CloudParticle[]
  frameId: number
  lastTime: number
  resizeObserver?: ResizeObserver
  cleanup: () => void
}

const simulations = new WeakMap<HTMLElement, TagCloudSimulation>()
const MAX_STEP_SECONDS = 0.032
const FLOW_SPEED = 0.00018
const FLOW_FORCE = 18
const HOME_FORCE = 4.2
const POINTER_SPRING = 58
const COLLISION_FORCE = 0.34
const MIST_COLLISION_FORCE = 0.18
const BOUNDS_PADDING = 5
const HOME_DRIFT_SPEED = 13
const DRAG_REPEL_RADIUS = 150
const DRAG_REPEL_FORCE = 720
const DRAG_CLICK_SUPPRESS_MS = 260
const DRAG_RELEASE_INERTIA = 0.14
const DRAG_RELEASE_MAX_SPEED = 560

interface TagCloudPhysicsHandlers {
  consumeSuppressedClick: (tag: string) => boolean
  draggingTag: string
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void
  onWordPointerDown: (tag: string, event: ReactPointerEvent<HTMLElement>) => void
}

export function useTagCloudPhysics<TElement extends HTMLElement>(
  rootRef: RefObject<TElement | null>,
  items: TagCloudItem[],
  getWordElement: (tag: string) => HTMLElement | null,
  simulationKey: string
): TagCloudPhysicsHandlers {
  const [draggingTag, setDraggingTag] = useState('')
  const suppressedClickUntilRef = useRef<Map<string, number> | null>(null)
  if (suppressedClickUntilRef.current === null) {
    suppressedClickUntilRef.current = new Map()
  }

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return undefined
    }

    startTagCloudPhysics(root, items, getWordElement)
    return () => {
      stopTagCloudPhysics(root)
    }
  }, [getWordElement, items, rootRef, simulationKey])

  const onWordPointerDown = useCallback((tag: string, event: ReactPointerEvent<HTMLElement>) => {
    const simulation = rootRef.current ? simulations.get(rootRef.current) : undefined
    const particle = simulation?.particles.find((entry) => entry.tag === tag)
    if (!particle) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDraggingTag(tag)
    particle.pointerId = event.pointerId
    particle.dragStartX = event.clientX
    particle.dragStartY = event.clientY
    particle.pointerVelocityX = 0
    particle.pointerVelocityY = 0
    particle.dragged = false
    updatePointerTarget(simulation.root, particle, event.nativeEvent, true)
  }, [rootRef])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const simulation = rootRef.current ? simulations.get(rootRef.current) : undefined
    if (!simulation) {
      return
    }
    const particle = simulation.particles.find((entry) => entry.pointerId === event.pointerId)
    if (!particle) {
      return
    }
    event.preventDefault()
    if (Math.hypot(event.clientX - particle.dragStartX, event.clientY - particle.dragStartY) > 5) {
      particle.dragged = true
    }
    updatePointerTarget(simulation.root, particle, event.nativeEvent)
  }, [rootRef])

  const releasePointer = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const simulation = rootRef.current ? simulations.get(rootRef.current) : undefined
    if (!simulation) {
      return
    }
    const particle = simulation.particles.find((entry) => entry.pointerId === event.pointerId)
    if (!particle) {
      return
    }
    if (particle.dragged) {
      suppressedClickUntilRef.current?.set(particle.tag, Date.now() + DRAG_CLICK_SUPPRESS_MS)
    }
    updatePointerTarget(simulation.root, particle, event.nativeEvent)
    commitParticleHome(simulation.root, particle)
    applyReleaseInertia(particle)
    particle.pointerId = null
    particle.dragged = false
    setDraggingTag((currentTag) => currentTag === particle.tag ? '' : currentTag)
    particle.element.releasePointerCapture?.(event.pointerId)
  }, [rootRef])

  const consumeSuppressedClick = useCallback((tag: string) => {
    const suppressUntil = suppressedClickUntilRef.current?.get(tag) || 0
    if (suppressUntil > Date.now()) {
      return true
    }
    suppressedClickUntilRef.current?.delete(tag)
    return false
  }, [])

  return {
    consumeSuppressedClick,
    draggingTag,
    onPointerCancel: releasePointer,
    onPointerMove,
    onPointerUp: releasePointer,
    onWordPointerDown
  }
}

function startTagCloudPhysics(
  root: HTMLElement,
  items: TagCloudItem[],
  getWordElement: (tag: string) => HTMLElement | null
): void {
  stopTagCloudPhysics(root)

  const particles = items
    .map((item) => {
      const element = getWordElement(item.tag)
      return element ? createParticle(root, item, element) : null
    })
    .filter((particle): particle is CloudParticle => Boolean(particle))

  if (!particles.length) {
    return
  }

  const simulation: TagCloudSimulation = {
    root,
    particles,
    frameId: 0,
    lastTime: performance.now(),
    cleanup: () => undefined
  }

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => resetParticleHomes(root, particles))
    : undefined
  resizeObserver?.observe(root)
  simulation.resizeObserver = resizeObserver
  simulation.cleanup = () => {
    resizeObserver?.disconnect()
  }

  simulations.set(root, simulation)
  simulation.frameId = requestAnimationFrame((time) => stepSimulation(simulation, time))
}

function stopTagCloudPhysics(root?: HTMLElement | null): void {
  if (!root) {
    return
  }
  const simulation = simulations.get(root)
  if (!simulation) {
    return
  }
  cancelAnimationFrame(simulation.frameId)
  simulation.cleanup()
  simulations.delete(root)
}

function createParticle(root: HTMLElement, item: TagCloudItem, element: HTMLElement): CloudParticle {
  const rootRect = root.getBoundingClientRect()
  const leftPercent = item.leftPercent
  const topPercent = item.topPercent
  const homeX = rootRect.width * leftPercent / 100
  const homeY = rootRect.height * topPercent / 100
  const radius = Math.max(6, item.radiusPx)
  const measuredWidth = element.offsetWidth || 0
  const measuredHeight = element.offsetHeight || 0
  const modelWidth = Math.max(8, item.collisionWidthPx || radius * 1.65)
  const modelHeight = Math.max(6, item.collisionHeightPx || radius * 0.9)
  const tier = item.tier
  const width = Math.max(modelWidth, measuredWidth * getMeasuredCollisionScale(tier))
  const height = Math.max(modelHeight, measuredHeight * getMeasuredCollisionScale(tier))

  return {
    element,
    tag: item.tag,
    tier,
    layoutLeftPercent: item.leftPercent,
    layoutTopPercent: item.topPercent,
    layoutX: homeX,
    layoutY: homeY,
    homeX,
    homeY,
    x: homeX,
    y: homeY,
    vx: 0,
    vy: 0,
    radius,
    width,
    height,
    collisionStrength: clamp(0.04, 1, item.collisionStrength || 0.3),
    mass: Math.max(0.6, item.mass || 1),
    phase: item.phase || 0,
    flowStrength: Math.max(0.1, item.flowStrength || 0.5),
    pointerId: null,
    targetX: homeX,
    targetY: homeY,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    lastPointerX: homeX,
    lastPointerY: homeY,
    lastPointerTime: performance.now(),
    pointerVelocityX: 0,
    pointerVelocityY: 0,
    dragStartX: 0,
    dragStartY: 0,
    dragged: false
  }
}

function getMeasuredCollisionScale(tier: string): number {
  if (tier === 'core') {
    return 1.08
  }
  if (tier === 'body') {
    return 0.98
  }
  return 0.72
}

function resetParticleHomes(root: HTMLElement, particles: CloudParticle[]): void {
  const rootRect = root.getBoundingClientRect()
  for (const particle of particles) {
    const leftPercent = particle.layoutLeftPercent
    const topPercent = particle.layoutTopPercent
    particle.layoutX = rootRect.width * leftPercent / 100
    particle.layoutY = rootRect.height * topPercent / 100
    particle.homeX = particle.layoutX
    particle.homeY = particle.layoutY
  }
}

function updatePointerTarget(
  root: HTMLElement,
  particle: CloudParticle,
  event: PointerEvent,
  resetPointerOffset = false
): void {
  const rect = root.getBoundingClientRect()
  const pointerX = event.clientX - rect.left
  const pointerY = event.clientY - rect.top
  const time = performance.now()

  if (resetPointerOffset) {
    particle.pointerOffsetX = particle.x - pointerX
    particle.pointerOffsetY = particle.y - pointerY
    particle.lastPointerX = pointerX
    particle.lastPointerY = pointerY
    particle.lastPointerTime = time
  } else {
    const dt = Math.max(0.008, Math.min(0.08, (time - particle.lastPointerTime) / 1000))
    const sampleVelocityX = (pointerX - particle.lastPointerX) / dt
    const sampleVelocityY = (pointerY - particle.lastPointerY) / dt
    particle.pointerVelocityX = particle.pointerVelocityX * 0.45 + sampleVelocityX * 0.55
    particle.pointerVelocityY = particle.pointerVelocityY * 0.45 + sampleVelocityY * 0.55
    particle.lastPointerX = pointerX
    particle.lastPointerY = pointerY
    particle.lastPointerTime = time
  }

  const clamped = clampParticlePoint(
    particle,
    pointerX + particle.pointerOffsetX,
    pointerY + particle.pointerOffsetY,
    rect.width,
    rect.height
  )
  particle.targetX = clamped.x
  particle.targetY = clamped.y

  if (particle.pointerId !== null) {
    particle.x = clamped.x
    particle.y = clamped.y
  }
}

function stepSimulation(simulation: TagCloudSimulation, time: number): void {
  const dt = Math.min(MAX_STEP_SECONDS, Math.max(0.001, (time - simulation.lastTime) / 1000))
  simulation.lastTime = time

  driftParticleHomes(simulation, time, dt)
  applyForces(simulation, time, dt)
  applyDragRepulsion(simulation.particles, dt)
  solveCollisions(simulation.particles)
  applyBounds(simulation)
  renderParticles(simulation.particles)

  simulation.frameId = requestAnimationFrame((nextTime) => stepSimulation(simulation, nextTime))
}

function applyForces(simulation: TagCloudSimulation, time: number, dt: number): void {
  for (const particle of simulation.particles) {
    const flow = sampleFlow(particle.x, particle.y, time, particle.phase)
    const homeDx = particle.homeX - particle.x
    const homeDy = particle.homeY - particle.y
    const homeForce = HOME_FORCE * getHomeForceScale(particle)
    let ax = flow.x * FLOW_FORCE * particle.flowStrength + homeDx * homeForce / particle.mass
    let ay = flow.y * FLOW_FORCE * particle.flowStrength + homeDy * homeForce / particle.mass

    if (particle.pointerId !== null) {
      ax += (particle.targetX - particle.x) * POINTER_SPRING / particle.mass
      ay += (particle.targetY - particle.y) * POINTER_SPRING / particle.mass
    }

    const damping = getDamping(particle)
    particle.vx = (particle.vx + ax * dt) * damping
    particle.vy = (particle.vy + ay * dt) * damping
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
  }
}

function getHomeForceScale(particle: CloudParticle): number {
  if (particle.pointerId !== null) {
    return 0
  }
  if (particle.tier === 'core') {
    return 0.42
  }
  if (particle.tier === 'body') {
    return 0.22
  }
  return 0.08
}

function getDamping(particle: CloudParticle): number {
  if (particle.pointerId !== null) {
    return 0.86
  }
  if (particle.tier === 'core') {
    return 0.9
  }
  if (particle.tier === 'body') {
    return 0.88
  }
  return 0.84
}

function sampleFlow(x: number, y: number, time: number, phase: number): { x: number; y: number } {
  const t = time * FLOW_SPEED + phase
  const sx = Math.sin(y * 0.008 + t) + Math.sin((x + y) * 0.003 + t * 0.7)
  const sy = Math.cos(x * 0.007 - t * 0.9) + Math.sin((x - y) * 0.004 + t * 0.5)
  const length = Math.hypot(sx, sy) || 1
  return {
    x: sx / length,
    y: sy / length
  }
}

function driftParticleHomes(simulation: TagCloudSimulation, time: number, dt: number): void {
  const rect = simulation.root.getBoundingClientRect()
  for (const particle of simulation.particles) {
    if (particle.pointerId !== null) {
      continue
    }

    const flow = sampleFlow(particle.homeX, particle.homeY, time, particle.phase + 2.37)
    const driftSpeed = HOME_DRIFT_SPEED * getHomeDriftScale(particle) * particle.flowStrength
    const layoutBias = getLayoutBias(particle)
    particle.homeX += (flow.x * driftSpeed + (particle.layoutX - particle.homeX) * layoutBias) * dt
    particle.homeY += (flow.y * driftSpeed + (particle.layoutY - particle.homeY) * layoutBias) * dt
    const clamped = clampParticlePoint(particle, particle.homeX, particle.homeY, rect.width, rect.height)
    particle.homeX = clamped.x
    particle.homeY = clamped.y
  }
}

function getHomeDriftScale(particle: CloudParticle): number {
  if (particle.tier === 'core') {
    return 0.62
  }
  if (particle.tier === 'body') {
    return 1
  }
  return 1.48
}

function getLayoutBias(particle: CloudParticle): number {
  if (particle.tier === 'core') {
    return 0.055
  }
  if (particle.tier === 'body') {
    return 0.032
  }
  return 0.018
}

function commitParticleHome(root: HTMLElement, particle: CloudParticle): void {
  const rect = root.getBoundingClientRect()
  const clamped = clampParticlePoint(particle, particle.x, particle.y, rect.width, rect.height)
  particle.x = clamped.x
  particle.y = clamped.y
  particle.homeX = clamped.x
  particle.homeY = clamped.y
  particle.layoutX = clamped.x
  particle.layoutY = clamped.y
  particle.layoutLeftPercent = round(clamped.x / Math.max(1, rect.width) * 100, 2)
  particle.layoutTopPercent = round(clamped.y / Math.max(1, rect.height) * 100, 2)
  particle.targetX = clamped.x
  particle.targetY = clamped.y
}

function applyReleaseInertia(particle: CloudParticle): void {
  const speed = Math.hypot(particle.pointerVelocityX, particle.pointerVelocityY)
  if (speed <= 0.01) {
    particle.vx = 0
    particle.vy = 0
    return
  }

  const limitedSpeed = Math.min(DRAG_RELEASE_MAX_SPEED, speed * DRAG_RELEASE_INERTIA)
  const scale = limitedSpeed / speed
  particle.vx = particle.pointerVelocityX * scale
  particle.vy = particle.pointerVelocityY * scale
}

function applyDragRepulsion(particles: CloudParticle[], dt: number): void {
  const dragged = particles.find((particle) => particle.pointerId !== null)
  if (!dragged) {
    return
  }

  const influenceRadius = Math.max(DRAG_REPEL_RADIUS, dragged.width * 0.75)
  for (const particle of particles) {
    if (particle === dragged) {
      continue
    }

    const dx = particle.x - dragged.x
    const dy = particle.y - dragged.y
    const distance = Math.hypot(dx, dy) || 0.001
    if (distance > influenceRadius) {
      continue
    }

    const nx = dx / distance
    const ny = dy / distance
    const falloff = Math.pow(1 - distance / influenceRadius, 2)
    const strength = DRAG_REPEL_FORCE * falloff * (0.18 + particle.collisionStrength * 0.82)
    particle.vx += nx * strength * dt / particle.mass
    particle.vy += ny * strength * dt / particle.mass
  }
}

function solveCollisions(particles: CloudParticle[]): void {
  const cellSize = 44
  const grid = new Map<string, CloudParticle[]>()

  for (const particle of particles) {
    const bounds = getParticleBounds(particle, getCollisionPadding(particle))
    const minX = Math.floor(bounds.left / cellSize)
    const maxX = Math.floor(bounds.right / cellSize)
    const minY = Math.floor(bounds.top / cellSize)
    const maxY = Math.floor(bounds.bottom / cellSize)
    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gy = minY; gy <= maxY; gy += 1) {
        const key = `${gx}:${gy}`
        const bucket = grid.get(key) || []
        bucket.push(particle)
        grid.set(key, bucket)
      }
    }
  }

  const checked = new Set<string>()
  for (const bucket of grid.values()) {
    for (let leftIndex = 0; leftIndex < bucket.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bucket.length; rightIndex += 1) {
        const left = bucket[leftIndex]
        const right = bucket[rightIndex]
        const key = left.tag < right.tag ? `${left.tag}\u0000${right.tag}` : `${right.tag}\u0000${left.tag}`
        if (checked.has(key)) {
          continue
        }
        checked.add(key)
        resolvePair(left, right)
      }
    }
  }
}

function resolvePair(left: CloudParticle, right: CloudParticle): void {
  const dx = right.x - left.x
  const dy = right.y - left.y
  const leftPadding = getCollisionPadding(left)
  const rightPadding = getCollisionPadding(right)
  const overlapX = (left.width + right.width) / 2 + leftPadding + rightPadding - Math.abs(dx)
  const overlapY = (left.height + right.height) / 2 + leftPadding + rightPadding - Math.abs(dy)
  if (overlapX <= 0 || overlapY <= 0) {
    return
  }

  const bothMist = left.tier === 'mist' && right.tier === 'mist'
  const pairStrength = bothMist
    ? Math.max(0.18, (left.collisionStrength + right.collisionStrength) / 2)
    : Math.max(0.14, Math.max(left.collisionStrength, right.collisionStrength))
  const leftPinned = left.pointerId !== null
  const rightPinned = right.pointerId !== null
  const leftWeight = right.mass / (left.mass + right.mass)
  const rightWeight = left.mass / (left.mass + right.mass)
  const axisX = overlapX < overlapY
  const direction = axisX
    ? (dx >= 0 ? 1 : -1)
    : (dy >= 0 ? 1 : -1)
  const overlap = Math.min(overlapX, overlapY)
  const softness = leftPinned || rightPinned ? 1 : bothMist ? 0.48 : 0.74
  const force = bothMist ? MIST_COLLISION_FORCE : COLLISION_FORCE
  const push = Math.max(0, overlap - 0.35) * force * pairStrength * softness

  if (axisX) {
    if (!leftPinned) {
      left.x -= direction * push * leftWeight
      left.vx = (left.vx - direction * push * 0.05) * 0.88
    }
    if (!rightPinned) {
      right.x += direction * push * rightWeight
      right.vx = (right.vx + direction * push * 0.05) * 0.88
    }
  } else {
    if (!leftPinned) {
      left.y -= direction * push * leftWeight
      left.vy = (left.vy - direction * push * 0.05) * 0.88
    }
    if (!rightPinned) {
      right.y += direction * push * rightWeight
      right.vy = (right.vy + direction * push * 0.05) * 0.88
    }
  }
}

function applyBounds(simulation: TagCloudSimulation): void {
  const rect = simulation.root.getBoundingClientRect()
  for (const particle of simulation.particles) {
    const halfWidth = particle.width / 2
    const halfHeight = particle.height / 2
    const minX = BOUNDS_PADDING + halfWidth
    const maxX = rect.width - BOUNDS_PADDING - halfWidth
    const minY = BOUNDS_PADDING + halfHeight
    const maxY = rect.height - BOUNDS_PADDING - halfHeight

    if (particle.x < minX) {
      particle.x = minX
      particle.vx = Math.abs(particle.vx) * 0.22
    } else if (particle.x > maxX) {
      particle.x = maxX
      particle.vx = -Math.abs(particle.vx) * 0.22
    }

    if (particle.y < minY) {
      particle.y = minY
      particle.vy = Math.abs(particle.vy) * 0.22
    } else if (particle.y > maxY) {
      particle.y = maxY
      particle.vy = -Math.abs(particle.vy) * 0.22
    }
  }
}

function clampParticlePoint(
  particle: CloudParticle,
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  const halfWidth = particle.width / 2
  const halfHeight = particle.height / 2
  return {
    x: clamp(BOUNDS_PADDING + halfWidth, width - BOUNDS_PADDING - halfWidth, x),
    y: clamp(BOUNDS_PADDING + halfHeight, height - BOUNDS_PADDING - halfHeight, y)
  }
}

function getParticleBounds(particle: CloudParticle, padding = 0): {
  left: number
  right: number
  top: number
  bottom: number
} {
  const halfWidth = particle.width / 2
  const halfHeight = particle.height / 2
  return {
    left: particle.x - halfWidth - padding,
    right: particle.x + halfWidth + padding,
    top: particle.y - halfHeight - padding,
    bottom: particle.y + halfHeight + padding
  }
}

function getCollisionPadding(particle: CloudParticle): number {
  if (particle.tier === 'core') {
    return 4
  }
  if (particle.tier === 'body') {
    return 2
  }
  return 1.2
}

function renderParticles(particles: CloudParticle[]): void {
  for (const particle of particles) {
    particle.element.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) translate(-50%, -50%)`
  }
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}
