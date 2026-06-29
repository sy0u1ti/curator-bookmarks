import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  getNewtabBackgroundMediaView,
  useNewtabBackgroundMediaView
} from '../newtab-background-media-store'
import {
  dispatchNewtabInstantWallpaperView,
  getNewtabInstantWallpaperView
} from '../newtab-instant-wallpaper-store'

const BACKGROUND_LAYER_CLASS = 'fixed inset-0 z-0 h-full w-full pointer-events-none'
const BACKGROUND_IMAGE_CLASS = `${BACKGROUND_LAYER_CLASS} newtab-background-image bg-center bg-cover bg-no-repeat`
const BACKGROUND_VIDEO_CLASS = `${BACKGROUND_LAYER_CLASS} newtab-background-video object-cover`
const BACKGROUND_VIDEO_LOADING_CLASS = 'opacity-0'
const BACKGROUND_VIDEO_READY_CLASS = 'opacity-100'
const IMAGE_REVEAL_MS = 920
const REMOTE_READY_REVEAL_DELAY_MS = 0

interface StagedBackgroundImage {
  id: number
  src: string
}

interface NewtabBackgroundLayerProps {
  loadingWallpaper: boolean
}

export function NewtabBackgroundLayer({ loadingWallpaper }: NewtabBackgroundLayerProps) {
  const media = useNewtabBackgroundMediaView()
  const [visibleImage, setVisibleImage] = useState<StagedBackgroundImage | null>(null)
  const [incomingImage, setIncomingImage] = useState<StagedBackgroundImage | null>(null)
  const [incomingVisible, setIncomingVisible] = useState(false)
  const visibleImageRef = useRef<StagedBackgroundImage | null>(null)
  const requestIdRef = useRef(0)
  const commitTimerRef = useRef(0)
  const remoteReadyTimerRef = useRef(0)
  const revealFrameRef = useRef(0)
  const revealSecondFrameRef = useRef(0)

  useEffect(() => {
    visibleImageRef.current = visibleImage
  }, [visibleImage])

  useEffect(() => {
    if (media.kind !== 'image' || !media.src) {
      requestIdRef.current += 1
      clearBackgroundImageRevealTimers(
        commitTimerRef,
        remoteReadyTimerRef,
        revealFrameRef,
        revealSecondFrameRef
      )
      setIncomingVisible(false)
      setIncomingImage(null)
      setVisibleImage(null)
      return
    }

    const nextSrc = media.src
    if (visibleImageRef.current?.src === nextSrc) {
      markImageLayerReady(nextSrc)
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    clearBackgroundImageRevealTimers(
      commitTimerRef,
      remoteReadyTimerRef,
      revealFrameRef,
      revealSecondFrameRef
    )
    setIncomingVisible(false)

    const image = new Image()
    let cancelled = false

    const revealImage = () => {
      if (cancelled || requestId !== requestIdRef.current) {
        return
      }
      if (!isCurrentImageMedia(nextSrc)) {
        return
      }

      const stagedImage = {
        id: requestId,
        src: nextSrc
      }
      const hasPreviewCover = hasInstantWallpaperPreviewCover(nextSrc)
      setIncomingImage(stagedImage)
      if (hasPreviewCover) {
        revealFrameRef.current = window.requestAnimationFrame(() => {
          revealSecondFrameRef.current = window.requestAnimationFrame(() => {
            if (cancelled || requestId !== requestIdRef.current || !isCurrentImageMedia(nextSrc)) {
              return
            }
            setIncomingVisible(true)
            markImageLayerReady(nextSrc)
            commitTimerRef.current = window.setTimeout(() => {
              if (requestId !== requestIdRef.current || !isCurrentImageMedia(nextSrc)) {
                return
              }
              visibleImageRef.current = stagedImage
              setVisibleImage(stagedImage)
              setIncomingImage(null)
              setIncomingVisible(false)
            }, IMAGE_REVEAL_MS)
          })
        })
        return
      }
      revealFrameRef.current = window.requestAnimationFrame(() => {
        revealSecondFrameRef.current = window.requestAnimationFrame(() => {
          if (cancelled || requestId !== requestIdRef.current || !isCurrentImageMedia(nextSrc)) {
            return
          }
          setIncomingVisible(true)
          remoteReadyTimerRef.current = window.setTimeout(() => {
            markImageLayerReady(nextSrc)
          }, REMOTE_READY_REVEAL_DELAY_MS)
          commitTimerRef.current = window.setTimeout(() => {
            if (requestId !== requestIdRef.current || !isCurrentImageMedia(nextSrc)) {
              return
            }
            visibleImageRef.current = stagedImage
            setVisibleImage(stagedImage)
            setIncomingImage(null)
            setIncomingVisible(false)
          }, IMAGE_REVEAL_MS)
        })
      })
    }

    void waitForImageDecode(image, nextSrc).then((ready) => {
      if (!ready) {
        return
      }
      revealImage()
    })

    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
    }
  }, [media.kind, media.src])

  const videoClassName = [
    BACKGROUND_VIDEO_CLASS,
    loadingWallpaper ? BACKGROUND_VIDEO_LOADING_CLASS : BACKGROUND_VIDEO_READY_CLASS
  ].join(' ')
  const imageBaseStyle: CSSProperties = {
    backgroundPosition: media.backgroundPosition,
    backgroundSize: media.backgroundSize
  }
  const visibleImageStyle = getBackgroundImageLayerStyle(visibleImage?.src || '', imageBaseStyle)
  const incomingImageStyle = getBackgroundImageLayerStyle(incomingImage?.src || '', imageBaseStyle)

  return (
    <>
      {visibleImage ? (
        <div
          className={BACKGROUND_IMAGE_CLASS}
          style={visibleImageStyle}
          data-state="visible"
          aria-hidden="true"
        ></div>
      ) : null}
      {incomingImage ? (
        <div
          key={incomingImage.id}
          className={BACKGROUND_IMAGE_CLASS}
          style={incomingImageStyle}
          data-state={incomingVisible ? 'visible' : 'enter'}
          aria-hidden="true"
        ></div>
      ) : null}
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

function getBackgroundImageLayerStyle(
  src: string,
  baseStyle: Pick<CSSProperties, 'backgroundPosition' | 'backgroundSize'>
): CSSProperties {
  return {
    ...baseStyle,
    backgroundImage: src ? `url("${escapeStyleUrl(src)}")` : undefined
  }
}

function waitForImageDecode(image: HTMLImageElement, src: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (ready: boolean) => {
      if (settled) {
        return
      }
      settled = true
      image.onload = null
      image.onerror = null
      if (!ready || typeof image.decode !== 'function') {
        resolve(ready)
        return
      }
      image.decode()
        .then(() => resolve(true))
        .catch(() => resolve(true))
    }

    image.decoding = 'async'
    image.onload = () => settle(true)
    image.onerror = () => settle(false)
    image.src = src
    if (image.complete) {
      settle(Boolean(image.naturalWidth || image.width))
    }
  })
}

