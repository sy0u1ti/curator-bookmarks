import type {
  FlutedGlassProps,
  HalftoneCmykProps,
  HalftoneDotsProps,
  ImageDitheringProps,
  PaperTextureProps,
  ShaderComponentProps,
  WaterProps
} from '@paper-design/shaders-react'
import { Component, lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FC, type ReactNode } from 'react'
import { prefersReducedMotion } from '../../shared/motion'
import { isPaperShaderMaskStyle, type PaperShaderMaskStyle } from '../background-mask-settings'
import { useNewtabBackgroundMediaView } from '../newtab-background-media-store'
import { useNewtabBackgroundSettingsView } from '../newtab-background-settings-store'
import { getBackgroundMediaRect, setBackgroundFilterStatus, supportsBackgroundShaders } from '../background-filter-runtime'

const SHADER_BACKGROUND = '#101013'
const SHADER_HIGHLIGHT = '#ededed'
const SHADER_MAX_PIXEL_COUNT = 1920 * 1080

const PaperTexture = lazy(() => import('@paper-design/shaders-react').then((module) => ({ default: module.PaperTexture }))) as FC<PaperTextureProps>
const FlutedGlass = lazy(() => import('@paper-design/shaders-react').then((module) => ({ default: module.FlutedGlass }))) as FC<FlutedGlassProps>
const Water = lazy(() => import('@paper-design/shaders-react').then((module) => ({ default: module.Water }))) as FC<WaterProps>
const ImageDithering = lazy(() => import('@paper-design/shaders-react').then((module) => ({ default: module.ImageDithering }))) as FC<ImageDitheringProps>
const HalftoneDots = lazy(() => import('@paper-design/shaders-react').then((module) => ({ default: module.HalftoneDots }))) as FC<HalftoneDotsProps>
const HalftoneCmyk = lazy(() => import('@paper-design/shaders-react').then((module) => ({ default: module.HalftoneCmyk }))) as FC<HalftoneCmykProps>

type ShaderLayerStyle = CSSProperties & {
  '--paper-shader-opacity': string
}

interface ShaderSizing {
  fit: 'cover'
  originX: number
  originY: number
  scale: number
}

export function NewtabPaperShaderLayer() {
  const media = useNewtabBackgroundMediaView()
  const background = useNewtabBackgroundSettingsView()
  const maskStyle = background.maskStyle

  if (
    !background.maskEnabled ||
    background.maskFilterStrength === 0 ||
    !isPaperShaderMaskStyle(maskStyle) ||
    media.kind === 'video' ||
    (media.kind === 'none' && background.type !== 'color') ||
    !supportsBackgroundShaders()
  ) {
    return null
  }

  return (
    <ShaderErrorBoundary key={`${maskStyle}:${media.src}`} maskStyle={maskStyle}>
      <ActivePaperShaderLayer
        backgroundColor={background.color}
        backgroundPosition={media.backgroundPosition}
        backgroundSize={media.backgroundSize}
        imageSource={media.kind === 'image' ? media.src : ''}
        size={background.maskFilterSize}
        spacing={background.maskFilterSpacing}
        strength={background.maskFilterStrength}
        style={maskStyle}
      />
    </ShaderErrorBoundary>
  )
}

