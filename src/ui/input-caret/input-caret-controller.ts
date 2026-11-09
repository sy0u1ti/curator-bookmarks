import { STORAGE_KEYS } from '../../shared/constants.js'
import { prefersReducedMotion } from '../../shared/motion.js'
import { normalizePopupPreferences } from '../../shared/popup-preferences.js'
import { getLocalStorage } from '../../shared/storage.js'
import {
  INPUT_CARET_BIDI_PATTERN,
  INPUT_CARET_REST_AFTER_MS,
  INPUT_CARET_TRAIL_THROTTLE_MS,
  INPUT_CARET_WIDTH_PX,
  clampInputCaretLeft,
  getInputCaretTrailGeometry,
  isFastInputCaretUpdate,
  isInputCaretNavigationKey,
  maskInputCaretPasswordText,
  shouldSnapInputCaret,
  type InputCaretPosition
} from './input-caret.js'

type CaretTarget = HTMLInputElement | HTMLTextAreaElement

const MIRROR_TYPOGRAPHY_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variant',
  'font-feature-settings',
  'font-variation-settings',
  'font-kerning',
  'font-optical-sizing',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'text-indent',
  'text-rendering',
  'tab-size',
  'direction',
  'unicode-bidi',
  'word-break',
  'overflow-wrap',
  'hyphens'
] as const

const TEXT_INPUT_TYPES = new Set([
  'email',
  'password',
  'search',
  'tel',
  'text',
  'url'
])

const CARET_TRAIL_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CARET_TRAIL_DURATION_MS = 180

interface CaretMetrics {
  borderLeft: number
  borderRadius: string
  borderTop: number
  clientHeight: number
  contentWidth: number
  direction: string
  font: string
  inputType: string
  isTextarea: boolean
  letterSpacing: string
  lineHeight: number
  overflowWrap: string
  paddingLeft: number
  paddingRight: number
  paddingTop: number
  scaleX: number
  scaleY: number
  signature: string
  tabSize: string
  textAlign: string
  typography: Array<readonly [string, string]>
  unicodeBidi: string
  whiteSpace: string
}

interface LayerGeometry {
  height: number
  left: number
  top: number
  width: number
}

interface ControllerState {
  controller: InputCaretController
  references: number
}

let sharedController: ControllerState | null = null

export function startInputCaretController(): () => void {
  if (typeof document === 'undefined') return () => undefined
  const state = sharedController ??= {
    controller: new InputCaretController(),
    references: 0
  }
  state.references += 1
  let released = false
  return () => {
    if (released) return
    released = true
    state.references -= 1
    if (state.references > 0) return
    state.controller.destroy()
    if (sharedController === state) sharedController = null
  }
}

class InputCaretController {
  private activeTarget: CaretTarget | null = null
  private caret: HTMLSpanElement | null = null
  private composing = false
  private destroyed = false
  private enabled: boolean | null = null
  private followFrame = 0
  private layer: HTMLDivElement | null = null
  private lastInputAt: number | null = null
  private lastLayerGeometry: LayerGeometry | null = null
  private lastMeasuredSelection: number | null = null
  private lastMeasuredValue: string | null = null
  private lastPosition: InputCaretPosition | null = null
  private lastScrollLeft: number | null = null
  private lastScrollTop: number | null = null
  private lastTrailAt = 0
  private measureCanvas: HTMLCanvasElement | null = null
  private measureContext: CanvasRenderingContext2D | null = null
  private measureContextKey = ''
  private metrics: CaretMetrics | null = null
  private metricsRectHeight: number | null = null
  private metricsRectWidth: number | null = null
  private metricsTarget: CaretTarget | null = null
  private mirror: HTMLDivElement | null = null
  private mirrorLeft = -10_000
  private pendingSnap = false
  private preferenceVersion = 0
  private restTimer: number | null = null
  private trail: HTMLSpanElement | null = null
  private updateFrame = 0

