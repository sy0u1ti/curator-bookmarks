import type { CSSProperties } from 'react'
import {
  useNewtabDragLayerView,
  type BookmarkDragGhostView,
  type FolderDragGhostView,
  type SpeedDialDragGhostView
} from '../newtab-drag-layer-store'
import { Icon } from '../../ui/icons/Icon'
import { NumberPop } from '../../ui/motion/NumberPop'
import { BookmarkIconShell } from './BookmarkIconShell'
import {
  BOOKMARK_FOLDER_CARD_COUNT_CLASS,
  BOOKMARK_FOLDER_CARD_GRID_CLASS,
  BOOKMARK_FOLDER_CARD_ICON_CLASS,
  getBookmarkTileClass,
  getBookmarkTitleClass
} from './bookmarkTileClasses'
import {
  SPEED_DIAL_COPY_CLASS,
  SPEED_DIAL_COPY_DETAIL_CLASS,
  SPEED_DIAL_COPY_TITLE_CLASS,
  SPEED_DIAL_MARK_CLASS,
  getSpeedDialCardClass
} from './speedDialClasses'

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

// 文件夹拖拽 ghost：与导航模式的文件夹卡片同款玻璃卡片（图标外壳 + 名称 + 计数），
// 复用书签拖拽 ghost 的 fixed/drop-shadow 形态 —— 两种模式的拖拽观感由此统一。
// 类名保留 folder-drag-ghost 供 settleNewtabDragGhost 落位动画选择器使用。
function FolderDragGhost({ view }: { view: FolderDragGhostView }) {
  const style = {
    ...view.style,
    width: `${view.width}px`,
    height: `${view.height}px`,
    transform: view.transform
  } as CSSProperties

  return (
    <div
      className={`${getBookmarkTileClass({ ghost: true, showTitles: true })} ${BOOKMARK_FOLDER_CARD_GRID_CLASS} folder-drag-ghost`}
      style={style}
      aria-hidden="true"
    >
      <span className={BOOKMARK_FOLDER_CARD_ICON_CLASS} aria-hidden="true">
        <Icon name="Folder" size={20} />
      </span>
      <span className={getBookmarkTitleClass()}>{view.title || '未命名文件夹'}</span>
      <span className={BOOKMARK_FOLDER_CARD_COUNT_CLASS} aria-hidden="true">
        <NumberPop text={view.bookmarkCount} />
      </span>
    </div>
  )
}
