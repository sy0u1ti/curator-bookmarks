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
const BOOKMARK_FAVICON_CLASS = 'bookmark-favicon relative z-[1] h-[calc(var(--icon-shell-size)*0.66)] w-[calc(var(--icon-shell-size)*0.66)] rounded-[5px] object-contain [-webkit-user-drag:none]'
const BOOKMARK_CUSTOM_FAVICON_CLASS = 'custom-icon h-[calc(var(--icon-shell-size)*0.78)] w-[calc(var(--icon-shell-size)*0.78)] rounded-[7px] object-cover'
const BOOKMARK_FALLBACK_CLASS = 'bookmark-fallback absolute h-[calc(var(--icon-shell-size)*0.78)] w-[calc(var(--icon-shell-size)*0.78)] place-items-center rounded-[7px] bg-[rgba(245,245,247,0.08)] text-[13px] font-extrabold leading-none text-[rgba(245,245,247,0.86)]'

export function BookmarkIconShell({
  className,
  customIcon,
  fallbackLabel,
  favicon,
  ref
}: BookmarkIconShellProps) {
  const [failedSources, setFailedSources] = useState(() => new Set<string>())
  const missing = failedSources.has(favicon.src)

  return (
    <span
      className={cx(BOOKMARK_ICON_SHELL_CLASS, className, missing && 'favicon-missing')}
      aria-hidden="true"
      ref={ref}
    >
      <img
        className={cx(BOOKMARK_FAVICON_CLASS, !missing && 'block', customIcon && BOOKMARK_CUSTOM_FAVICON_CLASS)}
        src={favicon.src}
        alt=""
        draggable={false}
        hidden={missing}
        loading={favicon.loading}
        decoding="async"
        fetchPriority={favicon.fetchpriority}
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
      <span className={cx(BOOKMARK_FALLBACK_CLASS, missing && 'grid')} hidden={!missing}>{fallbackLabel}</span>
    </span>
  )
}
