import { useEffect, useRef } from 'react'
import { isWallpaperFilterMaskStyle } from '../background-mask-settings'
import { useNewtabBackgroundMediaView } from '../newtab-background-media-store'
import { useNewtabBackgroundSettingsView } from '../newtab-background-settings-store'

const ASCII_CHARS = '  .,:;irsXA253hMHGS#9B&@'
const FILTER_VIDEO_FRAME_INTERVAL_MS = 260
const FILTER_RESIZE_DELAY_MS = 120
const FILTER_SAMPLE_MAX_WIDTH = 520
const FILTER_SAMPLE_MAX_HEIGHT = 320
const FILTER_RENDER_MAX_WIDTH = 1920
const FILTER_RENDER_MAX_HEIGHT = 1080
const FILTER_BACKGROUND_COLOR = '#101013'
const FILTER_HOVER_FADE_MS = 240

interface FilterColor {
  red: number
  green: number
  blue: number
}

interface FilterSampler {
  data: Uint8ClampedArray
  height: number
  naturalHeight: number
  naturalWidth: number
  scaleX: number
  scaleY: number
  width: number
}

interface RenderedMediaMetrics {
  offsetX: number
  offsetY: number
  scale: number
}

interface HoverRenderState {
  intensity: number
  x: number
  y: number
}

interface AsciiGlyphMetrics {
  font: string
  fontSize: number
  glyphHeight: number
  glyphWidth: number
}

let asciiGlyphMetricsCache: AsciiGlyphMetrics | null = null

export function NewtabWallpaperFilterLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const media = useNewtabBackgroundMediaView()
  const background = useNewtabBackgroundSettingsView()
  const active = background.maskEnabled && isWallpaperFilterMaskStyle(background.maskStyle)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    let cancelled = false
    let resizeTimer = 0
    let videoTimer = 0
    let hoverFrame = 0
    let hoverRenderFrame = 0
    let image: HTMLImageElement | null = null
    let currentSampler: FilterSampler | null = null
    let hoverState: HoverRenderState = { intensity: 0, x: 0, y: 0 }
    let hoverFading = false

    const clear = () => {
      canvas.dataset.ready = 'false'
      canvas.removeAttribute('data-effect')
      canvas.style.opacity = '0'
      canvas.style.mixBlendMode = 'normal'
      const context = canvas.getContext('2d')
      context?.clearRect(0, 0, canvas.width, canvas.height)
    }

    if (!active) {
      clear()
      return
    }
    clear()

    const renderSampler = (sampler: FilterSampler | null) => {
      if (cancelled) {
        return
      }
      const context = canvas.getContext('2d', { alpha: true })
      if (!context) {
        clear()
        return
      }
      const viewport = resizeFilterCanvas(canvas, context)
      context.clearRect(0, 0, viewport.width, viewport.height)

      if (background.maskStyle === 'grain') {
        drawGrain(context, viewport)
        canvas.style.mixBlendMode = 'overlay'
        canvas.style.opacity = String(0.08 + (0.22 * background.maskFilterStrength / 100))
      } else if (sampler) {
        currentSampler = sampler
        context.fillStyle = FILTER_BACKGROUND_COLOR
        context.fillRect(0, 0, viewport.width, viewport.height)
        if (background.maskStyle === 'halftone') {
          drawHalftone(
            context,
            viewport,
            sampler,
            media.backgroundSize,
            media.backgroundPosition,
            background.maskFilterStrength,
            background.maskFilterSize,
            background.maskFilterSpacing,
            hoverState
          )
        } else {
          drawAscii(
            context,
            viewport,
            sampler,
            media.backgroundSize,
            media.backgroundPosition,
            background.maskFilterStrength,
            background.maskFilterSize,
            background.maskFilterSpacing,
            hoverState
          )
        }
        canvas.style.mixBlendMode = 'normal'
        canvas.style.opacity = '1'
      } else {
        clear()
        return
      }

      canvas.dataset.effect = background.maskStyle
      canvas.dataset.ready = 'true'
    }

    const renderCurrentSource = async () => {
      if (cancelled) {
        return
      }
      if (background.maskStyle === 'grain') {
        renderSampler(null)
        return
      }
      if (media.kind === 'image' && media.src) {
        image = new Image()
        image.decoding = 'async'
        image.crossOrigin = media.src.startsWith('http') ? 'anonymous' : ''
        const ready = await waitForFilterImage(image, media.src)
        if (ready && !cancelled) {
          renderSampler(
            createFilterSampler(image, image.naturalWidth, image.naturalHeight) ||
            createSolidColorSampler(background.color)
          )
        } else if (!cancelled) {
          renderSampler(createSolidColorSampler(background.color))
        }
        return
      }
      if (media.kind === 'video') {
        const video = document.querySelector<HTMLVideoElement>('.newtab-background-video')
        if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          renderSampler(
            createFilterSampler(video, video.videoWidth, video.videoHeight) ||
            createSolidColorSampler(background.color)
          )
        } else {
          clear()
        }
        return
      }
      renderSampler(createSolidColorSampler(background.color))
    }

    const scheduleResizeRender = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        void renderCurrentSource()
      }, FILTER_RESIZE_DELAY_MS)
    }

    const renderHoverState = () => {
      if (!currentSampler || hoverRenderFrame) return
      hoverRenderFrame = window.requestAnimationFrame(() => {
        hoverRenderFrame = 0
        if (currentSampler && !cancelled) {
          renderSampler(currentSampler)
        }
      })
    }

    const fadeHoverState = () => {
      if (hoverFading || hoverState.intensity <= 0.01) {
        return
      }
      hoverFading = true
      window.cancelAnimationFrame(hoverFrame)
      window.cancelAnimationFrame(hoverRenderFrame)
      hoverRenderFrame = 0
      const startedAt = performance.now()
      const startIntensity = hoverState.intensity
      const tick = (now: number) => {
        const progress = clampNumber((now - startedAt) / FILTER_HOVER_FADE_MS, 0, 1)
        const eased = progress * progress * (3 - (2 * progress))
        hoverState = { ...hoverState, intensity: startIntensity * (1 - eased) }
        renderHoverState()
        if (progress < 1 && !cancelled) {
          hoverFrame = window.requestAnimationFrame(tick)
        } else {
          hoverFading = false
        }
      }
      hoverFrame = window.requestAnimationFrame(tick)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!background.maskFilterHover || !doesFilterStyleSupportHover(background.maskStyle)) {
        return
      }
      if (isFilterHoverSafeTarget(event.target) || isPointerInFilterSafeZone(event.clientX, event.clientY)) {
        fadeHoverState()
        return
      }
      window.cancelAnimationFrame(hoverFrame)
      hoverFading = false
      const scaleX = canvas.width / Math.max(1, window.innerWidth)
      const scaleY = canvas.height / Math.max(1, window.innerHeight)
      hoverState = {
        intensity: 1,
        x: event.clientX * scaleX,
        y: event.clientY * scaleY
      }
      renderHoverState()
    }

    const clearHoverState = () => {
      window.cancelAnimationFrame(hoverFrame)
      hoverFading = false
      hoverState = { intensity: 0, x: 0, y: 0 }
      renderHoverState()
    }

    const renderVideoFrame = () => {
      if (cancelled || media.kind !== 'video') {
        return
      }
      if (document.visibilityState !== 'hidden') {
        void renderCurrentSource()
      }
      videoTimer = window.setTimeout(renderVideoFrame, FILTER_VIDEO_FRAME_INTERVAL_MS)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && media.kind === 'video') {
        window.clearTimeout(videoTimer)
        void renderCurrentSource()
        videoTimer = window.setTimeout(renderVideoFrame, FILTER_VIDEO_FRAME_INTERVAL_MS)
      }
    }

    void renderCurrentSource()
    if (media.kind === 'video' && background.maskStyle !== 'grain') {
      videoTimer = window.setTimeout(renderVideoFrame, FILTER_VIDEO_FRAME_INTERVAL_MS)
    }
    window.addEventListener('resize', scheduleResizeRender, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerleave', clearHoverState, { passive: true })
    window.addEventListener('blur', clearHoverState)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      if (image) {
        image.src = ''
      }
      window.clearTimeout(resizeTimer)
      window.clearTimeout(videoTimer)
      window.cancelAnimationFrame(hoverFrame)
      window.cancelAnimationFrame(hoverRenderFrame)
      window.removeEventListener('resize', scheduleResizeRender)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', clearHoverState)
      window.removeEventListener('blur', clearHoverState)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    active,
    background.color,
    background.maskFilterSize,
    background.maskFilterHover,
    background.maskFilterSpacing,
    background.maskFilterStrength,
    background.maskStyle,
    media.backgroundPosition,
    media.backgroundSize,
    media.kind,
    media.src
  ])

  return (
    <canvas
      ref={canvasRef}
      id="newtab-wallpaper-filter"
      className="newtab-wallpaper-filter fixed inset-0 z-0 h-full w-full pointer-events-none"
      data-ready="false"
      aria-hidden="true"
    />
  )
}

function resizeFilterCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1)
  const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1)
  const renderScale = Math.min(1, FILTER_RENDER_MAX_WIDTH / width, FILTER_RENDER_MAX_HEIGHT / height)
  const renderWidth = Math.max(1, Math.round(width * renderScale))
  const renderHeight = Math.max(1, Math.round(height * renderScale))
  if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
    canvas.width = renderWidth
    canvas.height = renderHeight
  }
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(1, 0, 0, 1, 0, 0)
  return { width: renderWidth, height: renderHeight }
}

function createFilterSampler(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number
): FilterSampler | null {
  if (!naturalWidth || !naturalHeight) {
    return null
  }
  const sampleScale = Math.min(
    1,
    FILTER_SAMPLE_MAX_WIDTH / naturalWidth,
    FILTER_SAMPLE_MAX_HEIGHT / naturalHeight
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(naturalWidth * sampleScale))
  canvas.height = Math.max(1, Math.round(naturalHeight * sampleScale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    return null
  }
  try {
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    return {
      data,
      height: canvas.height,
      naturalHeight,
      naturalWidth,
      scaleX: canvas.width / naturalWidth,
      scaleY: canvas.height / naturalHeight,
      width: canvas.width
    }
  } catch {
    return null
  }
}

function createSolidColorSampler(value: string): FilterSampler {
  const color = parseHexColor(value) || { red: 16, green: 16, blue: 19 }
  return {
    data: new Uint8ClampedArray([color.red, color.green, color.blue, 255]),
    height: 1,
    naturalHeight: 1,
    naturalWidth: 1,
    scaleX: 1,
    scaleY: 1,
    width: 1
  }
}

function waitForFilterImage(image: HTMLImageElement, src: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (ready: boolean) => {
      if (settled) return
      settled = true
      image.onload = null
      image.onerror = null
      resolve(ready)
    }
    image.onload = () => settle(true)
    image.onerror = () => settle(false)
    image.src = src
    if (image.complete) {
      settle(Boolean(image.naturalWidth))
    }
  })
}

function drawGrain(
  context: CanvasRenderingContext2D,
  viewport: { width: number; height: number }
) {
  const tile = document.createElement('canvas')
  tile.width = 180
  tile.height = 180
  const tileContext = tile.getContext('2d')
  if (!tileContext) return
  const imageData = tileContext.createImageData(tile.width, tile.height)
  for (let index = 0; index < imageData.data.length; index += 4) {
    const value = Math.floor(Math.random() * 255)
    imageData.data[index] = value
    imageData.data[index + 1] = value
    imageData.data[index + 2] = value
    imageData.data[index + 3] = 255
  }
  tileContext.putImageData(imageData, 0, 0)
  const pattern = context.createPattern(tile, 'repeat')
  if (!pattern) return
  context.fillStyle = pattern
  context.fillRect(0, 0, viewport.width, viewport.height)
}

