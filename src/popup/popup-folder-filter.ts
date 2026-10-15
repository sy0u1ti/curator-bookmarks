import { normalizeText } from '../shared/text.js'

export const POPUP_FOLDER_FILTER_INPUT_ID = 'popup-folder-filter-input'

/** Pinyin tokens for one folder, produced by the lazily loaded pinyin module. */
export interface PopupFolderFilterTokens {
  full: string[]
  initials: string[]
}

export interface PopupFolderFilterTarget {
  normalizedPath: string
  normalizedTitle: string
}

export interface PopupFolderFilterVisibility {
  matched: Set<string>
  visible: Set<string>
}

export function normalizeFolderFilterQuery(value: unknown): string {
  return normalizeText(value)
}

/** ASCII-only queries can also be pinyin initials or full syllables. */
export function folderFilterUsesPinyin(query: string): boolean {
  return /^[a-z0-9]{2,}$/.test(normalizeFolderFilterQuery(query))
}

export function folderFilterMatchesTarget(
  target: PopupFolderFilterTarget,
  query: string,
  tokens: PopupFolderFilterTokens | null = null
): boolean {
  const normalizedQuery = normalizeFolderFilterQuery(query)
  if (!normalizedQuery) {
    return false
  }
  if (
    target.normalizedTitle.includes(normalizedQuery) ||
    target.normalizedPath.includes(normalizedQuery)
  ) {
    return true
  }
  if (!tokens) {
    return false
  }
  return (
    tokens.full.some((token) => token.includes(normalizedQuery)) ||
    tokens.initials.some((token) => token.startsWith(normalizedQuery))
  )
}

/**
 * Keep a folder when it matches, or when one of its descendants matches so the
 * tree keeps its hierarchy. The caller pins and dims the sidebar root.
 */
export function collectFolderFilterVisibility<Node extends { children?: Node[]; id?: string; url?: string }>(
  root: Node,
  isMatch: (node: Node) => boolean
): PopupFolderFilterVisibility {
  const matched = new Set<string>()
  const visible = new Set<string>()

  const visit = (node: Node): boolean => {
    const id = String(node?.id || '')
    const selfMatches = isMatch(node)
    let descendantMatches = false
    const children = Array.isArray(node?.children) ? node.children : []
    for (const child of children) {
      // Bookmarks are leaves here; only folders take part in the folder filter.
      if (child?.url) {
        continue
      }
      // Short-circuit keeps the recursion linear when a child already matched.
      descendantMatches = visit(child) || descendantMatches
    }
    if (selfMatches) {
      matched.add(id)
    }
    if (selfMatches || descendantMatches) {
      visible.add(id)
    }
    return selfMatches || descendantMatches
  }

  visit(root)
  return { matched, visible }
}