  constructor() {
    document.addEventListener('focusin', this.handleFocusIn, true)
    document.addEventListener('focusout', this.handleFocusOut, true)
    document.addEventListener('selectionchange', this.handleSelectionChange)
    document.addEventListener('input', this.handleInput, true)
    document.addEventListener('compositionstart', this.handleCompositionStart, true)
    document.addEventListener('compositionend', this.handleCompositionEnd, true)
    document.addEventListener('keydown', this.handleKeyDown, true)
    document.addEventListener('keyup', this.handleKeyUp, true)
    document.addEventListener('pointerup', this.handlePointerUp, true)
    document.addEventListener('transitionrun', this.handleMotionStart, true)
    document.addEventListener('animationstart', this.handleMotionStart, true)
    document.addEventListener('scroll', this.handleScroll, { capture: true, passive: true })
    window.addEventListener('resize', this.handleResize)
    window.visualViewport?.addEventListener('resize', this.handleResize, { passive: true })
    window.visualViewport?.addEventListener('scroll', this.handleViewportScroll, { passive: true })
    if (typeof chrome !== 'undefined') {
      chrome.storage?.onChanged?.addListener(this.handleStorageChanged)
    }
    void document.fonts?.ready.then(this.handleFontsReady)
    void this.hydratePreference()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.deactivate()
    document.removeEventListener('focusin', this.handleFocusIn, true)
    document.removeEventListener('focusout', this.handleFocusOut, true)
    document.removeEventListener('selectionchange', this.handleSelectionChange)
    document.removeEventListener('input', this.handleInput, true)
    document.removeEventListener('compositionstart', this.handleCompositionStart, true)
    document.removeEventListener('compositionend', this.handleCompositionEnd, true)
    document.removeEventListener('keydown', this.handleKeyDown, true)
    document.removeEventListener('keyup', this.handleKeyUp, true)
    document.removeEventListener('pointerup', this.handlePointerUp, true)
    document.removeEventListener('transitionrun', this.handleMotionStart, true)
    document.removeEventListener('animationstart', this.handleMotionStart, true)
    document.removeEventListener('scroll', this.handleScroll, true)
    window.removeEventListener('resize', this.handleResize)
    window.visualViewport?.removeEventListener('resize', this.handleResize)
    window.visualViewport?.removeEventListener('scroll', this.handleViewportScroll)
    if (typeof chrome !== 'undefined') {
      chrome.storage?.onChanged?.removeListener(this.handleStorageChanged)
    }
    this.mirror?.remove()
    this.mirror = null
    this.layer?.remove()
    this.layer = null
    this.caret = null
    this.trail = null
  }

  private handleFocusIn = (event: FocusEvent): void => {
    if (this.enabled !== true) return
    const target = this.getEligibleTarget(event.target)
    if (target) {
      this.activate(target)
      return
    }
    if (this.activeTarget) this.deactivate()
  }

  private handleFocusOut = (event: FocusEvent): void => {
    if (event.target !== this.activeTarget) return
    this.deactivate()
  }

  private handleSelectionChange = (): void => {
    if (!this.activeTarget || document.activeElement !== this.activeTarget) return
    this.scheduleUpdate()
  }

  private handleInput = (event: Event): void => {
    if (event.target !== this.activeTarget) return
    const now = performance.now()
    const snap = isFastInputCaretUpdate(this.lastInputAt, now) ||
      this.composing ||
      (event instanceof InputEvent && event.isComposing)
    this.lastInputAt = now
    // A new 120ms transition on every fast edit trails behind the text. Commit
    // the measured position before paint instead of predicting a character width.
    this.scheduleUpdate({ snap })
  }

  private handleCompositionStart = (event: CompositionEvent): void => {
    if (event.target !== this.activeTarget) return
    this.composing = true
    this.scheduleUpdate({ snap: true })
  }

