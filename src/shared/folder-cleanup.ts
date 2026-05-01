import { ROOT_ID } from './constants.js'
import type { BookmarkTagIndex } from './bookmark-tags.js'

export type FolderCleanupSuggestionKind =
  | 'empty-folder'
  | 'deep-single-bookmark'
  | 'single-path-chain'
  | 'same-name-folders'
  | 'large-folder-split'

export type FolderCleanupOperationKind = 'delete' | 'move' | 'merge' | 'split' | 'preview'

export interface FolderCleanupBookmarkSummary {
  id: string
  title: string
  url: string
  parentId: string
  domain: string
}

export interface FolderCleanupFolderSummary {
  id: string
  title: string
  path: string
  depth: number
  directBookmarkCount: number
  directFolderCount: number
  descendantBookmarkCount: number
}

export interface FolderCleanupSplitGroup {
  key: string
  label: string
  bookmarkIds: string[]
  count: number
  reason: string
}

export interface FolderCleanupSuggestion {
  id: string
  kind: FolderCleanupSuggestionKind
  operation: FolderCleanupOperationKind
  severity: 'info' | 'warning' | 'danger'
  title: string
  summary: string
  reason: string
  primaryFolderId: string
  targetFolderId?: string
  folderIds: string[]
  bookmarkIds: string[]
  folders: FolderCleanupFolderSummary[]
  bookmarks: FolderCleanupBookmarkSummary[]
  splitGroups?: FolderCleanupSplitGroup[]
  canExecute: boolean
}

export interface FolderCleanupAnalysisOptions {
  tagIndex?: BookmarkTagIndex | null
  deepFolderMinDepth?: number
  singlePathMinLength?: number
  singlePathMaxBookmarks?: number
  largeFolderMinBookmarks?: number
}

interface FolderNodeModel {
  id: string
  title: string
  path: string
  depth: number
  parentId: string
  directBookmarkCount: number
  directFolderCount: number
  descendantBookmarkCount: number
  children: chrome.bookmarks.BookmarkTreeNode[]
  descendantBookmarks: FolderCleanupBookmarkSummary[]
}

const SYSTEM_FOLDER_IDS = new Set([ROOT_ID])

export function analyzeFolderCleanup(
  rootNode: chrome.bookmarks.BookmarkTreeNode | null | undefined,
  options: FolderCleanupAnalysisOptions = {}
): FolderCleanupSuggestion[] {
  if (!rootNode) {
    return []
  }

  const folderMap = new Map<string, FolderNodeModel>()
  const folderModels: FolderNodeModel[] = []
  collectFolders(rootNode, {
    path: '',
    depth: 0,
    parentId: ''
  }, folderMap, folderModels)

  const suggestions: FolderCleanupSuggestion[] = []
  suggestions.push(...buildEmptyFolderSuggestions(folderModels))
  suggestions.push(...buildDeepSingleBookmarkSuggestions(folderModels, options))
  suggestions.push(...buildSinglePathChainSuggestions(folderModels, folderMap, options))
  suggestions.push(...buildSameNameFolderSuggestions(folderModels))
  suggestions.push(...buildLargeFolderSuggestions(folderModels, options))

  const seen = new Set<string>()
  return suggestions
    .filter((suggestion) => {
      if (seen.has(suggestion.id)) {
        return false
      }
      seen.add(suggestion.id)
      return true
    })
    .sort(compareSuggestions)
}

