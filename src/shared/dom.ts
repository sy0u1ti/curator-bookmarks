export function requireElement<TElement extends Element = HTMLElement>(
  id: string,
  root: Document = document
): TElement {
  const element = root.getElementById(id)
  if (!element) {
    throw new Error(`Missing required element: #${id}`)
  }

  return element as unknown as TElement
}

export function optionalElement<TElement extends Element = HTMLElement>(
  id: string,
  root: Document = document
): TElement | null {
  return root.getElementById(id) as unknown as TElement | null
}

export function requireHtmlElement<TElement extends HTMLElement = HTMLElement>(
  id: string,
  root: Document = document
): TElement {
  const element = requireElement<Element>(id, root)
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected HTMLElement for #${id}`)
  }

  return element as TElement
}
