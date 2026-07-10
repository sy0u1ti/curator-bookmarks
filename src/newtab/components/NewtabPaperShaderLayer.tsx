import type {
  FlutedGlassProps,
  HalftoneCmykProps,
  HalftoneDotsProps,
  ImageDitheringProps,
  PaperTextureProps,
  ShaderComponentProps,
  WaterProps
} from '@paper-design/shaders-react'
import { lazy, Suspense, useEffect, useState, type CSSProperties, type FC, type ReactNode } from 'react'
import { prefersReducedMotion } from '../../shared/motion'
import { isPaperShaderMaskStyle, type PaperShaderMaskStyle } from '../background-mask-settings'
import { useNewtabBackgroundMediaView } from '../newtab-background-media-store'
import { useNewtabBackgroundSettingsView } from '../newtab-background-settings-store'

const SHADER_BACKGROUND = '#101013'
const SHADER_HIGHLIGHT = '#ededed'
const SHADER_MAX_PIXEL_COUNT = 1920 * 1080
let webGl2Support: boolean | null = null

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
    !isPaperShaderMaskStyle(maskStyle) ||
    media.kind === 'video' ||
    !supportsWebGl2()
  ) {
    return null
  }

  return (
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
  const image = useShaderImageSource(imageSource, backgroundColor)

  const strength = strengthValue / 100
  const size = sizeValue / 100
  const spacing = spacingValue / 100
  const sizing = getShaderSizing(backgroundSize, backgroundPosition)
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

  return (
    <div
      aria-hidden="true"
      className="newtab-paper-shader pointer-events-none fixed inset-0 z-0 overflow-hidden"
      data-effect={maskStyle}
      style={style}
    >
      <Suspense fallback={null}>
        {renderPaperShader(maskStyle, image, strength, size, spacing, sizing, shared)}
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
  shared: ShaderComponentProps
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
        speed={prefersReducedMotion() ? 0 : 0.06 + strength * 0.08}
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
  if (strength <= 0) return 0
  if (style === 'paper-texture') return 0.16 + strength * 0.34
  if (style === 'fluted-glass' || style === 'water') return 0.2 + strength * 0.48
  return 0.32 + strength * 0.6
}

function getShaderSizing(backgroundSize: string, backgroundPosition: string): ShaderSizing {
  const sizeMatch = backgroundSize.match(/([\d.]+)(?:%|vw)/i)
  const size = sizeMatch ? Number.parseFloat(sizeMatch[1]) : Number.NaN
  const [rawX = '50', rawY = '50'] = backgroundPosition.split(/\s+/)
  const x = Number.parseFloat(rawX)
  const y = Number.parseFloat(rawY)
  return {
    fit: 'cover',
    scale: Number.isFinite(size) ? Math.max(1, size / 100) : 1,
    originX: Number.isFinite(x) ? Math.min(1, Math.max(0, x / 100)) : 0.5,
    originY: Number.isFinite(y) ? Math.min(1, Math.max(0, y / 100)) : 0.5
  }
}

function supportsWebGl2(): boolean {
  if (webGl2Support !== null) return webGl2Support
  if (typeof document === 'undefined') return false
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    webGl2Support = Boolean(context)
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webGl2Support = false
  }
  return webGl2Support
}

function useShaderImageSource(source: string, fallbackColor: string): string {
  const fallback = createShaderFallbackImage(fallbackColor)
  const directSource = source && !/^https?:/i.test(source) ? source : ''
  const [resolvedSource, setResolvedSource] = useState(directSource || fallback)

  useEffect(() => {
    if (!source || !/^https?:/i.test(source)) {
      setResolvedSource(source || fallback)
      return
    }

    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (!cancelled) setResolvedSource(source)
    }
    image.onerror = () => {
      if (!cancelled) setResolvedSource(fallback)
    }
    image.src = source
    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
    }
  }, [fallback, source])

  return resolvedSource
}

function createShaderFallbackImage(fallbackColor: string): string {
  const color = /^#[0-9a-f]{6}$/i.test(fallbackColor) ? fallbackColor : SHADER_BACKGROUND
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="${color}" d="M0 0h2v2H0z"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
