import { useState } from 'react'
import { NewtabGlassSurface } from './NewtabGlassSurface'
import {
  useNewtabFeaturedBackgroundHoverPreviewView,
  type NewtabFeaturedBackgroundHoverPreviewView
} from '../newtab-featured-background-hover-preview-store'

export function FeaturedBackgroundHoverPreviewHost() {
  const preview = useNewtabFeaturedBackgroundHoverPreviewView()
  return <FeaturedBackgroundHoverPreview key={preview.src} preview={preview} />
}

function FeaturedBackgroundHoverPreview({ preview }: { preview: NewtabFeaturedBackgroundHoverPreviewView }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  if (!preview.src || state === 'error') return null
  const visible = preview.visible && state === 'ready'
  return (
    <NewtabGlassSurface tone="panel"
      className={visible ? 'featured-wallpaper-hover-preview is-visible' : 'featured-wallpaper-hover-preview'}
      aria-hidden={!visible}
      style={{
        visibility: state === 'ready' ? 'visible' : 'hidden',
        height: `${preview.height}px`,
        left: `${preview.left}px`,
        top: `${preview.top}px`,
        width: `${preview.width}px`
      }}
    >
      <img
        className="featured-wallpaper-hover-preview-image"
        src={preview.src}
        alt={visible ? preview.ariaLabel : ''}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
      />
    </NewtabGlassSurface>
  )
}
