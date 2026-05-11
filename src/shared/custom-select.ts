type CustomSelectState = {
  select: HTMLSelectElement
  wrapper: HTMLSpanElement
  trigger: HTMLSpanElement
  label: HTMLSpanElement
  list: HTMLDivElement
  activeIndex: number
  observer: MutationObserver
}

const enhancedSelects = new WeakMap<HTMLSelectElement, CustomSelectState>()
const observedDocuments = new WeakSet<Document>()
let activeState: CustomSelectState | null = null
let customSelectId = 0

export function initializeCustomSelects(root: ParentNode = document): void {
  const documentRef = getRootDocument(root)
  installDocumentObservers(documentRef)
  enhanceSelects(root)
}

export function refreshCustomSelects(root: ParentNode = document): void {
  enhanceSelects(root)
  for (const select of getSelects(root)) {
    const state = enhancedSelects.get(select)
    if (state) {
      syncCustomSelect(state)
    }
  }
}

function installDocumentObservers(documentRef: Document): void {
  if (observedDocuments.has(documentRef)) {
    return
  }
  observedDocuments.add(documentRef)

  documentRef.addEventListener('click', (event) => {
    if (!activeState) {
      return
    }

    const target = event.target
    if (target instanceof Node &&
      (activeState.wrapper.contains(target) || activeState.list.contains(target))) {
      return
    }

    closeCustomSelect()
  })

  documentRef.addEventListener('keydown', (event) => {
    if (!activeState || event.key !== 'Escape') {
      return
    }

    event.preventDefault()
    closeCustomSelect({ focusTrigger: true })
  })

  window.addEventListener('resize', () => closeCustomSelect(), { passive: true })
  window.addEventListener('scroll', handleWindowScroll, { passive: true, capture: true })

  const observeRoot = documentRef.body || documentRef.documentElement
  if (!observeRoot) {
    return
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLSelectElement) {
          enhanceSelect(node)
        } else if (node instanceof Element) {
          enhanceSelects(node)
        }
      }
      for (const node of record.removedNodes) {
        if (node instanceof HTMLSelectElement) {
          cleanupSelect(node)
        } else if (node instanceof Element) {
          cleanupSelects(node)
        }
      }
    }
  })
  observer.observe(observeRoot, { childList: true, subtree: true })
}

function handleWindowScroll(event: Event): void {
  if (!activeState) {
    return
  }

  const target = event.target
  if (target instanceof Node && activeState.list.contains(target)) {
    return
  }

  closeCustomSelect()
}

function enhanceSelects(root: ParentNode): void {
  for (const select of getSelects(root)) {
    enhanceSelect(select)
  }
}

function cleanupSelects(root: ParentNode): void {
  for (const select of getSelects(root)) {
    cleanupSelect(select)
  }
}

function getSelects(root: ParentNode): HTMLSelectElement[] {
  if (root instanceof HTMLSelectElement) {
    return [root]
  }
  if (root instanceof Element || root instanceof Document || root instanceof DocumentFragment) {
    return Array.from(root.querySelectorAll('select'))
  }
  return []
}

function enhanceSelect(select: HTMLSelectElement): void {
  if (enhancedSelects.has(select) || select.closest('.custom-select')) {
    return
  }

  const documentRef = select.ownerDocument
  const wrapper = documentRef.createElement('span')
  wrapper.className = getWrapperClassName(select)
  wrapper.dataset.customSelect = 'true'

  const trigger = documentRef.createElement('span')
  trigger.className = 'custom-select-trigger'
  trigger.setAttribute('role', 'combobox')
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.tabIndex = select.disabled ? -1 : 0

  const label = documentRef.createElement('span')
  label.className = 'custom-select-trigger-label'

  const arrow = documentRef.createElement('span')
  arrow.className = 'custom-select-trigger-arrow'
  arrow.setAttribute('aria-hidden', 'true')

  trigger.append(label, arrow)

  const list = documentRef.createElement('div')
  const listId = `custom-select-list-${++customSelectId}`
  list.id = listId
  list.className = getListClassName(select)
  list.setAttribute('role', 'listbox')
  list.hidden = true
  trigger.setAttribute('aria-controls', listId)

  const parent = select.parentNode
  if (!parent) {
    return
  }

  parent.insertBefore(wrapper, select)
  wrapper.append(select, trigger)
  documentRef.body.appendChild(list)

  const state: CustomSelectState = {
    select,
    wrapper,
    trigger,
    label,
    list,
    activeIndex: -1,
    observer: new MutationObserver(() => syncCustomSelect(state))
  }
  enhancedSelects.set(select, state)

  patchSelectValueSetter(select, state)
  select.classList.add('custom-select-native')
  select.tabIndex = -1
  select.setAttribute('aria-hidden', 'true')

  trigger.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (select.disabled) {
      return
    }
    toggleCustomSelect(state)
  })

  trigger.addEventListener('keydown', (event) => {
    handleTriggerKeydown(event, state)
  })

  select.addEventListener('change', () => syncCustomSelect(state))
  state.observer.observe(select, {
    attributes: true,
    attributeFilter: ['disabled', 'hidden', 'label', 'selected'],
    childList: true,
    subtree: true
  })

  syncCustomSelect(state)
}