function collectFolders(
  node: chrome.bookmarks.BookmarkTreeNode,
  context: { path: string; depth: number; parentId: string },
  folderMap: Map<string, FolderNodeModel>,
  folderModels: FolderNodeModel[]
): FolderNodeModel | null {
  if (node.url) {
    return null
  }

  const title = String(node.title || '').trim() || '未命名文件夹'
  const isRoot = String(node.id) === ROOT_ID
  const path = isRoot ? '' : context.path ? `${context.path} / ${title}` : title
  const depth = isRoot ? 0 : context.depth + 1
  const children = node.children || []
  const childFolders = children.filter((child) => !child.url)
  const directBookmarks = children.filter((child) => child.url)
  const descendantBookmarks: FolderCleanupBookmarkSummary[] = directBookmarks.map((child) => toBookmarkSummary(child))

  const model: FolderNodeModel = {
    id: String(node.id),
    title,
    path,
    depth,
    parentId: String(node.parentId || context.parentId || ''),
    directBookmarkCount: directBookmarks.length,
    directFolderCount: childFolders.length,
    descendantBookmarkCount: directBookmarks.length,
    children,
    descendantBookmarks
  }

  folderMap.set(model.id, model)

  for (const child of childFolders) {
    const childModel = collectFolders(child, {
      path,
      depth,
      parentId: model.id
    }, folderMap, folderModels)
    if (!childModel) {
      continue
    }
    model.descendantBookmarkCount += childModel.descendantBookmarkCount
    model.descendantBookmarks.push(...childModel.descendantBookmarks)
  }

  if (!isSystemFolder(model)) {
    folderModels.push(model)
  }

  return model
}

function buildEmptyFolderSuggestions(folderModels: FolderNodeModel[]): FolderCleanupSuggestion[] {
  return folderModels
    .filter((folder) => folder.depth > 1 && folder.descendantBookmarkCount === 0 && folder.directFolderCount === 0)
    .map((folder) => ({
      id: `empty-folder:${folder.id}`,
      kind: 'empty-folder',
      operation: 'delete',
      severity: 'danger',
      title: `删除空文件夹：${folder.title}`,
      summary: '该文件夹没有书签和子文件夹，可删除以减少层级噪音。',
      reason: `路径：${folder.path}`,
      primaryFolderId: folder.id,
      folderIds: [folder.id],
      bookmarkIds: [],
      folders: [toFolderSummary(folder)],
      bookmarks: [],
      canExecute: true
    }))
}

function buildDeepSingleBookmarkSuggestions(
  folderModels: FolderNodeModel[],
  options: FolderCleanupAnalysisOptions
): FolderCleanupSuggestion[] {
  const minDepth = options.deepFolderMinDepth ?? 4
  return folderModels
    .filter((folder) => (
      folder.depth >= minDepth &&
      folder.descendantBookmarkCount === 1 &&
      folder.directFolderCount === 0 &&
      Boolean(folder.parentId)
    ))
    .map((folder) => ({
      id: `deep-single-bookmark:${folder.id}`,
      kind: 'deep-single-bookmark',
      operation: 'move',
      severity: 'warning',
      title: `上移深层单书签文件夹：${folder.title}`,
      summary: '该深层文件夹只包含 1 个书签，建议把书签上移到父级后删除空文件夹。',
      reason: `当前层级 ${folder.depth} 层；书签：${folder.descendantBookmarks[0]?.title || '未命名书签'}`,
      primaryFolderId: folder.id,
      targetFolderId: folder.parentId,
      folderIds: [folder.id],
      bookmarkIds: folder.descendantBookmarks.map((bookmark) => bookmark.id),
      folders: [toFolderSummary(folder)],
      bookmarks: folder.descendantBookmarks,
      canExecute: true
    }))
}

