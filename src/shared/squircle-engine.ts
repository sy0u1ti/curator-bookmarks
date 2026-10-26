import { generateClipPath, getLayoutSize, observeResize } from '@lisse/core'

/**
 * Smooth only decorative artwork. A clip does not redraw a CSS border or
 * focus ring along its path: clipping native rounded controls cuts their
 * corners and focus indicators. Interactive surfaces retain native radii.
 * Borderless artwork can opt in with data-squircle="on" or the eager API.
 */

const SMOOTHING = 0.6
const MIN_RADIUS_PX = 3
const ENGINE_FLAG = '__curatorSquircleEngine'
const SQUIRCLE_CLASS_HINT = /(?:^|\s)(?:bookmark-icon-shell|bookmark-favicon|bookmark-fallback|bookmark-folder-card-icon)(?:\s|$)/
const INTERACTIVE_SELECTOR = 'button, input, textarea, select, a[href], [tabindex], [contenteditable="true"], [role="button"], [role="switch"], [role="checkbox"]'

interface TrackedEntry {
  unobserve: () => void
}

const tracked = new Map<HTMLElement, TrackedEntry>()

let pendingScan: Set<HTMLElement> | null = null
let scanScheduled = false
let sweepRequested = false

function parseRadiusPx(raw: string): number | null {
  // 计算样式可能返回 "8px"、"8px 12px"（椭圆角）或百分比；只处理单值 px。
  if (!raw || raw.includes('%') || raw.includes(' ')) return null
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : null
}

function readCornerRadii(style: CSSStyleDeclaration): [number, number, number, number] | null {
  const topLeft = parseRadiusPx(style.borderTopLeftRadius)
  const topRight = parseRadiusPx(style.borderTopRightRadius)
  const bottomRight = parseRadiusPx(style.borderBottomRightRadius)
  const bottomLeft = parseRadiusPx(style.borderBottomLeftRadius)
  if (topLeft === null || topRight === null || bottomRight === null || bottomLeft === null) return null
  return [topLeft, topRight, bottomRight, bottomLeft]
}

function requiresNativeContour(el: HTMLElement, style: CSSStyleDeclaration): boolean {
  // Reserve even transparent borders: hover, selection and forced colors can
  // paint them later without changing the element's class or layout size.
  return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
    .some(width => Number.parseFloat(width) > 0) ||
    style.boxShadow !== 'none' ||
    (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) ||
    el.matches(INTERACTIVE_SELECTOR) ||
    el.querySelector(INTERACTIVE_SELECTOR) !== null
}

function cornerOptions(radii: [number, number, number, number]) {
  const corner = (radius: number) => ({ radius, smoothing: SMOOTHING, preserveSmoothing: false })
  return {
    topLeft: corner(radii[0]),
    topRight: corner(radii[1]),
    bottomRight: corner(radii[2]),
    bottomLeft: corner(radii[3]),
  }
}

const clipPathCache = new Map<string, string>()
const CLIP_PATH_CACHE_LIMIT = 512

/**
 * 同一个列表里的行尺寸和圆角完全一致，虚拟滚动回收时会反复要同一条路径。
 * 路径只由 (宽, 高, 四角半径) 决定，缓存起来就不必每次重算。
 */
function generateClipPathCached(
  width: number,
  height: number,
  radii: [number, number, number, number]
): string {
  const key = `${width}|${height}|${radii[0]},${radii[1]},${radii[2]},${radii[3]}`
  const cached = clipPathCache.get(key)
  if (cached !== undefined) return cached
  const clipPath = generateClipPath(width, height, cornerOptions(radii))
  // 尺寸种类是有限的；真到了上限说明页面在连续缩放，整表丢弃即可。
  if (clipPathCache.size >= CLIP_PATH_CACHE_LIMIT) clipPathCache.clear()
  clipPathCache.set(key, clipPath)
  return clipPath
}

const pendingClip = new Set<HTMLElement>()
let clipScheduled = false