function ActivePaperShaderLayer({
  backgroundColor,
  backgroundPosition,
  backgroundSize,
  imageSource,
  size: sizeValue,
  spacing: spacingValue,
  strength: strengthValue,
  style: maskStyle
}: {
  backgroundColor: string
  backgroundPosition: string
  backgroundSize: string
  imageSource: string
  size: number
  spacing: number
  strength: number
  style: PaperShaderMaskStyle
}) {
  const image = useShaderImageSource(imageSource, backgroundColor, backgroundSize, backgroundPosition, maskStyle)
  const motionPaused = useSyncExternalStore(subscribeMotionPreference, isMotionPaused, () => true)
  const hostRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const lost = () => {
      host.style.visibility = 'hidden'
      setBackgroundFilterStatus(maskStyle, '图形加速上下文已中断。请切换样式重试，原背景和遮罩仍然保留。')
    }
    host.addEventListener('webglcontextlost', lost, true)
    return () => host.removeEventListener('webglcontextlost', lost, true)
  }, [image, maskStyle])

  const strength = strengthValue / 100
  const size = sizeValue / 100
  const spacing = spacingValue / 100
  const sizing: ShaderSizing = { fit: 'cover', originX: 0.5, originY: 0.5, scale: 1 }
  const shared: ShaderComponentProps = {
    className: 'absolute inset-0 size-full',
    height: '100%',
    maxPixelCount: SHADER_MAX_PIXEL_COUNT,
    minPixelRatio: 1,
    style: { width: '100%', height: '100%' },
    width: '100%'
  }
  const style: ShaderLayerStyle = {
    '--paper-shader-opacity': String(getShaderOpacity(maskStyle, strength)),
    opacity: 'var(--paper-shader-opacity)'
  }

  if (!image) return null
  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="newtab-paper-shader pointer-events-none fixed inset-0 z-0 overflow-hidden"
      data-effect={maskStyle}
      style={style}
    >
      <Suspense fallback={null}>
        {renderPaperShader(maskStyle, image, strength, size, spacing, sizing, shared, motionPaused)}
      </Suspense>
    </div>
  )
}

function renderPaperShader(
  style: PaperShaderMaskStyle,
  image: string,
  strength: number,
  size: number,
  spacing: number,
  sizing: ShaderSizing,
  shared: ShaderComponentProps,
  motionPaused: boolean
): ReactNode {
  if (style === 'paper-texture') {
    return (
      <PaperTexture
        {...shared}
        {...sizing}
        image={image || undefined}
        colorBack={SHADER_BACKGROUND}
        colorFront={SHADER_HIGHLIGHT}
        contrast={0.08 + strength * 0.22}
        roughness={0.12 + strength * 0.42}
        fiber={0.06 + strength * 0.26}
        fiberSize={0.25 + size * 0.55}
        crumples={strength * 0.12}
        crumpleSize={0.28 + spacing * 0.42}
        folds={strength * 0.04}
        foldCount={3 + Math.round(size * 5)}
        fade={0.12}
        drops={strength * 0.08}
        seed={17}
        speed={0}
      />
    )
  }

  if (style === 'fluted-glass') {
    return (
      <FlutedGlass
        {...shared}
        {...sizing}
        image={image}
        colorBack="#00000000"
        colorShadow="#000000"
        colorHighlight={SHADER_HIGHLIGHT}
        shadows={0.08 + strength * 0.2}
        highlights={0.02 + strength * 0.08}
        size={0.18 + size * 0.58}
        distortion={0.08 + strength * 0.34}
        blur={strength * 0.1}
        edges={0.08 + strength * 0.16}
        stretch={spacing * 0.18}
        grainMixer={strength * 0.05}
        grainOverlay={strength * 0.035}
        shape="linesIrregular"
        distortionShape="lens"
        speed={0}
      />
    )
  }

  if (style === 'water') {
    return (
      <Water
        {...shared}
        {...sizing}
        image={image}
        colorBack={SHADER_BACKGROUND}
        colorHighlight={SHADER_HIGHLIGHT}
        highlights={0.02 + strength * 0.08}
        layering={0.08 + spacing * 0.24}
        edges={0.04 + strength * 0.16}
        caustic={0.05 + strength * 0.22}
        waves={0.04 + strength * 0.18}
        size={0.8 + size * 2.4}
        speed={motionPaused ? 0 : 0.06 + strength * 0.08}
      />
    )
  }

  if (style === 'image-dithering') {
    return (
      <ImageDithering
        {...shared}
        {...sizing}
        image={image}
        colorBack={SHADER_BACKGROUND}
        colorFront={SHADER_HIGHLIGHT}
        colorHighlight="#878787"
        colorSteps={2 + Math.round(spacing * 4)}
        originalColors
        size={1 + size * 10}
        type="4x4"
        speed={0}
      />
    )
  }

  if (style === 'halftone-dots') {
    return (
      <HalftoneDots
        {...shared}
        {...sizing}
        image={image}
        colorBack={SHADER_BACKGROUND}
        colorFront={SHADER_HIGHLIGHT}
        contrast={0.18 + strength * 0.42}
        grainMixer={strength * 0.08}
        grainOverlay={strength * 0.06}
        grainSize={0.25 + spacing * 0.55}
        grid="hex"
        originalColors
        radius={0.7 + spacing * 0.8}
        size={0.08 + size * 0.52}
        type="classic"
        speed={0}
      />
    )
  }

  return (
    <HalftoneCmyk
      {...shared}
      {...sizing}
      image={image}
      colorBack="#e8e7e2"
      colorC="#256d7a"
      colorM="#7b465b"
      colorY="#8a7838"
      colorK="#171719"
      contrast={0.8 + strength * 0.45}
      softness={0.55 + spacing * 0.35}
      grainSize={0.25 + spacing * 0.5}
      grainMixer={strength * 0.08}
      grainOverlay={strength * 0.06}
      gridNoise={strength * 0.08}
      size={0.08 + size * 0.32}
      type="ink"
      speed={0}
    />
  )
}