function buildSinglePathChainSuggestions(
  folderModels: FolderNodeModel[],
  folderMap: Map<string, FolderNodeModel>,
  options: FolderCleanupAnalysisOptions
): FolderCleanupSuggestion[] {
  const minLength = options.singlePathMinLength ?? 3
  const maxBookmarks = options.singlePathMaxBookmarks ?? 5
  const suggestions: FolderCleanupSuggestion[] = []
  const coveredFolderIds = new Set<string>()

  for (const folder of folderModels) {
    if (coveredFolderIds.has(folder.id) || folder.directBookmarkCount > 0 || folder.directFolderCount !== 1) {
      continue
    }

    const chain = [folder]
    let current = getOnlyChildFolder(folder, folderMap)
    while (current && current.directBookmarkCount === 0 && current.directFolderCount === 1) {
      chain.push(current)
      current = getOnlyChildFolder(current, folderMap)
    }
    if (current) {
      chain.push(current)
    }

    const leaf = chain.at(-1)
    if (!leaf || chain.length < minLength || leaf.descendantBookmarkCount > maxBookmarks || !folder.parentId) {
      continue
    }

    chain.forEach((item) => coveredFolderIds.add(item.id))
    suggestions.push({
      id: `single-path-chain:${chain.map((item) => item.id).join('-')}`,
      kind: 'single-path-chain',
      operation: 'move',
      severity: 'warning',
      title: `压平单一路径：${chain.map((item) => item.title).join(' / ')}`,
      summary: `连续 ${chain.length} 层文件夹基本只有一条路径，且只有 ${leaf.descendantBookmarkCount} 个书签。`,
      reason: '建议把末端少量书签移动到链条上级，再删除这串空文件夹。',
      primaryFolderId: folder.id,
      targetFolderId: folder.parentId,
      folderIds: chain.map((item) => item.id),
      bookmarkIds: leaf.descendantBookmarks.map((bookmark) => bookmark.id),
      folders: chain.map(toFolderSummary),
      bookmarks: leaf.descendantBookmarks,
      canExecute: true
    })
  }

  return suggestions
}

function buildSameNameFolderSuggestions(folderModels: FolderNodeModel[]): FolderCleanupSuggestion[] {
  const groups = new Map<string, FolderNodeModel[]>()
  for (const folder of folderModels) {
    const key = normalizeFolderTitle(folder.title)
    if (!key) {
      continue
    }
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)?.push(folder)
  }

  return [...groups.values()]
    .filter((folders) => folders.length > 1)
    .map((folders) => {
      const sortedFolders = folders.slice().sort((left, right) => (
        right.descendantBookmarkCount - left.descendantBookmarkCount ||
        left.path.localeCompare(right.path, 'zh-CN')
      ))
      const target = sortedFolders[0]
      const sources = sortedFolders.slice(1)
      return {
        id: `same-name-folders:${normalizeFolderTitle(target.title)}:${sortedFolders.map((folder) => folder.id).join('-')}`,
        kind: 'same-name-folders',
        operation: 'merge',
        severity: 'info',
        title: `合并同名文件夹：${target.title}`,
        summary: `发现 ${sortedFolders.length} 个同名文件夹，建议合并到内容最多的路径。`,
        reason: `目标路径：${target.path}`,
        primaryFolderId: sources[0]?.id || target.id,
        targetFolderId: target.id,
        folderIds: sortedFolders.map((folder) => folder.id),
        bookmarkIds: sources.flatMap((folder) => folder.descendantBookmarks.map((bookmark) => bookmark.id)),
        folders: sortedFolders.map(toFolderSummary),
        bookmarks: sources.flatMap((folder) => folder.descendantBookmarks).slice(0, 12),
        canExecute: sources.length > 0
      } satisfies FolderCleanupSuggestion
    })
}

function buildLargeFolderSuggestions(
  folderModels: FolderNodeModel[],
  options: FolderCleanupAnalysisOptions
): FolderCleanupSuggestion[] {
  const minBookmarks = options.largeFolderMinBookmarks ?? 40

  return folderModels
    .filter((folder) => folder.descendantBookmarkCount >= minBookmarks)
    .map((folder) => {
      const splitGroups = buildSplitGroups(folder, options.tagIndex)
      return {
        id: `large-folder-split:${folder.id}`,
        kind: 'large-folder-split',
        operation: splitGroups.length ? 'split' : 'preview',
        severity: 'info',
        title: `拆分超大文件夹：${folder.title}`,
        summary: `该文件夹下共有 ${folder.descendantBookmarkCount} 个书签，可按域名、标签或主题拆成更小的子文件夹。`,
        reason: splitGroups.length
          ? `已生成 ${splitGroups.length} 个可预览拆分组。`
          : '暂未找到稳定的拆分维度，建议人工查看后处理。',
        primaryFolderId: folder.id,
        targetFolderId: folder.id,
        folderIds: [folder.id],
        bookmarkIds: splitGroups.flatMap((group) => group.bookmarkIds),
        folders: [toFolderSummary(folder)],
        bookmarks: folder.descendantBookmarks.slice(0, 12),
        splitGroups,
        canExecute: splitGroups.length > 0
      } satisfies FolderCleanupSuggestion
    })
}

