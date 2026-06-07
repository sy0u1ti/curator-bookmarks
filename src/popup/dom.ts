import { requireElement } from '../shared/dom.js'

type PopupDomElement =
  HTMLElement & {
    disabled: boolean
    value: string
    placeholder: string
    focus: () => void
    select: () => void
  }

export type PopupDomRefs = Record<string, PopupDomElement>

export const dom = {} as PopupDomRefs

function byId(id: string): PopupDomElement {
  return requireElement<PopupDomElement>(id)
}

export function cacheDom(): void {
  dom.appShell = byId('popup-app-shell')
  dom.openSettings = byId('open-settings')
  dom.searchInput = byId('search-input')
  dom.naturalSearchToggle = byId('natural-search-toggle')
  dom.clearSearch = byId('clear-search')
  dom.searchHelpToggle = byId('search-help-toggle')
  dom.viewCaption = byId('view-caption')
  dom.errorBanner = byId('error-banner')
  dom.smartFooter = byId('smart-footer')
  dom.smartTotal = byId('smart-total')
  dom.smartFooterSettings = byId('smart-footer-settings')
}
