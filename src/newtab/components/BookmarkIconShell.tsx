import { useCallback, useState, type Ref } from 'react'
import { cx } from '../../ui/base/utils'
import { applySquircleClipBeforePaint } from '../../shared/squircle-engine'
import {
  clearActiveFaviconSource,
  isChromeFaviconSource,
  resolveActiveFaviconForChromeSource
} from '../active-favicon'
import {
  isNewtabFaviconReady,
  markNewtabFaviconNotReady,
  markNewtabFaviconReady
} from '../newtab-favicon-readiness'
import { getCachedFaviconContrast, readFaviconContrast, type FaviconContrast } from '../favicon-contrast'

export interface BookmarkIconShellFavicon {
  fetchpriority: 'high' | 'low' | 'auto'
  loading: 'eager' | 'lazy'
  pageUrl: string
  src: string
}

export interface BookmarkIconShellProps {
  className?: string
  customIcon: boolean
  fallbackLabel: string
  favicon: BookmarkIconShellFavicon
  ref?: Ref<HTMLSpanElement>
}

const BOOKMARK_ICON_SHELL_CLASS = 'bookmark-icon-shell relative grid h-[var(--icon-shell-size)] w-[var(--icon-shell-size)] place-items-center overflow-hidden rounded-[var(--ui-radius-control)] border border-[rgba(245,245,247,0.14)] bg-[rgba(0,0,0,0.32)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] [transition:var(--bookmark-icon-transition,border-color_var(--bookmark-hover-duration,0ms)_var(--ui-ease-standard),background-color_var(--bookmark-hover-duration,0ms)_var(--ui-ease-standard),box-shadow_var(--bookmark-hover-duration,0ms)_var(--ui-ease-standard))] group-active/bookmark-tile:border-[var(--bookmark-icon-active-border,rgba(245,245,247,0.24))] group-active/bookmark-tile:bg-[var(--bookmark-icon-active-bg,rgba(0,0,0,0.48))] group-active/bookmark-tile:duration-[var(--ds-motion-feedback)]'
const BOOKMARK_FAVICON_CLASS = 'bookmark-favicon relative z-[1] block h-[calc(var(--icon-shell-size)*0.68)] w-[calc(var(--icon-shell-size)*0.68)] rounded-[5px] object-contain opacity-0 [transform:scale(0.92)] [transition:opacity_var(--icon-swap-dur)_var(--icon-swap-ease),transform_var(--icon-swap-dur)_var(--icon-swap-ease)] data-[favicon-ready=true]:opacity-100 data-[favicon-ready=true]:[transform:scale(1)] [-webkit-user-drag:none] motion-reduce:transition-none motion-reduce:[transform:none]'
const BOOKMARK_CUSTOM_FAVICON_CLASS = 'custom-icon h-[calc(var(--icon-shell-size)*0.8)] w-[calc(var(--icon-shell-size)*0.8)] rounded-[7px] object-cover'
const BOOKMARK_FALLBACK_CLASS = 'bookmark-fallback absolute grid h-[calc(var(--icon-shell-size)*0.76)] w-[calc(var(--icon-shell-size)*0.76)] place-items-center rounded-[7px] bg-[rgba(245,245,247,0.09)] text-[13px] font-extrabold leading-none text-[rgba(245,245,247,0.88)] opacity-100 [transform:scale(1)] [transition:opacity_var(--icon-swap-dur)_var(--icon-swap-ease),transform_var(--icon-swap-dur)_var(--icon-swap-ease)] data-[favicon-ready=true]:opacity-0 data-[favicon-ready=true]:[transform:scale(0.96)] motion-reduce:transition-none motion-reduce:[transform:none]'

function addSourceToSet(current: Set<string>, source: string): Set<string> {
  if (current.has(source)) {
    return current
  }
  const next = new Set(current)
  next.add(source)
  return next
}