/**
 * resize 驱动的重新裁剪走批处理：逐元素「读样式→读布局→写 clip-path」会让
 * 每次写入都作废后一个元素的布局信息，虚拟列表滚动时这条交错读写是布局
 * 抖动的主要来源。这里与 applySquircleClipBeforePaint 采用同一策略——
 * 先全量测量，再全量写入。
 */
function scheduleClip(el: HTMLElement): void {
  pendingClip.add(el)
  if (clipScheduled) return
  clipScheduled = true
  requestAnimationFrame(flushPendingClip)
}

function flushPendingClip(): void {
  clipScheduled = false
  if (!pendingClip.size) return
  const batch = [...pendingClip]
  pendingClip.clear()

  const measured: Array<[HTMLElement, string | null]> = []
  for (const el of batch) {
    if (!el.isConnected) continue
    measured.push([el, measureSquircleClipPath(el)])
  }

  for (const [el, clipPath] of measured) {
    if (clipPath === null) {
      clearClip(el)
      continue
    }
    el.style.clipPath = clipPath
    if (el.dataset.sq !== 'on') el.dataset.sq = 'on'
  }
}

function applyClip(el: HTMLElement): void {
  if (!el.isConnected) return
  const clipPath = measureSquircleClipPath(el)
  if (clipPath === null) {
    clearClip(el)
    return
  }
  el.style.clipPath = clipPath
  if (el.dataset.sq !== 'on') el.dataset.sq = 'on'
}

/** applyClip 的读段：只测量不写样式，返回 null 表示该元素不应持有 squircle clip。 */
function measureSquircleClipPath(el: HTMLElement): string | null {
  const style = getComputedStyle(el)
  const radii = readCornerRadii(style)
  if (!radii) return null
  const maxRadius = Math.max(...radii)
  if (maxRadius < MIN_RADIUS_PX) return null
  if (requiresNativeContour(el, style)) return null
  const { width, height } = getLayoutSize(el)
  if (width < 2 || height < 2) return null
  // 胶囊 / 圆形：圆弧已占满短边，squircle 退化为圆，交给原生渲染。
  if (maxRadius * 2 >= Math.min(width, height) - 0.5) return null
  return generateClipPathCached(width, height, radii)
}

let eagerBatch: HTMLElement[] | null = null

/**
 * 供首屏关键元素（书签图标外壳等）在挂载 ref 里调用：同一微任务内批量
 * 测量并写入 squircle clip-path，在首次 paint 前完成——不等常规的
 * MutationObserver → rAF → ResizeObserver 异步链（那条链要晚 1-2 帧，
 * 首帧会以普通圆角示人，随后突变成 squircle，产生可见形变）。
 * 先全量测量再全量写入，避免逐元素读写交错造成布局抖动。
 * 引擎稍后扫描到这些元素时（data-sq="on"）仍会接管 resize 跟踪。
 */
export function applySquircleClipBeforePaint(el: HTMLElement): void {
  if (typeof ResizeObserver === 'undefined') return
  if (el.closest('[data-squircle="off"], [data-squircle-subtree="off"]')) return
  if (eagerBatch) {
    eagerBatch.push(el)
    return
  }
  eagerBatch = [el]
  queueMicrotask(() => {
    const batch = eagerBatch ?? []
    eagerBatch = null
    const clips = batch.map((element) =>
      element.isConnected && getComputedStyle(element).clipPath === 'none'
        ? measureSquircleClipPath(element)
        : null
    )
    for (const [index, element] of batch.entries()) {
      const clipPath = clips[index]
      if (!clipPath) continue
      element.style.clipPath = clipPath
      element.dataset.sq = 'on'
    }
  })
}

function clearClip(el: HTMLElement): void {
  if (el.dataset.sq === 'on') {
    el.style.clipPath = ''
    delete el.dataset.sq
  }
}

