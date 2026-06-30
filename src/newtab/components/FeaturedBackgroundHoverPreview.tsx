import { useNewtabFeaturedBackgroundHoverPreviewView } from '../newtab-featured-background-hover-preview-store'

export function FeaturedBackgroundHoverPreviewHost() {
  const preview = useNewtabFeaturedBackgroundHoverPreviewView()

  return (
    <img
      className={preview.visible ? 'featured-wallpaper-hover-preview is-visible' : 'featured-wallpaper-hover-preview'}
      src={preview.src || undefined}
      aria-hidden={preview.visible ? 'false' : 'true'}
      alt={preview.visible ? preview.ariaLabel : ''}
      style={{
        height: `${preview.height}px`,
        left: `${preview.left}px`,
        top: `${preview.top}px`,
        width: `${preview.width}px`
      }}
    />
  )
}
