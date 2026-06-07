import { useSyncExternalStore } from 'react'

export interface NewtabIconPreviewTile {
  id: string
  mark: string
  title: string
}

export interface NewtabIconPreviewView {
  columns: number
  layoutMode: string
  previewColumnGap: number
  previewGridMaxWidth: number
  previewRowGap: number
  previewShellSize: number
  previewTileWidth: number
  showTitles: boolean
  summary: string
  titleLines: number
  pageWidth: number
  tiles: NewtabIconPreviewTile[]
}

const DEFAULT_VIEW: NewtabIconPreviewView = {
  columns: 3,
  layoutMode: 'auto',
  pageWidth: 78,
  previewColumnGap: 8,
  previewGridMaxWidth: 240,
  previewRowGap: 8,
  previewShellSize: 20,
  previewTileWidth: 72,
  showTitles: true,
  summary: '',
  titleLines: 1,
  tiles: []
}

let iconPreviewView: NewtabIconPreviewView = DEFAULT_VIEW

const listeners = new Set<() => void>()

function subscribeIconPreview(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitIconPreviewChange(): void {
  listeners.forEach((listener) => listener())
}

export function dispatchNewtabIconPreviewView(view: NewtabIconPreviewView): void {
  iconPreviewView = view
  emitIconPreviewChange()
}

export function useNewtabIconPreviewView(): NewtabIconPreviewView {
  return useSyncExternalStore(
    subscribeIconPreview,
    () => iconPreviewView,
    () => DEFAULT_VIEW
  )
}