function consider(el: HTMLElement): void {
  if (tracked.has(el) || !el.isConnected) return
  if (el.dataset.squircle === 'off') return
  const className = el.getAttribute('class') ?? ''
  // Controls and layout containers never opt in merely by having a radius.
  if (!isPotentialSquircleCandidate(el, className)) return
  const style = getComputedStyle(el)
  // 元素自带 clip-path（开关滑块、壁纸遮罩等）不参与，避免互相覆盖；
  // 引擎自己写过的（data-sq="on"，含首帧 eager 路径）要接管 resize 跟踪。
  if (style.clipPath !== 'none' && el.dataset.sq !== 'on') return
  const radii = readCornerRadii(style)
  if (!radii || Math.max(...radii) < MIN_RADIUS_PX) return
  if (requiresNativeContour(el, style)) {
    clearClip(el)
    return
  }
  const unobserve = observeResize(el, () => scheduleClip(el))
  tracked.set(el, { unobserve })
}

function isPotentialSquircleCandidate(el: HTMLElement, className: string): boolean {
  return el.dataset.sq === 'on' ||
    el.dataset.squircle === 'on' ||
    SQUIRCLE_CLASS_HINT.test(className)
}

function untrack(el: HTMLElement): void {
  const entry = tracked.get(el)
  if (!entry) return
  entry.unobserve()
  tracked.delete(el)
  clearClip(el)
}

function scanSubtree(root: Element): void {
  // Recycled rows are observed as newly added subtrees. Their parent opt-out
  // still applies; do not attach resize/clip work again on every scroll or hover.
  if (root.closest('[data-squircle-subtree="off"]')) return
  if (root instanceof HTMLElement) {
    if (root.dataset.squircleSubtree === 'off') return
    consider(root)
  }
  const descendants = root.querySelectorAll<HTMLElement>('*')
  let skippedSubtree: HTMLElement | null = null
  for (const el of descendants) {
    if (!(el instanceof HTMLElement)) continue
    if (skippedSubtree?.contains(el)) continue
    skippedSubtree = null
    if (el.dataset.squircleSubtree === 'off') {
      skippedSubtree = el
      continue
    }
    consider(el)
  }
}

function flushPendingScan(): void {
  scanScheduled = false
  const batch = pendingScan
  pendingScan = null
  if (batch) {
    for (const el of batch) {
      if (!el.isConnected) continue
      scanSubtree(el)
    }
  }
  // 只有真的发生过移除才需要清扫。滚动时几乎每帧都有新增，
  // 无条件全量遍历 tracked 会把这份代价摊到每一帧上。
  if (sweepRequested) {
    sweepRequested = false
    for (const el of tracked.keys()) {
      if (!el.isConnected) untrack(el)
    }
  }
}

function scheduleScan(el: HTMLElement): void {
  pendingScan ??= new Set()
  pendingScan.add(el)
  if (!scanScheduled) {
    scanScheduled = true
    // rAF 合批：与 core 的 ResizeObserver 节奏一致，每帧最多一次样式读取。
    requestAnimationFrame(flushPendingScan)
  }
}

function handleMutations(mutations: MutationRecord[]): void {
  let sawRemoval = false
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      const target = mutation.target
      if (target instanceof HTMLElement) {
        // 类名 / 开关变化：撤销既有跟踪后按新状态重新评估。
        untrack(target)
        scheduleScan(target)
      }
      continue
    }
    if (mutation.removedNodes.length > 0) {
      sawRemoval = true
      sweepRequested = true
    }
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) scheduleScan(node)
    }
  }
  if (sawRemoval && !scanScheduled && tracked.size > 0) {
    scanScheduled = true
    requestAnimationFrame(flushPendingScan)
  }
}

export function initSquircleEngine(): void {
  const host = window as typeof window & Record<string, unknown>
  if (host[ENGINE_FLAG]) return
  host[ENGINE_FLAG] = true
  if (typeof ResizeObserver === 'undefined') return

  const start = () => {
    scanSubtree(document.documentElement)
    const observer = new MutationObserver(handleMutations)
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-squircle', 'data-squircle-subtree'],
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