function drawHalftone(
  context: CanvasRenderingContext2D,
  viewport: { width: number; height: number },
  sampler: FilterSampler,
  backgroundSize: string,
  backgroundPosition: string,
  strength: number,
  size: number,
  spacing: number,
  hoverState: HoverRenderState
) {
  const metrics = getRenderedMediaMetrics(sampler, viewport, backgroundSize, backgroundPosition)
  const step = getControlRange(spacing, viewport.width < 720 ? 9 : 10, viewport.width < 720 ? 23 : 26)
  const sizeRadius = getControlRange(size, viewport.width < 720 ? 1.4 : 1.6, viewport.width < 720 ? 13 : 15)
  const maxRadius = Math.min(sizeRadius, step * 0.78)
  for (let y = step / 2; y < viewport.height + step; y += step) {
    for (let x = step / 2; x < viewport.width + step; x += step) {
      const color = sampleColor(sampler, metrics, x, y)
      const tone = getEffectTone(getLuminance(color), strength)
      const hover = getHoverInfluence(x, y, viewport, hoverState)
      const nextTone = clampNumber(tone + (hover * 0.24), 0, 1)
      if (nextTone <= 0.01) continue
      const radius = clampNumber(nextTone * maxRadius * (1 + (hover * 0.26)), 0.7, maxRadius * 1.24)
      const ink = getCurvedEffectColor(color, nextTone, 0.2 + (hover * 0.24))
      context.globalAlpha = clampNumber(0.28 + (nextTone * 0.72) + (hover * 0.14), 0.12, 1)
      context.fillStyle = `rgb(${ink.red} ${ink.green} ${ink.blue})`
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
  }
  context.globalAlpha = 1
}

function drawAscii(
  context: CanvasRenderingContext2D,
  viewport: { width: number; height: number },
  sampler: FilterSampler,
  backgroundSize: string,
  backgroundPosition: string,
  strength: number,
  size: number,
  spacing: number,
  hoverState: HoverRenderState
) {
  const metrics = getRenderedMediaMetrics(sampler, viewport, backgroundSize, backgroundPosition)
  const fontSize = Math.round(getControlRange(size, 8, viewport.width < 720 ? 24 : 26))
  context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  context.textBaseline = 'middle'
  context.textAlign = 'center'
  const glyphMetrics = getAsciiGlyphMetrics(context, fontSize)
  const xStep = Math.max(
    getControlRange(spacing, viewport.width < 720 ? 8 : 9, viewport.width < 720 ? 24 : 27),
    glyphMetrics.glyphWidth * 1.12
  )
  const lineHeight = Math.max(
    getControlRange(spacing, 10, viewport.width < 720 ? 26 : 28),
    glyphMetrics.glyphHeight * 1.16,
    fontSize * 1.08
  )
  for (let y = lineHeight / 2; y < viewport.height + lineHeight; y += lineHeight) {
    for (let x = xStep / 2; x < viewport.width + xStep; x += xStep) {
      const color = sampleColor(sampler, metrics, x, y)
      const tone = getEffectTone(getLuminance(color), strength)
      const hover = getHoverInfluence(x, y, viewport, hoverState)
      const nextTone = clampNumber(tone + (hover * 0.22), 0, 1)
      if (nextTone <= 0.015) continue
      const char = ASCII_CHARS[Math.round(nextTone * (ASCII_CHARS.length - 1))]
      if (!char || char === ' ') continue
      const ink = getCurvedEffectColor(color, nextTone, 0.42 + (hover * 0.24))
      context.globalAlpha = clampNumber(0.12 + (nextTone * 0.88) + (hover * 0.1), 0.08, 1)
      context.fillStyle = `rgb(${ink.red} ${ink.green} ${ink.blue})`
      context.fillText(char, x, y)
    }
  }
  context.globalAlpha = 1
}

function getRenderedMediaMetrics(
  sampler: FilterSampler,
  viewport: { width: number; height: number },
  backgroundSize: string,
  backgroundPosition: string
): RenderedMediaMetrics {
  const coverScale = Math.max(
    viewport.width / sampler.naturalWidth,
    viewport.height / sampler.naturalHeight
  )
  const customWidth = parseBackgroundWidth(backgroundSize, viewport)
  const scale = customWidth > 0 ? customWidth / sampler.naturalWidth : coverScale
  const renderedWidth = sampler.naturalWidth * scale
  const renderedHeight = sampler.naturalHeight * scale
  const [positionX, positionY] = parseBackgroundPosition(backgroundPosition)
  return {
    scale,
    offsetX: (viewport.width - renderedWidth) * positionX,
    offsetY: (viewport.height - renderedHeight) * positionY
  }
}

function parseBackgroundWidth(value: string, viewport: { width: number; height: number }): number {
  const normalized = String(value || '').trim()
  const maxMatch = /^max\(([\d.]+)vw,\s*([\d.]+)vh\)\s+auto$/i.exec(normalized)
  if (maxMatch) {
    return Math.max((Number(maxMatch[1]) / 100) * viewport.width, (Number(maxMatch[2]) / 100) * viewport.height)
  }
  const percentMatch = /^([\d.]+)%\s+auto$/i.exec(normalized)
  return percentMatch ? (Number(percentMatch[1]) / 100) * viewport.width : 0
}

function parseBackgroundPosition(value: string): [number, number] {
  if (String(value).trim() === 'center') return [0.5, 0.5]
  const match = /^([\d.]+)%\s+([\d.]+)%$/i.exec(String(value || '').trim())
  return match ? [Number(match[1]) / 100, Number(match[2]) / 100] : [0.5, 0.5]
}

function sampleColor(
  sampler: FilterSampler,
  metrics: RenderedMediaMetrics,
  viewportX: number,
  viewportY: number
): FilterColor {
  const sourceX = ((viewportX - metrics.offsetX) / metrics.scale) * sampler.scaleX
  const sourceY = ((viewportY - metrics.offsetY) / metrics.scale) * sampler.scaleY
  const x = Math.round(clampNumber(sourceX, 0, sampler.width - 1))
  const y = Math.round(clampNumber(sourceY, 0, sampler.height - 1))
  const index = (y * sampler.width + x) * 4
  const alpha = (sampler.data[index + 3] ?? 255) / 255
  return {
    red: Math.round((sampler.data[index] * alpha) + (255 * (1 - alpha))),
    green: Math.round((sampler.data[index + 1] * alpha) + (255 * (1 - alpha))),
    blue: Math.round((sampler.data[index + 2] * alpha) + (255 * (1 - alpha)))
  }
}

function getEffectTone(luminance: number, strength: number): number {
  const amount = clampNumber(strength, 0, 100) / 100
  const blackPoint = amount * 0.22
  const whitePoint = 1 - (amount * 0.08)
  const leveled = clampNumber((luminance - blackPoint) / Math.max(0.01, whitePoint - blackPoint), 0, 1)
  const curved = leveled * leveled * (3 - (2 * leveled))
  return (leveled * (1 - amount)) + (curved * amount)
}

function getCurvedEffectColor(color: FilterColor, tone: number, saturation: number): FilterColor {
  const luma = (color.red * 0.299) + (color.green * 0.587) + (color.blue * 0.114)
  const boost = 1 + saturation
  const contrastShift = 0.04 + (tone * 0.12)
  const saturated = {
    red: clampNumber(luma + ((color.red - luma) * boost), 0, 255),
    green: clampNumber(luma + ((color.green - luma) * boost), 0, 255),
    blue: clampNumber(luma + ((color.blue - luma) * boost), 0, 255)
  }
  return {
    red: Math.round(saturated.red + ((255 - saturated.red) * contrastShift)),
    green: Math.round(saturated.green + ((255 - saturated.green) * contrastShift)),
    blue: Math.round(saturated.blue + ((255 - saturated.blue) * contrastShift))
  }
}

function getLuminance(color: FilterColor): number {
  return ((color.red * 0.299) + (color.green * 0.587) + (color.blue * 0.114)) / 255
}

function getControlRange(value: number, minValue: number, maxValue: number): number {
  return minValue + ((maxValue - minValue) * clampNumber(value, 0, 100) / 100)
}

function getHoverInfluence(
  x: number,
  y: number,
  viewport: { width: number; height: number },
  hoverState: HoverRenderState
): number {
  if (hoverState.intensity <= 0) return 0
  const radius = viewport.width < 720 ? 92 : 132
  const distance = Math.hypot(x - hoverState.x, y - hoverState.y)
  if (distance > radius) return 0
  const falloff = 1 - clampNumber(distance / radius, 0, 1)
  const smoothed = falloff * falloff * (3 - (2 * falloff))
  return Math.pow(smoothed, 1.18) * hoverState.intensity
}

function getAsciiGlyphMetrics(
  context: CanvasRenderingContext2D,
  fontSize: number
): AsciiGlyphMetrics {
  if (asciiGlyphMetricsCache?.font === context.font && asciiGlyphMetricsCache.fontSize === fontSize) {
    return asciiGlyphMetricsCache
  }
  const glyphWidth = ASCII_CHARS.split('').reduce((maxWidth, char) => {
    return char === ' ' ? maxWidth : Math.max(maxWidth, context.measureText(char).width)
  }, fontSize * 0.62)
  const measured = context.measureText('@')
  asciiGlyphMetricsCache = {
    font: context.font,
    fontSize,
    glyphWidth,
    glyphHeight: measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent
  }
  return asciiGlyphMetricsCache
}

function doesFilterStyleSupportHover(value: string): boolean {
  return value === 'halftone' || value === 'ascii'
}

function isFilterHoverSafeTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(
    '#newtab-settings-drawer, .newtab-search-shell, ' +
    '.bookmark-folder-section, .newtab-speed-dial-panel, button, a, input, textarea, select, ' +
    '[role="button"], [contenteditable="true"]'
  ))
}

function isPointerInFilterSafeZone(clientX: number, clientY: number): boolean {
  const selectors = [
    '.newtab-search-shell',
    '.bookmark-folder-section',
    '.newtab-speed-dial-panel'
  ]
  return selectors.some((selector) => {
    return Array.from(document.querySelectorAll(selector)).some((element) => {
      const rect = element.getBoundingClientRect()
      const padding = 36
      return clientX >= rect.left - padding &&
        clientX <= rect.right + padding &&
        clientY >= rect.top - padding &&
        clientY <= rect.bottom + padding
    })
  })
}

function parseHexColor(value: string): FilterColor | null {
  const match = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim())
  if (!match) return null
  return {
    red: Number.parseInt(match[1].slice(0, 2), 16),
    green: Number.parseInt(match[1].slice(2, 4), 16),
    blue: Number.parseInt(match[1].slice(4, 6), 16)
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
