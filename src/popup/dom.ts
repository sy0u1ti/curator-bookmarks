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
}
