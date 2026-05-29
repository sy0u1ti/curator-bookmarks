import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { Button, DotMatrixLoader } from '../../ui'
import type { MissingFolderViewOptions, NewTabPageModule, NewTabPageOptions } from '../content-state'

const roots = new WeakMap<Element, Root>()

function renderIsland(container: Element, node: React.ReactNode): void {
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  flushSync(() => {
    root.render(node)
  })
}

export interface StateViewOptions {
  action?: () => void
  actionLabel?: string
  message: string
}

export function createNewTabPageIslandElement({ modules }: NewTabPageOptions): HTMLElement {
  const page = document.createElement('main')
  page.className = 'newtab-page'
  page.dataset.contentState = modules.some((module) => module.id === 'bookmarks')
    ? 'bookmarks'
    : 'empty'

  for (const module of modules) {
    module.element.dataset.newtabModule = module.id
  }

  page.classList.toggle('has-search', modules.some((module) => module.id === 'search'))
  page.classList.toggle('has-clock', modules.some((module) => module.id === 'clock'))
  const bookmarkModule = modules.find((module) => module.id === 'bookmarks')
  if (bookmarkModule) {
    page.dataset.iconVerticalCenter = bookmarkModule.element.dataset.iconVerticalCenter || 'false'
  }

  renderIsland(page, <NewTabPage modules={modules} />)
  return page
}

export function createMissingFolderIslandElement(options: MissingFolderViewOptions): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state folder-missing'
  view.setAttribute('aria-labelledby', 'newtab-missing-folder-title')
  renderIsland(view, <MissingFolderState {...options} />)
  return view
}

export function createStateIslandElement(options: StateViewOptions): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state'
  renderIsland(view, <GenericState {...options} />)
  return view
}

export function createLoadingStateIslandElement(label = '正在加载书签'): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state newtab-loading-state'
  view.setAttribute('role', 'status')
  view.setAttribute('aria-label', label)
  renderIsland(view, <DotMatrixLoader className="newtab-state-loader" />)
  return view
}

export function renderContentStateRootIsland(container: HTMLElement, view: HTMLElement): void {
  container.replaceChildren(view)
}

function NewTabPage({ modules }: { modules: NewTabPageModule[] }) {
  const utilityModules = modules.filter((module) => module.placement === 'utility')
  const primaryModules = modules.filter((module) => module.placement === 'primary')

  return (
    <>
      <div
        className="newtab-utility-stack"
        ref={(node) => {
          mountModules(node, utilityModules)
        }}
      />
      <div
        className="newtab-primary-slot"
        ref={(node) => {
          mountModules(node, primaryModules)
        }}
      />
    </>
  )
}

function mountModules(node: HTMLDivElement | null, modules: NewTabPageModule[]): void {
  if (!node) {
    return
  }
  node.replaceChildren(...modules.map((module) => module.element))
}

function MissingFolderState({
  creatingFolder,
  reason,
  onCreateFolder,
  onOpenFolderSettings
}: MissingFolderViewOptions) {
  return (
    <>
      <h1 id="newtab-missing-folder-title">
        {reason === 'selected-unavailable' ? '已选书签来源不可用' : '当前没有显示来源'}
      </h1>
      <p>
        {reason === 'selected-unavailable'
          ? '之前选择的文件夹可能已被删除或移动。请打开设置里的“书签来源”，重新选择要显示的文件夹。'
          : '没有找到可直接展示的非空文件夹。你可以选择已有来源，或新建专用文件夹后添加书签。'}
      </p>
      <div className="newtab-state-actions">
        <Button className="newtab-button" type="button" onClick={onOpenFolderSettings} unstyled>
          选择现有来源
        </Button>
        <Button
          className="newtab-button secondary"
          type="button"
          disabled={creatingFolder}
          onClick={onCreateFolder}
          unstyled
        >
          {creatingFolder ? '正在创建' : '新建专用文件夹'}
        </Button>
      </div>
    </>
  )
}

function GenericState({ action, actionLabel = '', message }: StateViewOptions) {
  return (
    <>
      <p>{message}</p>
      {actionLabel && action ? (
        <Button className="newtab-button secondary" type="button" onClick={action} unstyled>
          {actionLabel}
        </Button>
      ) : null}
    </>
  )
}