function cleanupSelect(select: HTMLSelectElement): void {
  const state = enhancedSelects.get(select)
  if (!state || state.wrapper.isConnected) {
    return
  }

  if (activeState === state) {
    activeState = null
  }
  state.observer.disconnect()
  state.list.remove()
  enhancedSelects.delete(select)
}

function patchSelectValueSetter(select: HTMLSelectElement, state: CustomSelectState): void {
  patchSelectProperty(select, state, HTMLSelectElement.prototype, 'value')
  patchSelectProperty(select, state, HTMLSelectElement.prototype, 'selectedIndex')
  patchSelectProperty(select, state, HTMLElement.prototype, 'hidden')
  patchSelectProperty(select, state, HTMLSelectElement.prototype, 'disabled')
}

function patchSelectProperty<T extends object>(
  select: HTMLSelectElement,
  state: CustomSelectState,
  prototype: T,
  property: keyof T & string
): void {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property)
  if (!descriptor?.get || !descriptor.set) {
    return
  }

  Object.defineProperty(select, property, {
    configurable: true,
    get() {
      return descriptor.get?.call(this)
    },
    set(value: unknown) {
      descriptor.set?.call(this, value)
      queueMicrotask(() => syncCustomSelect(state))
    }
  })
}

function getWrapperClassName(select: HTMLSelectElement): string {
  const classes = ['custom-select']
  if (select.classList.contains('setting-select')) {
    classes.push('custom-select-setting')
  }
  if (select.classList.contains('bookmark-menu-select')) {
    classes.push('custom-select-bookmark-menu')
  }
  if (select.classList.contains('ai-provider-select')) {
    classes.push('custom-select-ai-provider')
  }
  if (select.classList.contains('options-select')) {
    classes.push('custom-select-options')
  }
  if (select.classList.contains('duplicate-folder-select')) {
    classes.push('custom-select-duplicate-folder')
  }
  return classes.join(' ')
}

function getListClassName(select: HTMLSelectElement): string {
  return getWrapperClassName(select)
    .split(/\s+/)
    .filter(Boolean)
    .map((className) => {
      return className === 'custom-select'
        ? 'custom-select-list'
        : `${className}-list`
    })
    .join(' ')
}

function handleTriggerKeydown(event: KeyboardEvent, state: CustomSelectState): void {
  if (state.select.disabled) {
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (activeState === state) {
      selectActiveOption(state)
    } else {
      openCustomSelect(state)
    }
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (activeState !== state) {
      openCustomSelect(state)
      return
    }
    moveActiveOption(state, event.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    if (activeState !== state) {
      openCustomSelect(state)
    }
    setActiveOption(state, event.key === 'Home' ? 0 : getSelectableOptions(state.select).length - 1)
    return
  }

  if (event.key === 'Escape' && activeState === state) {
    event.preventDefault()
    closeCustomSelect({ focusTrigger: true })
  }
}

function toggleCustomSelect(state: CustomSelectState): void {
  if (activeState === state) {
    closeCustomSelect({ focusTrigger: true })
    return
  }

  openCustomSelect(state)
}

function openCustomSelect(state: CustomSelectState): void {
  closeCustomSelect()
  activeState = state
  renderCustomSelectList(state)
  state.list.style.visibility = 'hidden'
  state.list.hidden = false
  positionCustomSelectList(state)
  state.wrapper.dataset.open = 'true'
  state.trigger.setAttribute('aria-expanded', 'true')
  state.list.style.visibility = ''
}

function closeCustomSelect({ focusTrigger = false } = {}): void {
  if (!activeState) {
    return
  }

  activeState.wrapper.dataset.open = 'false'
  activeState.trigger.setAttribute('aria-expanded', 'false')
  activeState.list.hidden = true
  activeState.activeIndex = -1
  if (focusTrigger) {
    activeState.trigger.focus()
  }
  activeState = null
}

function renderCustomSelectList(state: CustomSelectState): void {
  const options = getSelectableOptions(state.select, { includeDisabled: true })
  const selectedIndex = Math.max(0, options.findIndex((option) => option.selected || option.value === state.select.value))
  state.activeIndex = selectedIndex
  state.list.replaceChildren()

  options.forEach((option, index) => {
    const item = state.select.ownerDocument.createElement('span')
    item.className = 'custom-select-option'
    item.setAttribute('role', 'option')
    item.setAttribute('aria-selected', String(index === selectedIndex))
    item.dataset.value = option.value
    item.textContent = getOptionLabel(option)
    if (option.disabled) {
      item.setAttribute('aria-disabled', 'true')
    }
    if (index === selectedIndex) {
      item.classList.add('is-active')
    }
    item.addEventListener('mouseenter', () => {
      if (!option.disabled) {
        setActiveOption(state, index)
      }
    })
    item.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (option.disabled) {
        return
      }
      commitOption(state, option.value)
    })
    state.list.appendChild(item)
  })
}