  private handleCompositionEnd = (event: CompositionEvent): void => {
    if (event.target !== this.activeTarget) return
    this.composing = false
    this.scheduleUpdate({ snap: true })
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.target !== this.activeTarget || event.isComposing) return
    if (event.repeat || isInputCaretNavigationKey(event.key)) {
      // keyup is too late for a held key. The browser changes the selection
      // after keydown; the scheduled update reads it in the same rendering frame.
      this.scheduleUpdate({ snap: true })
    }
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (event.target !== this.activeTarget || !isInputCaretNavigationKey(event.key)) return
    this.scheduleUpdate({ snap: true })
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (event.target !== this.activeTarget) return
    this.scheduleUpdate()
  }

  private handleScroll = (): void => {
    if (!this.activeTarget) return
    this.scheduleUpdate({ snap: true })
  }

  private handleMotionStart = (event: Event): void => {
    const source = event.target
    if (!this.activeTarget || !(source instanceof Node) || !source.contains(this.activeTarget)) return
    this.followTargetMotion()
  }

  // The overlay sits in viewport coordinates, so it does not inherit transforms
  // from the field's ancestors (a dialog opening, a panel sliding in). While any
  // of them animates, re-measure every frame until the field comes to rest.
  private isTargetMoving(target: CaretTarget): boolean {
    if (typeof document.getAnimations !== 'function') return false
    return document.getAnimations().some((animation) => {
      if (animation.playState !== 'running') return false
      const effect = animation.effect
      if (!(effect instanceof KeyframeEffect) || effect.pseudoElement) return false
      const element = effect.target
      return element instanceof Element && element.contains(target)
    })
  }

  private followTargetMotion(): void {
    const target = this.activeTarget
    if (!target || this.followFrame || !this.isTargetMoving(target)) return
    const step = () => {
      this.followFrame = 0
      if (this.activeTarget !== target) return
      this.update()
      if (this.activeTarget === target && this.isTargetMoving(target)) {
        this.followFrame = requestAnimationFrame(step)
      } else if (this.activeTarget === target) {
        this.scheduleUpdate({ snap: true })
      }
    }
    this.followFrame = requestAnimationFrame(step)
  }

  private handleViewportScroll = (): void => {
    if (!this.activeTarget) return
    this.scheduleUpdate({ snap: true })
  }

  private handleResize = (): void => {
    this.invalidateMetrics()
    if (!this.activeTarget) return
    this.scheduleUpdate({ snap: true })
  }

  private handleFontsReady = (): void => {
    if (this.destroyed) return
    this.invalidateMetrics()
    if (this.activeTarget) this.scheduleUpdate({ snap: true })
  }

  private handleStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void => {
    if (areaName !== 'local' || !changes[STORAGE_KEYS.popupPreferences]) return
    const preferences = normalizePopupPreferences(changes[STORAGE_KEYS.popupPreferences].newValue)
    this.setEnabled(preferences.animatedCaret)
  }

  private async hydratePreference(): Promise<void> {
    const version = ++this.preferenceVersion
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      this.setEnabled(true)
      return
    }
    try {
      const stored = await getLocalStorage([STORAGE_KEYS.popupPreferences])
      if (this.destroyed || version !== this.preferenceVersion) return
      const preferences = normalizePopupPreferences(stored[STORAGE_KEYS.popupPreferences])
      this.setEnabled(preferences.animatedCaret)
    } catch {
      if (this.destroyed || version !== this.preferenceVersion) return
      this.setEnabled(true)
    }
  }

  private setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return
    this.enabled = enabled
    if (!enabled) {
      this.deactivate()
      return
    }
    const target = this.getEligibleTarget(document.activeElement)
    if (target) this.activate(target)
  }

  private getEligibleTarget(node: EventTarget | null): CaretTarget | null {
    if (node instanceof HTMLTextAreaElement) {
      return this.hasSelectionApi(node) ? node : null
    }
    if (!(node instanceof HTMLInputElement)) return null
    if (!TEXT_INPUT_TYPES.has(node.type)) return null
    return this.hasSelectionApi(node) ? node : null
  }

  private hasSelectionApi(target: CaretTarget): boolean {
    try {
      return typeof target.selectionStart === 'number' &&
        typeof target.selectionEnd === 'number'
    } catch {
      return false
    }
  }

  private activate(target: CaretTarget): void {
    if (this.activeTarget === target) {
      this.scheduleUpdate({ snap: true })
      return
    }
    this.deactivate()
    this.activeTarget = target
    target.dataset.curatorInputCaret = 'true'
    this.invalidateMetrics()
    this.lastPosition = null
    this.lastScrollLeft = null
    this.lastScrollTop = null
    this.lastMeasuredSelection = null
    this.lastMeasuredValue = null
    this.lastLayerGeometry = null
    this.ensureOverlay()
    this.update(true)
    this.scheduleUpdate({ snap: true })
    this.followTargetMotion()
  }

  private deactivate(): void {
    if (this.activeTarget) {
      delete this.activeTarget.dataset.curatorInputCaret
      this.activeTarget = null
    }
    if (this.updateFrame) {
      cancelAnimationFrame(this.updateFrame)
      this.updateFrame = 0
    }
    if (this.followFrame) {
      cancelAnimationFrame(this.followFrame)
      this.followFrame = 0
    }
    this.pendingSnap = false
    this.composing = false
    this.lastInputAt = null
    if (this.restTimer !== null) {
      clearTimeout(this.restTimer)
      this.restTimer = null
    }
    this.hideLayer()
    this.lastPosition = null
    this.lastScrollLeft = null
    this.lastScrollTop = null
    this.lastMeasuredSelection = null
    this.lastMeasuredValue = null
    this.lastLayerGeometry = null
    this.invalidateMetrics()
  }

  private invalidateMetrics(): void {
    this.metrics = null
    this.metricsTarget = null
    this.metricsRectWidth = null
    this.metricsRectHeight = null
  }

  private ensureOverlay(): void {
    if (this.layer?.isConnected) return
    const layer = document.createElement('div')
    layer.className = 'curator-input-caret-layer'
    layer.setAttribute('aria-hidden', 'true')

    const caret = document.createElement('span')
    caret.className = 'curator-input-caret'
    caret.dataset.visible = 'false'
    caret.dataset.motionKeyboard = 'preserve'
    caret.setAttribute('aria-hidden', 'true')

    const trail = document.createElement('span')
    trail.className = 'curator-input-caret-trail'
    trail.dataset.motionKeyboard = 'preserve'
    trail.setAttribute('aria-hidden', 'true')

    layer.append(caret, trail)
    ;(document.body || document.documentElement).append(layer)
    this.layer = layer
    this.caret = caret
    this.trail = trail
  }

  private hideLayer(): void {
    if (this.layer) {
      this.layer.dataset.visible = 'false'
      this.layer.style.display = 'none'
    }
    if (this.caret) this.caret.dataset.visible = 'false'
    this.clearTrail()
  }

  private clearTrail(): void {
    if (this.trail) {
      this.trail.getAnimations().forEach((animation) => animation.cancel())
      this.trail.style.opacity = '0'
    }
  }

  private hideCaret(): void {
    if (this.caret) {
      this.caret.dataset.visible = 'false'
      this.caret.dataset.resting = 'false'
    }
    this.clearTrail()
    if (this.restTimer !== null) {
      clearTimeout(this.restTimer)
      this.restTimer = null
    }
    this.lastPosition = null
    this.lastScrollLeft = null
    this.lastScrollTop = null
    this.lastMeasuredSelection = null
    this.lastMeasuredValue = null
  }

  private scheduleUpdate(options: { snap?: boolean } = {}): void {
    if (options.snap) this.pendingSnap = true
    if (this.updateFrame) return
    this.updateFrame = requestAnimationFrame(() => {
      this.updateFrame = 0
      const snap = this.pendingSnap
      this.pendingSnap = false
      this.update(snap)
    })
  }

  private update(snapRequested = false): void {
    const target = this.activeTarget
    const layer = this.layer
    const caret = this.caret
    const trail = this.trail
    if (
      !target ||
      !layer ||
      !caret ||
      !trail ||
      this.enabled !== true ||
      !target.isConnected ||
      document.activeElement !== target
    ) {
      this.deactivate()
      return
    }

    const rect = target.getBoundingClientRect()
    if (!this.isLayerVisible(rect)) {
      this.hideLayer()
      return
    }

    const metrics = this.getMetrics(target, rect)
    const layerChanged = this.setLayerGeometry(rect, metrics.borderRadius)

    const selectionStart = target.selectionStart
    const selectionEnd = target.selectionEnd
    if (selectionStart === null || selectionEnd === null || selectionStart !== selectionEnd) {
      this.hideCaret()
      return
    }

    const sameState = !snapRequested &&
      !layerChanged &&
      this.lastMeasuredValue === target.value &&
      this.lastMeasuredSelection === selectionStart &&
      this.lastScrollLeft !== null &&
      this.lastScrollTop !== null &&
      Math.abs(this.lastScrollLeft - target.scrollLeft) < 0.5 &&
      Math.abs(this.lastScrollTop - target.scrollTop) < 0.5 &&
      this.lastPosition !== null
    if (sameState) {
      this.resetRestTimer(caret)
      return
    }

    const measured = this.measureCaretPosition(target, metrics, selectionStart)
    if (!measured) {
      this.hideCaret()
      return
    }

    const next: InputCaretPosition = {
      left: measured.left * metrics.scaleX,
      top: measured.top * metrics.scaleY
    }
    const caretHeight = measured.height * metrics.scaleY
    const caretWidth = INPUT_CARET_WIDTH_PX * metrics.scaleX
    const previous = this.lastPosition
    const scrollChanged = (
      this.lastScrollLeft !== null && Math.abs(this.lastScrollLeft - target.scrollLeft) >= 0.5
    ) || (
      this.lastScrollTop !== null && Math.abs(this.lastScrollTop - target.scrollTop) >= 0.5
    )
    const snap = shouldSnapInputCaret(previous, next, snapRequested || scrollChanged || layerChanged)

    if (snap) {
      this.clearTrail()
    } else if (previous && !prefersReducedMotion()) {
      this.drawTrail(previous, next, caretHeight)
    }

    caret.style.width = `${caretWidth}px`
    caret.style.height = `${caretHeight}px`
    trail.style.height = `${caretHeight}px`
    this.applyCaretPosition(caret, next, snap)
    caret.dataset.visible = 'true'
    this.resetRestTimer(caret)
    this.lastPosition = next
    this.lastScrollLeft = target.scrollLeft
    this.lastScrollTop = target.scrollTop
    this.lastMeasuredSelection = selectionStart
    this.lastMeasuredValue = target.value
  }

  private isLayerVisible(rect: DOMRect): boolean {
    if (rect.width < 1 || rect.height < 1) return false
    return rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
  }

  private setLayerGeometry(rect: DOMRect, borderRadius: string): boolean {
    const layer = this.layer!
    const geometry: LayerGeometry = {
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width
    }
    const previous = this.lastLayerGeometry
    const changed = previous === null ||
      layer.style.display !== 'block' ||
      Math.abs(previous.left - geometry.left) >= 0.5 ||
      Math.abs(previous.top - geometry.top) >= 0.5 ||
      Math.abs(previous.width - geometry.width) >= 0.5 ||
      Math.abs(previous.height - geometry.height) >= 0.5 ||
      layer.style.borderRadius !== borderRadius

    if (!changed) return false

    layer.style.display = 'block'
    layer.style.left = `${geometry.left}px`
    layer.style.top = `${geometry.top}px`
    layer.style.width = `${geometry.width}px`
    layer.style.height = `${geometry.height}px`
    layer.style.borderRadius = borderRadius
    layer.dataset.visible = 'true'
    this.lastLayerGeometry = geometry
    return true
  }

  private getMetrics(target: CaretTarget, rect: DOMRect): CaretMetrics {
    const type = target instanceof HTMLInputElement ? target.type : 'textarea'
    if (
      this.metrics &&
      this.metricsTarget === target &&
      this.metrics.inputType === type &&
      this.metricsRectWidth !== null &&
      this.metricsRectHeight !== null &&
      Math.abs(this.metricsRectWidth - rect.width) < 0.5 &&
      Math.abs(this.metricsRectHeight - rect.height) < 0.5
    ) {
      return this.metrics
    }

    const style = window.getComputedStyle(target)
    const fontSize = Number.parseFloat(style.fontSize) || 14
    const rawLineHeight = style.lineHeight === 'normal'
      ? fontSize * 1.4
      : Number.parseFloat(style.lineHeight)
    const lineHeight = Number.isFinite(rawLineHeight) ? rawLineHeight : fontSize * 1.4
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0
    const paddingRight = Number.parseFloat(style.paddingRight) || 0
    const paddingTop = Number.parseFloat(style.paddingTop) || 0
    const contentWidth = Math.max(0, target.clientWidth - paddingLeft - paddingRight)
    const typography = MIRROR_TYPOGRAPHY_PROPERTIES.map((property) => [
      property,
      style.getPropertyValue(property)
    ] as const)
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing
    const isTextarea = target instanceof HTMLTextAreaElement
    const whiteSpace = isTextarea ? style.whiteSpace : 'pre'
    const textAlign = style.textAlign || 'start'
    const offsetWidth = target.offsetWidth || rect.width
    const offsetHeight = target.offsetHeight || rect.height

    const next: CaretMetrics = {
      borderLeft,
      borderRadius: style.borderRadius || '0px',
      borderTop,
      clientHeight: target.clientHeight,
      contentWidth,
      direction: style.direction || 'ltr',
      font,
      inputType: type,
      isTextarea,
      letterSpacing,
      lineHeight,
      overflowWrap: style.overflowWrap || 'break-word',
      paddingLeft,
      paddingRight,
      paddingTop,
      scaleX: rect.width / offsetWidth || 1,
      scaleY: rect.height / offsetHeight || 1,
      signature: [
        contentWidth,
        lineHeight,
        whiteSpace,
        textAlign,
        style.wordBreak,
        style.overflowWrap,
        ...typography.map(([property, propertyValue]) => `${property}:${propertyValue}`)
      ].join('|'),
      tabSize: style.tabSize || '8',
      textAlign,
      typography,
      unicodeBidi: style.unicodeBidi || 'normal',
      whiteSpace
    }
    this.metrics = next
    this.metricsTarget = target
    this.metricsRectWidth = rect.width
    this.metricsRectHeight = rect.height
    return next
  }

  private getMeasureContext(metrics: CaretMetrics): CanvasRenderingContext2D | null {
    let context = this.measureContext
    if (!context) {
      this.measureCanvas ||= document.createElement('canvas')
      context = this.measureCanvas.getContext('2d')
      if (!context) return null
      this.measureContext = context
    }
    const key = `${metrics.font}|${metrics.letterSpacing}`
    if (this.measureContextKey !== key) {
      context.font = metrics.font
      const letterSpacedContext = context as CanvasRenderingContext2D & { letterSpacing?: string }
      letterSpacedContext.letterSpacing = metrics.letterSpacing
      this.measureContextKey = key
    }
    return context
  }

  private measureTextWidth(text: string, metrics: CaretMetrics): number {
    const context = this.getMeasureContext(metrics)
    return context ? context.measureText(text).width : 0
  }

  private getMirror(metrics: CaretMetrics): HTMLDivElement {
    let mirror = this.mirror
    if (!mirror) {
      mirror = document.createElement('div')
      mirror.setAttribute('aria-hidden', 'true')
      mirror.dataset.curatorInputCaretMirror = 'true'
      document.body.appendChild(mirror)
      this.mirror = mirror
    }
    if (mirror.dataset.signature === metrics.signature) return mirror

    mirror.dataset.signature = metrics.signature
    mirror.style.cssText = [
      'position:fixed',
      'left:-10000px',
      'top:0',
      'visibility:hidden',
      'pointer-events:none',
      'contain:layout style paint',
      'overflow:visible',
      'margin:0',
      'padding:0',
      'border:0',
      'box-sizing:content-box',
      `width:${metrics.contentWidth}px`,
      `line-height:${metrics.lineHeight}px`,
      `white-space:${metrics.whiteSpace}`,
      `word-break:${metrics.typography.find(([property]) => property === 'word-break')?.[1] || 'normal'}`,
      `overflow-wrap:${metrics.overflowWrap}`,
      `text-align:${metrics.textAlign}`,
      `tab-size:${metrics.tabSize}`,
      `direction:${metrics.direction}`,
      `unicode-bidi:${metrics.unicodeBidi}`
    ].join(';')
    for (const [property, propertyValue] of metrics.typography) {
      mirror.style.setProperty(property, propertyValue)
    }
    this.mirrorLeft = mirror.getBoundingClientRect().left
    return mirror
  }

  private measureCaretPosition(
    target: CaretTarget,
    metrics: CaretMetrics,
    selectionStart: number
  ): { height: number, left: number, top: number } | null {
    const value = target.value
    const inputType = target instanceof HTMLInputElement ? target.type : 'textarea'
    const textAlignNeedsMirror = !['start', 'left'].includes(metrics.textAlign)
    const textIndent = metrics.typography.find(([property]) => property === 'text-indent')?.[1]
    const textIndentNeedsMirror = Boolean(textIndent) &&
      textIndent !== 'normal' &&
      textIndent !== '0px'
    const usesMirror = target instanceof HTMLTextAreaElement ||
      (metrics.inputType !== 'password' &&
        (metrics.direction === 'rtl' ||
          textAlignNeedsMirror ||
          textIndentNeedsMirror ||
          INPUT_CARET_BIDI_PATTERN.test(value)))
    const caretHeight = Math.min(24, Math.max(12, metrics.lineHeight * 0.96))
    let measuredLeft = 0
    let top = metrics.borderTop + Math.max(0, (metrics.clientHeight - caretHeight) / 2)

    if (!usesMirror) {
      const prefix = inputType === 'password'
        ? maskInputCaretPasswordText(value.slice(0, selectionStart))
        : value.slice(0, selectionStart)
      measuredLeft = this.measureTextWidth(prefix, metrics)
    } else {
      const mirror = this.getMirror(metrics)
      const mirrorText = inputType === 'password'
        ? maskInputCaretPasswordText(value)
        : value
      if (mirror.textContent !== mirrorText) mirror.textContent = mirrorText
      mirror.normalize()
      const textNode = mirror.firstChild
      let rangeRect: DOMRect | null = null
      if (textNode instanceof Text) {
        const offset = Math.min(selectionStart, textNode.textContent?.length ?? 0)
        const range = document.createRange()
        range.setStart(textNode, offset)
        range.setEnd(textNode, offset)
        rangeRect = range.getBoundingClientRect()
        if (
          (rangeRect.width === 0 && rangeRect.height === 0) ||
          (offset === textNode.length && /\s$/.test(value))
        ) {
          rangeRect = this.measureMirrorMarker(mirror, (marker) => {
            range.insertNode(marker)
          })
        }
      } else {
        rangeRect = this.measureMirrorMarker(mirror, (marker) => {
          mirror.appendChild(marker)
        })
      }
      if (rangeRect) {
        measuredLeft = rangeRect.left - this.mirrorLeft
        if (metrics.isTextarea) {
          top = metrics.borderTop +
            metrics.paddingTop +
            rangeRect.top -
            mirror.getBoundingClientRect().top -
            target.scrollTop
        }
      }
    }

    const minimumLeft = metrics.borderLeft + metrics.paddingLeft
    const maximumLeft = Math.max(
      minimumLeft,
      metrics.borderLeft + target.clientWidth - metrics.paddingRight - INPUT_CARET_WIDTH_PX
    )
    return {
      height: caretHeight,
      left: clampInputCaretLeft(
        metrics.borderLeft + metrics.paddingLeft + measuredLeft - target.scrollLeft,
        minimumLeft,
        maximumLeft
      ),
      top
    }
  }

  private measureMirrorMarker(
    mirror: HTMLDivElement,
    insert: (marker: HTMLSpanElement) => void
  ): DOMRect {
    const marker = document.createElement('span')
    marker.textContent = '\u200b'
    insert(marker)
    const rect = marker.getBoundingClientRect()
    marker.remove()
    mirror.normalize()
    return rect
  }

  private applyCaretPosition(
    caret: HTMLSpanElement,
    position: InputCaretPosition,
    snap: boolean
  ): void {
    // Restore motion only when a later movement calls for it. A restoration RAF
    // can otherwise re-enable interpolation before a newer snap has been painted.
    caret.style.transition = snap ? 'none' : ''
    caret.style.transform = `translate3d(${position.left}px, ${position.top}px, 0)`
  }

  private resetRestTimer(caret: HTMLSpanElement): void {
    caret.dataset.resting = 'false'
    if (this.restTimer !== null) clearTimeout(this.restTimer)
    this.restTimer = window.setTimeout(() => {
      this.restTimer = null
      if (this.caret === caret) caret.dataset.resting = 'true'
    }, INPUT_CARET_REST_AFTER_MS)
  }

  private drawTrail(
    previous: InputCaretPosition,
    next: InputCaretPosition,
    caretHeight: number
  ): void {
    const trail = this.trail
    if (
      !trail ||
      prefersReducedMotion() ||
      window.matchMedia('(forced-colors: active)').matches
    ) {
      return
    }
    const geometry = getInputCaretTrailGeometry(previous, next)
    if (!geometry) return

    const now = performance.now()
    if (now - this.lastTrailAt < INPUT_CARET_TRAIL_THROTTLE_MS) return
    this.lastTrailAt = now

    trail.getAnimations().forEach((animation) => animation.cancel())
    trail.dataset.direction = geometry.direction
    trail.style.height = `${caretHeight}px`
    trail.style.width = `${geometry.width}px`
    const baseTransform = `translate3d(${geometry.left}px, ${next.top}px, 0)`
    trail.style.transform = `${baseTransform} scaleX(1)`
    trail.style.opacity = '0'

    const animation = trail.animate([
      { opacity: 0.6, transform: `${baseTransform} scaleX(1)` },
      { opacity: 0, transform: `${baseTransform} scaleX(0)` }
    ], {
      duration: CARET_TRAIL_DURATION_MS,
      easing: CARET_TRAIL_EASING,
      fill: 'forwards'
    })
    animation.onfinish = () => {
      if (this.trail !== trail) return
      trail.style.opacity = '0'
      animation.cancel()
    }
  }
}
