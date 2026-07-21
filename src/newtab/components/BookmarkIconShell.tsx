import { useCallback, useState, type Ref } from 'react'
import { cx } from '../../ui/base/utils'
import { applySquircleClipBeforePaint } from '../../shared/squircle-engine'
import {
  isNewtabFaviconReady,
  markNewtabFaviconNotReady,
  markNewtabFaviconReady
} from '../newtab-favicon-readiness'

export interface BookmarkIconShellFavicon {
  fetchpriority: 'high' | 'low' | 'auto'
  loading: 'eager' | 'lazy'
  src: string
}

export interface BookmarkIconShellProps {
  className?: string
  customIcon: boolean
  fallbackLabel: string
  favicon: BookmarkIconShellFavicon
  ref?: Ref<HTMLSpanElement>
}

const BOOKMARK_ICON_SHELL_CLASS = 'bookmark-icon-shell relative grid h-[var(--icon-shell-size)] w-[var(--icon-shell-size)] place-items-center overflow-hidden rounded-[var(--ui-radius-control)] border border-[rgba(245,245,247,0.14)] bg-[rgba(0,0,0,0.32)] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] [transition:var(--bookmark-icon-transition,border-color_var(--ds-motion-standard)_var(--ui-ease-standard),background-color_var(--ds-motion-standard)_var(--ui-ease-standard),box-shadow_var(--ds-motion-standard)_var(--ui-ease-standard))] group-active/bookmark-tile:border-[var(--bookmark-icon-active-border,rgba(245,245,247,0.24))] group-active/bookmark-tile:bg-[var(--bookmark-icon-active-bg,rgba(0,0,0,0.48))] group-active/bookmark-tile:duration-[var(--ds-motion-feedback)]'
const BOOKMARK_FAVICON_CLASS = 'bookmark-favicon relative z-[1] block h-[calc(var(--icon-shell-size)*0.68)] w-[calc(var(--icon-shell-size)*0.68)] rounded-[5px] object-contain opacity-0 [transform:scale(0.92)] [transition:opacity_var(--icon-swap-dur)_var(--icon-swap-ease),transform_var(--icon-swap-dur)_var(--icon-swap-ease)] data-[favicon-ready=true]:opacity-100 data-[favicon-ready=true]:[transform:scale(1)] [-webkit-user-drag:none] motion-reduce:transition-none motion-reduce:[transform:none]'
const BOOKMARK_CUSTOM_FAVICON_CLASS = 'custom-icon h-[calc(var(--icon-shell-size)*0.8)] w-[calc(var(--icon-shell-size)*0.8)] rounded-[7px] object-cover'
const BOOKMARK_FALLBACK_CLASS = 'bookmark-fallback absolute grid h-[calc(var(--icon-shell-size)*0.76)] w-[calc(var(--icon-shell-size)*0.76)] place-items-center rounded-[7px] bg-[rgba(245,245,247,0.09)] text-[13px] font-extrabold leading-none text-[rgba(245,245,247,0.88)] opacity-100 [transform:scale(1)] [transition:opacity_var(--icon-swap-dur)_var(--icon-swap-ease),transform_var(--icon-swap-dur)_var(--icon-swap-ease)] data-[favicon-ready=true]:opacity-0 data-[favicon-ready=true]:[transform:scale(0.96)] motion-reduce:transition-none motion-reduce:[transform:none]'

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
  const missing = failedSources.has(favicon.src)
  const loaded = loadedSources.has(favicon.src) || isNewtabFaviconReady(favicon.src)
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

  return (
    <span
      className={cx(BOOKMARK_ICON_SHELL_CLASS, className, missing && 'favicon-missing')}
      aria-hidden="true"
      ref={setShellRef}
    >
      <img
        className={cx(
          BOOKMARK_FAVICON_CLASS,
          customIcon && BOOKMARK_CUSTOM_FAVICON_CLASS
        )}
        data-favicon-ready={loaded && !missing ? 'true' : undefined}
        src={favicon.src}
        alt=""
        draggable={false}
        hidden={missing}
        loading={favicon.loading}
        decoding={loaded ? 'sync' : 'async'}
        fetchPriority={favicon.fetchpriority}
        ref={setInnerRef}
        onLoad={() => {
          markNewtabFaviconReady(favicon.src)
          setLoadedSources((current) => {
            if (current.has(favicon.src)) {
              return current
            }
            const next = new Set(current)
            next.add(favicon.src)
            return next
          })
        }}
        onError={() => {
          markNewtabFaviconNotReady(favicon.src)
          setFailedSources((current) => {
            if (current.has(favicon.src)) {
              return current
            }
            const next = new Set(current)
            next.add(favicon.src)
            return next
          })
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
