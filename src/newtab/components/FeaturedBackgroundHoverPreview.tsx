import { useNewtabFeaturedBackgroundHoverPreviewView } from '../newtab-featured-background-hover-preview-store'

export function FeaturedBackgroundHoverPreviewHost() {
  const preview = useNewtabFeaturedBackgroundHoverPreviewView()

  return (
    <div
      className={preview.visible ? 'featured-wallpaper-hover-preview is-visible' : 'featured-wallpaper-hover-preview'}
      role="img"
      aria-hidden={preview.visible ? 'false' : 'true'}
      aria-label={preview.visible ? preview.ariaLabel : undefined}
      style={{
        backgroundImage: preview.backgroundImage,
        height: `${preview.height}px`,
        left: `${preview.left}px`,
        top: `${preview.top}px`,
        width: `${preview.width}px`
      }}
    />
  )
}
