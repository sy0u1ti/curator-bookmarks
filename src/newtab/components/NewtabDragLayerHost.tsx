import type { CSSProperties } from 'react'
import {
  useNewtabDragLayerView,
  type BookmarkDragGhostView,
  type FolderDragGhostView,
  type SpeedDialDragGhostView
} from '../newtab-drag-layer-store'
import { BookmarkIconShell } from './BookmarkIconShell'
import { getBookmarkTileClass, getBookmarkTitleClass } from './bookmarkTileClasses'
import {
  SPEED_DIAL_COPY_CLASS,
  SPEED_DIAL_COPY_DETAIL_CLASS,
  SPEED_DIAL_COPY_TITLE_CLASS,
  SPEED_DIAL_MARK_CLASS,
  getSpeedDialCardClass
} from './speedDialClasses'
import {
  FOLDER_SECTION_COUNT_CLASS,
  FOLDER_SECTION_TITLE_CLASS,
  getFolderSectionHeaderClass
} from './folderSectionClasses'

const DRAG_LAYER_CLASS = 'newtab-drag-layer fixed inset-0 z-[120] pointer-events-none'

export function NewtabDragLayerHost() {
  const view = useNewtabDragLayerView()

  return (
    <div id="newtab-drag-layer" className={DRAG_LAYER_CLASS} aria-hidden="true">
      {view.speedDialGhost ? <SpeedDialDragGhost view={view.speedDialGhost} /> : null}
      {view.bookmarkGhost ? <BookmarkDragGhost view={view.bookmarkGhost} /> : null}
      {view.folderGhost ? <FolderDragGhost view={view.folderGhost} /> : null}
    </div>
  )
}

function SpeedDialDragGhost({ view }: { view: SpeedDialDragGhostView }) {
  const style = {
    ...view.style,
    width: `${view.width}px`,
    height: `${view.height}px`,
    transform: view.transform,
    visibility: view.visible ? 'visible' : 'hidden'
  } as CSSProperties

  return (
    <div className={getSpeedDialCardClass({ ghost: true })} style={style} aria-hidden="true">
      <BookmarkIconShell
        className={SPEED_DIAL_MARK_CLASS}
        customIcon={view.customIcon}
        fallbackLabel={view.fallbackLabel}
        favicon={view.favicon}
      />
      <span className={SPEED_DIAL_COPY_CLASS}>
        <strong className={SPEED_DIAL_COPY_TITLE_CLASS}>{view.title}</strong>
        <span className={SPEED_DIAL_COPY_DETAIL_CLASS}>{view.detail}</span>
      </span>
    </div>
  )
}

function BookmarkDragGhost({ view }: { view: BookmarkDragGhostView }) {
  const style = {
    ...view.style,
    width: `${view.width}px`,
    height: `${view.height}px`,
    transform: view.transform,
    visibility: view.visible ? 'visible' : 'hidden'
  } as CSSProperties

  return (
    <div className={getBookmarkTileClass({ ghost: true, showTitles: view.showTitles })} style={style} aria-hidden="true">
      <BookmarkIconShell
        customIcon={view.customIcon}
        fallbackLabel={view.fallbackLabel}
        favicon={view.favicon}
      />
      <span className={getBookmarkTitleClass()} hidden={!view.showTitles}>{view.title}</span>
    </div>
  )
}

function FolderDragGhost({ view }: { view: FolderDragGhostView }) {
  const style = {
    width: `${view.width}px`,
    height: `${view.height}px`,
    transform: view.transform
  } as CSSProperties

  return (
    <div className={getFolderSectionHeaderClass({ ghost: true })} style={style} aria-hidden="true">
      <span className={FOLDER_SECTION_TITLE_CLASS}>{view.title || '未命名文件夹'}</span>
      <span className={FOLDER_SECTION_COUNT_CLASS}>{view.bookmarkCount}</span>
    </div>
  )
}
