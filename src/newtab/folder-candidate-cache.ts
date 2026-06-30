import type { ExtractedBookmarkData } from '../shared/types.js'

export interface NewTabFolderCandidate {
  id: string
  title: string
  path: string
  normalizedTitle: string
  normalizedPath: string
  directBookmarkCount: number
  totalBookmarkCount: number
}

export interface FolderCandidateRenderKeyInput {
  rootNode: chrome.bookmarks.BookmarkTreeNode | null
  folderData: ExtractedBookmarkData | null
  folderNodeMap: Map<string, chrome.bookmarks.BookmarkTreeNode>
  folderCandidateQuery: string
  selectedFolderIds: string[]
  folderCandidatesExpanded: boolean
}

export interface FolderCandidateCacheState {
  cacheKey: string
  candidates: NewTabFolderCandidate[]
}

const objectIdentityMap = new WeakMap<object, number>()
let nextObjectIdentity = 1

export function buildFolderCandidateRenderKey(
  input: FolderCandidateRenderKeyInput
): string {
  return [
    getObjectIdentity(input.rootNode),
    getObjectIdentity(input.folderData),
    getObjectIdentity(input.folderNodeMap),
    normalizeFolderCandidateQuery(input.folderCandidateQuery),
    input.selectedFolderIds.join('\u001f'),
    input.folderCandidatesExpanded ? '1' : '0'
  ].join('\u001e')
}

export function getCachedFolderCandidates(
  cacheState: FolderCandidateCacheState,
  cacheKey: string,
  buildCandidates: () => NewTabFolderCandidate[]
): NewTabFolderCandidate[] {
  if (cacheState.cacheKey === cacheKey) {
    return cacheState.candidates
  }

  const candidates = buildCandidates()
  cacheState.cacheKey = cacheKey
  cacheState.candidates = candidates
  return candidates
}

function normalizeFolderCandidateQuery(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getObjectIdentity(value: object | null): string {
  if (!value) {
    return '0'
  }

  const existing = objectIdentityMap.get(value)
  if (existing) {
    return String(existing)
  }

  const identity = nextObjectIdentity
  nextObjectIdentity += 1
  objectIdentityMap.set(value, identity)
  return String(identity)
}
