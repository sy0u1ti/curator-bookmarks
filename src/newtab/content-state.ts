export type NewTabContentState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'missing-folder'; reason: 'none-selected' | 'selected-unavailable' }
  | { type: 'bookmarks' }

export interface ResolveNewTabContentStateInput {
  loading: boolean
  error: string
  selectedFolderCount: number
  visibleFolderCount: number
}

export interface NewTabPageModule {
  id: string
  element: HTMLElement
  placement: 'utility' | 'primary'
}

export interface NewTabPageOptions {
  modules: NewTabPageModule[]
}

export interface MissingFolderViewOptions {
  creatingFolder: boolean
  reason: 'none-selected' | 'selected-unavailable'
  onCreateFolder: () => void
  onOpenFolderSettings: () => void
}

export function resolveNewTabContentState(
  input: ResolveNewTabContentStateInput
): NewTabContentState {
  if (input.loading) {
    return { type: 'loading' }
  }

  if (input.error) {
    return { type: 'error', message: input.error }
  }

  if (!input.visibleFolderCount) {
    return {
      type: 'missing-folder',
      reason: input.selectedFolderCount > 0 ? 'selected-unavailable' : 'none-selected'
    }
  }

  return { type: 'bookmarks' }
}

export function createNewTabPage({ modules }: NewTabPageOptions): HTMLElement {
  const page = document.createElement('main')
  page.className = 'newtab-page'
  page.dataset.contentState = modules.some((module) => module.id === 'bookmarks')
    ? 'bookmarks'
    : 'empty'

  const utilityStack = document.createElement('div')
  utilityStack.className = 'newtab-utility-stack'

  const primarySlot = document.createElement('div')
  primarySlot.className = 'newtab-primary-slot'

  for (const module of modules) {
    module.element.dataset.newtabModule = module.id
    if (module.placement === 'utility') {
      utilityStack.appendChild(module.element)
    } else {
      primarySlot.appendChild(module.element)
    }
  }

  page.classList.toggle('has-search', modules.some((module) => module.id === 'search'))
  page.classList.toggle('has-clock', modules.some((module) => module.id === 'clock'))
  page.append(utilityStack, primarySlot)
  return page
}

export function createMissingFolderView({
  creatingFolder,
  reason,
  onCreateFolder,
  onOpenFolderSettings
}: MissingFolderViewOptions): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state folder-missing'
  view.setAttribute('aria-labelledby', 'newtab-missing-folder-title')

  const title = document.createElement('h1')
  title.id = 'newtab-missing-folder-title'
  title.textContent = reason === 'selected-unavailable'
    ? '已选书签来源不可用'
    : '请选择新标签页的书签来源'

  const copy = document.createElement('p')
  copy.textContent = reason === 'selected-unavailable'
    ? '之前选择的文件夹可能已被删除或移动。请打开设置里的“书签来源”，重新选择要显示的文件夹。'
    : '新标签页还没有要显示的书签文件夹。请打开设置里的“书签来源”，选择一个或多个文件夹。'

  const actions = document.createElement('div')
  actions.className = 'newtab-state-actions'

  const settingsButton = document.createElement('button')
  settingsButton.className = 'newtab-button'
  settingsButton.type = 'button'
  settingsButton.textContent = '选择书签来源'
  settingsButton.addEventListener('click', onOpenFolderSettings)

  const createButton = document.createElement('button')
  createButton.className = 'newtab-button secondary'
  createButton.type = 'button'
  createButton.disabled = creatingFolder
  createButton.textContent = creatingFolder ? '正在创建' : '新建专用文件夹'
  createButton.addEventListener('click', onCreateFolder)

  actions.append(settingsButton, createButton)
  view.append(title, copy, actions)
  return view
}

export function createStateView(message: string, actionLabel = '', action?: () => void): HTMLElement {
  const view = document.createElement('section')
  view.className = 'newtab-state'

  const copy = document.createElement('p')
  copy.textContent = message
  view.appendChild(copy)

  if (actionLabel && action) {
    const button = document.createElement('button')
    button.className = 'newtab-button secondary'
    button.type = 'button'
    button.textContent = actionLabel
    button.addEventListener('click', action)
    view.appendChild(button)
  }

  return view
}
