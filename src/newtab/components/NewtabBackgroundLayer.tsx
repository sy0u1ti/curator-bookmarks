import type { CSSProperties } from 'react'
import { useNewtabBackgroundMediaView } from '../newtab-background-media-store'

const BACKGROUND_LAYER_CLASS = 'fixed inset-0 z-0 h-full w-full pointer-events-none transition-opacity duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)]'
const BACKGROUND_IMAGE_CLASS = `${BACKGROUND_LAYER_CLASS} newtab-background-image bg-center bg-cover bg-no-repeat opacity-100`
const BACKGROUND_VIDEO_CLASS = `${BACKGROUND_LAYER_CLASS} newtab-background-video object-cover`
const BACKGROUND_VIDEO_LOADING_CLASS = 'opacity-0'
const BACKGROUND_VIDEO_READY_CLASS = 'opacity-100'

interface NewtabBackgroundLayerProps {
  loadingWallpaper: boolean
}

export function NewtabBackgroundLayer({ loadingWallpaper }: NewtabBackgroundLayerProps) {
  const media = useNewtabBackgroundMediaView()
  const videoClassName = [
    BACKGROUND_VIDEO_CLASS,
    loadingWallpaper ? BACKGROUND_VIDEO_LOADING_CLASS : BACKGROUND_VIDEO_READY_CLASS
  ].join(' ')
  const mediaStyle: CSSProperties = {
    backgroundImage: media.kind === 'image' && media.src ? `url("${escapeStyleUrl(media.src)}")` : undefined,
    backgroundPosition: media.backgroundPosition,
    backgroundSize: media.backgroundSize
  }

  return (
    <>
      <div className={BACKGROUND_IMAGE_CLASS} style={mediaStyle} aria-hidden="true"></div>
      {media.kind === 'video' && media.src ? (
        <video
          className={videoClassName}
          src={media.src}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
      ) : null}
    </>
  )
}

function escapeStyleUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}
