import {
  Component, lazy, memo, Suspense, useLayoutEffect, useSyncExternalStore,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { useNewtabBackgroundSettingsView } from '../newtab-background-settings-store'
import { acceptsTexturePointer, isTextureMotionAllowed } from '../texture-interaction'
import type { TexturePreset } from '../texture-settings'

const textures = {
  current: lazy(() => import('../../vendor/textures/current').then(module => ({ default: module.Current }))),
  settle: lazy(() => import('../../vendor/textures/settle').then(module => ({ default: module.Settle }))),
  curtain: lazy(() => import('../../vendor/textures/curtain').then(module => ({ default: module.Curtain }))),
  sphere: lazy(() => import('../../vendor/textures/sphere').then(module => ({ default: module.Sphere }))),
  watch: lazy(() => import('../../vendor/textures/watch').then(module => ({ default: module.Watch }))),
  twist: lazy(() => import('../../vendor/textures/twist').then(module => ({ default: module.Twist })))
}
const tokens = { '--texture-ink': '#ffffff', '--texture-field': 'transparent' }
const motion = { eventTarget: window, acceptsPointer: acceptsTexturePointer }
const mediaQueries = [
  '(prefers-reduced-motion: reduce)', '(update: slow)',
  '(hover: none), (pointer: coarse)', '(forced-colors: active)'
]

function subscribeMotionEnvironment(notify: () => void): () => void {
  const queries = mediaQueries.map(query => matchMedia(query))
  queries.forEach(query => query.addEventListener('change', notify))
  document.addEventListener('visibilitychange', notify)
  return () => {
    queries.forEach(query => query.removeEventListener('change', notify))
    document.removeEventListener('visibilitychange', notify)
  }
}

function motionAllowed(): boolean {
  const [reducedMotion, slowUpdates, coarsePointer, forcedColors] = mediaQueries.map(query => matchMedia(query).matches)
  return isTextureMotionAllowed({
    visible: !document.hidden, reducedMotion, slowUpdates, coarsePointer, forcedColors
  })
}

export default function NewtabTextureLayer() {
  const settings = useNewtabBackgroundSettingsView()
  const allowed = useSyncExternalStore(subscribeMotionEnvironment, motionAllowed, () => false)
  const stage = document.getElementById('newtab-texture-stage')
  if (!stage || settings.type !== 'texture' || !settings.textureMotion || !settings.textureIntensity || !allowed) return null

  return createPortal(
    <TextureErrorBoundary key={settings.texturePreset}>
      <Suspense fallback={null}>
        <LiveTexture key={settings.texturePreset} preset={settings.texturePreset} stage={stage} />
      </Suspense>
    </TextureErrorBoundary>,
    stage
  )
}

const LiveTexture = memo(function LiveTexture({ preset, stage }: { preset: TexturePreset; stage: HTMLElement }) {
  const Texture = textures[preset]
  useLayoutEffect(() => {
    // Swap only after the actual SVG commits. The same static SVG paints first.
    stage.dataset.liveTexture = preset
    return () => { delete stage.dataset.liveTexture }
  }, [preset, stage])
  return (
    <div className="newtab-texture-live" data-texture-background="true" aria-hidden="true">
      <Texture tokens={tokens} motion={motion} />
    </div>
  )
})

class TextureErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.warn('纹理动效不可用，保留静态背景。', error) }
  render() { return this.state.failed ? null : this.props.children }
}