export function BookmarkIconShell({
  className,
  customIcon,
  fallbackLabel,
  favicon,
  ref
}: BookmarkIconShellProps) {
  const [failedSources, setFailedSources] = useState(() => new Set<string>())
  const [loadedSources, setLoadedSources] = useState(() => {
    const sources = new Set<string>()
    if (isNewtabFaviconReady(favicon.src)) {
      sources.add(favicon.src)
    }
    return sources
  })
  // 主动获取的站点图标作为本地覆盖层叠加在视图模型之上：视图模型保留浏览器
  // 图标来源，覆盖层只替换当前展示，避免为一次图标解析重建整棵书签树。
  const [activeSource, setActiveSource] = useState<{ forSource: string; src: string } | null>(null)
  const source = activeSource && activeSource.forSource === favicon.src ? activeSource.src : favicon.src
  const missing = failedSources.has(source)
  const loaded = loadedSources.has(source) || isNewtabFaviconReady(source)
  const [contrast, setContrast] = useState<{ source: string; value: FaviconContrast } | null>(null)
  const iconContrast = customIcon || missing ? 'original'
    : contrast?.source === source ? contrast.value : getCachedFaviconContrast(source)
  const updateContrast = useCallback((image: HTMLImageElement) => {
    if (customIcon) return
    const value = readFaviconContrast(image, source)
    setContrast(current => current?.source === source && current.value === value ? current : { source, value })
  }, [customIcon, source])
  // squircle 轮廓必须在首次 paint 前就位：引擎的异步链要晚 1-2 帧，
  // 裸启动（无 preboot 快照遮盖）时首帧会以普通圆角示人再突变成 squircle。
  const setShellRef = useCallback((element: HTMLSpanElement | null) => {
    if (element) {
      applySquircleClipBeforePaint(element)
    }
    if (typeof ref === 'function') {
      ref(element)
    } else if (ref) {
      ref.current = element
    }
  }, [ref])
  const setInnerRef = useCallback((element: HTMLElement | null) => {
    if (element) {
      applySquircleClipBeforePaint(element)
    }
  }, [])
  const setFaviconRef = useCallback((image: HTMLImageElement | null) => {
    setInnerRef(image)
    if (image?.complete && image.naturalWidth) updateContrast(image)
  }, [setInnerRef, updateContrast])
  const markSourceReady = useCallback((nextSource: string) => {
    markNewtabFaviconReady(nextSource)
    setLoadedSources((current) => addSourceToSet(current, nextSource))
  }, [])
  const resolveChromeSource = useCallback((chromeSource: string, image: HTMLImageElement | null) => {
    if (customIcon || !favicon.pageUrl) {
      return
    }
    void resolveActiveFaviconForChromeSource(chromeSource, image).then((activeSrc) => {
      if (!activeSrc || activeSrc === favicon.src) {
        return
      }
      // 探测阶段已经确认图标可加载，先标记就绪再替换来源，避免回退字母闪现。
      markSourceReady(activeSrc)
      setActiveSource({ forSource: favicon.src, src: activeSrc })
    })
  }, [customIcon, favicon.pageUrl, favicon.src, markSourceReady])

  return (
    <span
      className={cx(BOOKMARK_ICON_SHELL_CLASS, className, missing && 'favicon-missing')}
      data-icon-contrast={iconContrast}
      aria-hidden="true"
      ref={setShellRef}
    >
      <img
        className={cx(
          BOOKMARK_FAVICON_CLASS,
          customIcon && BOOKMARK_CUSTOM_FAVICON_CLASS
        )}
        data-favicon-ready={loaded && !missing ? 'true' : undefined}
        src={source}
        alt=""
        draggable={false}
        hidden={missing}
        loading={favicon.loading}
        decoding={loaded ? 'sync' : 'async'}
        fetchPriority={favicon.fetchpriority}
        referrerPolicy="no-referrer"
        ref={setFaviconRef}
        onLoad={(event) => {
          updateContrast(event.currentTarget)
          if (source === favicon.src) {
            markNewtabFaviconReady(favicon.src)
          } else {
            markNewtabFaviconReady(source)
          }
          setLoadedSources((current) => addSourceToSet(current, source))
          if (source === favicon.src && isChromeFaviconSource(source)) {
            resolveChromeSource(source, event.currentTarget)
          }
        }}
        onError={() => {
          markNewtabFaviconNotReady(source)
          setFailedSources((current) => addSourceToSet(current, source))
          if (customIcon || !favicon.pageUrl) {
            return
          }
          if (isChromeFaviconSource(source)) {
            resolveChromeSource(source, null)
            return
          }
          if (source === favicon.src) {
            clearActiveFaviconSource(favicon.pageUrl)
          }
        }}
      />
      <span
        className={BOOKMARK_FALLBACK_CLASS}
        data-favicon-ready={loaded && !missing ? 'true' : undefined}
        ref={setInnerRef}
      >
        {fallbackLabel}
      </span>
    </span>
  )
}
