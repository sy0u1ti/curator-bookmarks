import { useState, type Ref } from 'react'
import { cx } from '../../ui/base/utils'

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

const BOOKMARK_ICON_SHELL_CLASS = 'bookmark-icon-shell relative grid h-[var(--icon-shell-size)] w-[var(--icon-shell-size)] place-items-center overflow-hidden rounded-[var(--ui-radius-control)] border border-[rgb(var(--bookmark-card-rgb)/0.12)] bg-[rgba(0,0,0,0.34)] shadow-none [transition:var(--bookmark-icon-transition,border-color_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard))] group-hover/bookmark-tile:border-[rgb(var(--bookmark-card-rgb)/0.12)] group-hover/bookmark-tile:bg-[rgba(0,0,0,0.34)] group-focus-visible/bookmark-tile:border-[rgb(var(--bookmark-card-rgb)/0.12)] group-focus-visible/bookmark-tile:bg-[rgba(0,0,0,0.34)] group-active/bookmark-tile:border-[var(--bookmark-icon-active-border,rgb(var(--bookmark-card-rgb)/0.16))] group-active/bookmark-tile:bg-[var(--bookmark-icon-active-bg,rgba(0,0,0,0.48))] group-active/bookmark-tile:duration-[60ms]'
const BOOKMARK_FAVICON_CLASS = 'bookmark-favicon relative z-[1] block h-[calc(var(--icon-shell-size)*0.66)] w-[calc(var(--icon-shell-size)*0.66)] rounded-[5px] object-contain opacity-0 [transition:opacity_90ms_var(--ui-ease-standard)] [-webkit-user-drag:none] motion-reduce:transition-none'
const BOOKMARK_FAVICON_READY_CLASS = 'opacity-100'
const BOOKMARK_CUSTOM_FAVICON_CLASS = 'custom-icon h-[calc(var(--icon-shell-size)*0.78)] w-[calc(var(--icon-shell-size)*0.78)] rounded-[7px] object-cover'
const BOOKMARK_FALLBACK_CLASS = 'bookmark-fallback absolute grid h-[calc(var(--icon-shell-size)*0.78)] w-[calc(var(--icon-shell-size)*0.78)] place-items-center rounded-[7px] bg-[rgba(245,245,247,0.08)] text-[13px] font-extrabold leading-none text-[rgba(245,245,247,0.86)] opacity-100 [transition:opacity_90ms_var(--ui-ease-standard)] motion-reduce:transition-none'
const BOOKMARK_FALLBACK_HIDDEN_CLASS = 'opacity-0'

export function BookmarkIconShell({
  className,
  customIcon,
  fallbackLabel,
  favicon,
  ref
}: BookmarkIconShellProps) {
  const [failedSources, setFailedSources] = useState(() => new Set<string>())
  const [loadedSources, setLoadedSources] = useState(() => new Set<string>())
  const missing = failedSources.has(favicon.src)
  const loaded = loadedSources.has(favicon.src)

  return (
    <span
      className={cx(BOOKMARK_ICON_SHELL_CLASS, className, missing && 'favicon-missing')}
      aria-hidden="true"
      ref={ref}
    >
      <img
        className={cx(
          BOOKMARK_FAVICON_CLASS,
          loaded && !missing && BOOKMARK_FAVICON_READY_CLASS,
          customIcon && BOOKMARK_CUSTOM_FAVICON_CLASS
        )}
        src={favicon.src}
        alt=""
        draggable={false}
        hidden={missing}
        loading={favicon.loading}
        decoding="async"
        fetchPriority={favicon.fetchpriority}
        onLoad={() => {
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
      <span className={cx(BOOKMARK_FALLBACK_CLASS, loaded && !missing && BOOKMARK_FALLBACK_HIDDEN_CLASS)}>{fallbackLabel}</span>
    </span>
  )
}