function getShaderOpacity(style: PaperShaderMaskStyle, strength: number): number {
  return style === 'paper-texture' ? strength * 0.65 : strength
}

function isMotionPaused(): boolean {
  return document.hidden || prefersReducedMotion()
}

function subscribeMotionPreference(notify: () => void): () => void {
  const preference = matchMedia('(prefers-reduced-motion: reduce)')
  preference.addEventListener('change', notify)
  document.addEventListener('visibilitychange', notify)
  return () => {
    preference.removeEventListener('change', notify)
    document.removeEventListener('visibilitychange', notify)
  }
}

class ShaderErrorBoundary extends Component<{ children: ReactNode; maskStyle: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() {
    setBackgroundFilterStatus(this.props.maskStyle, '滤镜加载失败。请切换样式重试；原背景和遮罩仍然保留。')
  }
  render() { return this.state.failed ? null : this.props.children }
}

function useShaderImageSource(source: string, fallbackColor: string, backgroundSize: string, backgroundPosition: string, maskStyle: string): string {
  const key = JSON.stringify([source, fallbackColor, backgroundSize, backgroundPosition])
  const [resolved, setResolved] = useState({ key: '', source: '' })

  useEffect(() => {
    let cancelled = false
    let resizeTimer = 0
    const image = new Image()
    if (/^https?:/i.test(source)) image.crossOrigin = 'anonymous'
    const fail = () => {
      if (cancelled) return
      setResolved({ key, source: '' })
      setBackgroundFilterStatus(maskStyle, '滤镜无法读取这张图片。请下载后使用本地图片，原背景和遮罩仍然保留。')
    }
    const render = () => {
      if (cancelled || (source && !image.naturalWidth)) return
      const width = window.innerWidth
      const height = window.innerHeight
      const scale = Math.min(1, Math.sqrt(SHADER_MAX_PIXEL_COUNT / (width * height)))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      const context = canvas.getContext('2d')
      if (!context) { fail(); return }
      context.fillStyle = fallbackColor
      context.fillRect(0, 0, canvas.width, canvas.height)
      if (source) {
        const rect = getBackgroundMediaRect(image.naturalWidth, image.naturalHeight, canvas, backgroundSize, backgroundPosition)
        context.drawImage(image, rect.offsetX, rect.offsetY, image.naturalWidth * rect.scale, image.naturalHeight * rect.scale)
      }
      try {
        setResolved({ key, source: canvas.toDataURL('image/png') })
        setBackgroundFilterStatus(maskStyle, '')
      } catch { fail() }
    }
    const resize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(render, 120)
    }
    image.onload = render
    image.onerror = fail
    if (source) image.src = source
    else render()
    window.addEventListener('resize', resize, { passive: true })
    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', resize)
    }
  }, [key, source, fallbackColor, backgroundSize, backgroundPosition, maskStyle])

  return resolved.key === key ? resolved.source : ''
}
