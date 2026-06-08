import { useEffect, useState } from 'react'

export interface BookmarkIconShellFavicon {
  fetchpriority: 'high' | 'low' | 'auto'
  loading: 'eager' | 'lazy'
  src: string
}

export function BookmarkIconShell({
  className = 'bookmark-icon-shell',
  customIcon,
  fallbackLabel,
  favicon
}: {
  className?: string
  customIcon: boolean
  fallbackLabel: string
  favicon: BookmarkIconShellFavicon
}) {
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setMissing(false)
  }, [favicon.src])

  return (
    <span className={missing ? `${className} favicon-missing` : className} aria-hidden="true">
      <img
        className={customIcon ? 'bookmark-favicon custom-icon' : 'bookmark-favicon'}
        src={favicon.src}
        alt=""
        draggable={false}
        loading={favicon.loading}
        decoding="async"
        fetchPriority={favicon.fetchpriority}
        onError={() => {
          setMissing(true)
        }}
      />
      <span className="bookmark-fallback">{fallbackLabel}</span>
    </span>
  )
}