function positionCustomSelectList(state: CustomSelectState): void {
  const rect = state.trigger.getBoundingClientRect()
  const viewportPadding = 8
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
  const spaceAbove = rect.top - viewportPadding
  const maxHeight = Math.max(132, Math.min(280, Math.max(spaceBelow, spaceAbove)))
  const menuHeight = Math.min(Math.ceil(state.list.scrollHeight) || maxHeight, maxHeight)
  const placeAbove = spaceBelow < menuHeight + 6 && spaceAbove > spaceBelow
  const top = placeAbove
    ? Math.max(viewportPadding, rect.top - menuHeight - 6)
    : Math.min(window.innerHeight - viewportPadding - menuHeight, rect.bottom + 6)
  const left = Math.min(
    Math.max(viewportPadding, rect.left),
    Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding)
  )

  state.list.style.setProperty('--custom-select-left', `${left}px`)
  state.list.style.setProperty('--custom-select-top', `${top}px`)
  state.list.style.setProperty('--custom-select-width', `${rect.width}px`)
  state.list.style.setProperty('--custom-select-max-height', `${maxHeight}px`)
}

function moveActiveOption(state: CustomSelectState, offset: number): void {
  const options = getSelectableOptions(state.select)
  if (!options.length) {
    return
  }

  const currentValue = state.list.querySelector('.custom-select-option.is-active')?.getAttribute('data-value') || state.select.value
  const currentIndex = Math.max(0, options.findIndex((option) => option.value === currentValue))
  const nextIndex = (currentIndex + offset + options.length) % options.length
  setActiveOption(state, getSelectableOptions(state.select, { includeDisabled: true }).indexOf(options[nextIndex]))
}

function setActiveOption(state: CustomSelectState, index: number): void {
  const items = Array.from(state.list.querySelectorAll<HTMLElement>('.custom-select-option'))
  if (!items.length) {
    return
  }

  const nextIndex = Math.max(0, Math.min(index, items.length - 1))
  state.activeIndex = nextIndex
  items.forEach((item, itemIndex) => {
    item.classList.toggle('is-active', itemIndex === nextIndex)
  })
  items[nextIndex]?.scrollIntoView({ block: 'nearest' })
}

function selectActiveOption(state: CustomSelectState): void {
  const activeOption = state.list.querySelector<HTMLElement>('.custom-select-option.is-active')
  const value = activeOption?.getAttribute('data-value')
  if (value === null || value === undefined || activeOption?.getAttribute('aria-disabled') === 'true') {
    return
  }

  commitOption(state, value)
}

function commitOption(state: CustomSelectState, value: string): void {
  if (state.select.value === value) {
    closeCustomSelect({ focusTrigger: true })
    return
  }

  state.select.value = value
  state.select.dispatchEvent(new Event('input', { bubbles: true }))
  state.select.dispatchEvent(new Event('change', { bubbles: true }))
  syncCustomSelect(state)
  closeCustomSelect({ focusTrigger: true })
}

function syncCustomSelect(state: CustomSelectState): void {
  const selected = getSelectedOption(state.select)
  state.label.textContent = selected ? getOptionLabel(selected) : ''
  state.trigger.title = selected ? getOptionLabel(selected) : ''
  state.trigger.tabIndex = state.select.disabled ? -1 : 0
  state.trigger.setAttribute('aria-disabled', String(state.select.disabled))
  state.wrapper.classList.toggle('is-disabled', state.select.disabled)
  state.wrapper.hidden = state.select.hidden
  if (activeState === state) {
    renderCustomSelectList(state)
    positionCustomSelectList(state)
  }
}

function getSelectedOption(select: HTMLSelectElement): HTMLOptionElement | null {
  return select.selectedOptions[0] || Array.from(select.options).find((option) => option.value === select.value) || null
}

function getSelectableOptions(
  select: HTMLSelectElement,
  { includeDisabled = false } = {}
): HTMLOptionElement[] {
  return Array.from(select.options).filter((option) => {
    if (option.hidden) {
      return false
    }
    return includeDisabled || !option.disabled
  })
}

function getOptionLabel(option: HTMLOptionElement): string {
  return String(option.label || option.textContent || option.value).trim()
}

function getRootDocument(root: ParentNode): Document {
  if (root instanceof Document) {
    return root
  }
  return root instanceof Node ? root.ownerDocument || document : document
}