function buildSplitGroups(
  folder: FolderNodeModel,
  tagIndex?: BookmarkTagIndex | null
): FolderCleanupSplitGroup[] {
  const byDomain = groupBookmarks(folder.descendantBookmarks, (bookmark) => bookmark.domain)
  const domainGroups = toSplitGroups(byDomain, 'domain', '按域名')
  if (domainGroups.length >= 2) {
    return domainGroups.slice(0, 8)
  }

  const tagsByBookmarkId = tagIndex?.records || {}
  const byTag = groupBookmarks(folder.descendantBookmarks, (bookmark) => {
    const record = tagsByBookmarkId[bookmark.id]
    const tag = [...(record?.manualTags || []), ...(record?.tags || []), ...(record?.topics || [])]
      .map((value) => String(value || '').trim())
      .find((value) => value.length >= 2)
    return tag || ''
  })
  const tagGroups = toSplitGroups(byTag, 'tag', '按标签/主题')
  return tagGroups.slice(0, 8)
}

function groupBookmarks(
  bookmarks: FolderCleanupBookmarkSummary[],
  getKey: (bookmark: FolderCleanupBookmarkSummary) => string
): Map<string, FolderCleanupBookmarkSummary[]> {
  const groups = new Map<string, FolderCleanupBookmarkSummary[]>()
  for (const bookmark of bookmarks) {
    const key = String(getKey(bookmark) || '').trim()
    if (!key) {
      continue
    }
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)?.push(bookmark)
  }
  return groups
}

function toSplitGroups(
  groups: Map<string, FolderCleanupBookmarkSummary[]>,
  prefix: string,
  reasonPrefix: string
): FolderCleanupSplitGroup[] {
  return [...groups.entries()]
    .filter(([, bookmarks]) => bookmarks.length >= 4)
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0], 'zh-CN'))
    .map(([key, bookmarks]) => ({
      key: `${prefix}:${key}`,
      label: key,
      bookmarkIds: bookmarks.map((bookmark) => bookmark.id),
      count: bookmarks.length,
      reason: `${reasonPrefix}集中 ${bookmarks.length} 个书签。`
    }))
}

function getOnlyChildFolder(
  folder: FolderNodeModel,
  folderMap: Map<string, FolderNodeModel>
): FolderNodeModel | null {
  const childFolder = folder.children.find((child) => !child.url)
  return childFolder ? folderMap.get(String(childFolder.id)) || null : null
}

function toBookmarkSummary(node: chrome.bookmarks.BookmarkTreeNode): FolderCleanupBookmarkSummary {
  return {
    id: String(node.id),
    title: String(node.title || '').trim() || '未命名书签',
    url: String(node.url || ''),
    parentId: String(node.parentId || ''),
    domain: extractHostname(String(node.url || ''))
  }
}

function toFolderSummary(folder: FolderNodeModel): FolderCleanupFolderSummary {
  return {
    id: folder.id,
    title: folder.title,
    path: folder.path,
    depth: folder.depth,
    directBookmarkCount: folder.directBookmarkCount,
    directFolderCount: folder.directFolderCount,
    descendantBookmarkCount: folder.descendantBookmarkCount
  }
}

function compareSuggestions(left: FolderCleanupSuggestion, right: FolderCleanupSuggestion): number {
  const weight = {
    'empty-folder': 5,
    'single-path-chain': 4,
    'deep-single-bookmark': 3,
    'same-name-folders': 2,
    'large-folder-split': 1
  }

  return (
    weight[right.kind] - weight[left.kind] ||
    right.bookmarkIds.length - left.bookmarkIds.length ||
    left.title.localeCompare(right.title, 'zh-CN')
  )
}

function isSystemFolder(folder: FolderNodeModel): boolean {
  return SYSTEM_FOLDER_IDS.has(folder.id) || folder.depth <= 0
}

function normalizeFolderTitle(title: string): string {
  return String(title || '').trim().toLowerCase()
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}