function isCurrentImageMedia(src: string): boolean {
  const media = getNewtabBackgroundMediaView()
  return media.kind === 'image' && media.src === src
}

function markImageLayerReady(src: string): void {
  if (!isCurrentImageMedia(src)) {
    return
  }

  dispatchNewtabInstantWallpaperView({
    booting: false,
    loaderVisible: false,
    loading: false,
    pending: false,
    remoteReady: true
  })
}

function hasInstantWallpaperPreviewCover(src: string): boolean {
  if (!isCurrentImageMedia(src)) {
    return false
  }
  const instantWallpaper = getNewtabInstantWallpaperView()
  return Boolean(
    instantWallpaper.ready &&
    !instantWallpaper.remoteReady &&
    hasUsableInstantWallpaperPreview(instantWallpaper.previewImage)
  )
}

function hasUsableInstantWallpaperPreview(previewImage: string): boolean {
  const normalizedPreviewImage = String(previewImage || '').trim()
  return Boolean(normalizedPreviewImage && normalizedPreviewImage !== 'none')
}

function clearBackgroundImageRevealTimers(
  commitTimerRef: { current: number },
  remoteReadyTimerRef: { current: number },
  revealFrameRef: { current: number },
  revealSecondFrameRef: { current: number }
): void {
  window.clearTimeout(commitTimerRef.current)
  window.clearTimeout(remoteReadyTimerRef.current)
  window.cancelAnimationFrame(revealFrameRef.current)
  window.cancelAnimationFrame(revealSecondFrameRef.current)
  commitTimerRef.current = 0
  remoteReadyTimerRef.current = 0
  revealFrameRef.current = 0
  revealSecondFrameRef.current = 0
}

function escapeStyleUrl(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}
