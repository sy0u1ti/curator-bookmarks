import { createUiViewStoreSlice, useUiViewStoreSlice } from '../shared/ui-view-store.js'
import { isPaperShaderMaskStyle } from './background-mask-settings.js'

let webGl2Support: boolean | undefined

export function supportsBackgroundShaders(): boolean {
  if (webGl2Support !== undefined) return webGl2Support
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

export function getBackgroundFilterUnavailableReason(style: string, type: string): string {
  if (!isPaperShaderMaskStyle(style)) return ''
  if (type === 'video') return '此样式需要静态图片。视频可使用渐变、磨砂、颗粒、单色网点或 ASCII；切回图片后恢复此样式。'
  if (!supportsBackgroundShaders()) return '浏览器未提供 WebGL 2。请启用图形加速，或选择渐变、磨砂、颗粒、单色网点或 ASCII。'
  return ''
}

const status = createUiViewStoreSlice('newtab', 'background-filter-status', { style: '', message: '' })

export function setBackgroundFilterStatus(style: string, message: string): void {
  status.setState({ style, message })
}

export function useBackgroundFilterStatus() {
  return useUiViewStoreSlice(status)
}

/** Match CSS background-size/position before sampling or passing an image to a shader. */
export function getBackgroundMediaRect(
  naturalWidth: number,
  naturalHeight: number,
  viewport: { width: number; height: number },
  backgroundSize: string,
  backgroundPosition: string
) {
  const coverScale = Math.max(viewport.width / naturalWidth, viewport.height / naturalHeight)
  const maxMatch = /^max\(([\d.]+)vw,\s*([\d.]+)vh\)\s+auto$/i.exec(backgroundSize.trim())
  const percentMatch = /^([\d.]+)%\s+auto$/i.exec(backgroundSize.trim())
  const customWidth = maxMatch
    ? Math.max(Number(maxMatch[1]) * viewport.width / 100, Number(maxMatch[2]) * viewport.height / 100)
    : percentMatch ? Number(percentMatch[1]) * viewport.width / 100 : 0
  const scale = customWidth > 0 ? customWidth / naturalWidth : coverScale
  const position = /^([\d.]+)%\s+([\d.]+)%$/i.exec(backgroundPosition.trim())
  const x = position ? Number(position[1]) / 100 : 0.5
  const y = position ? Number(position[2]) / 100 : 0.5
  return {
    scale,
    offsetX: (viewport.width - naturalWidth * scale) * x,
    offsetY: (viewport.height - naturalHeight * scale) * y
  }
}
