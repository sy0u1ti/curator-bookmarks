import { loadBackupProtectedIconReferences } from './backup.js'
import { getBookmarkTree } from './bookmarks-api.js'
import { extractBookmarkData } from './bookmark-tree.js'
import { STORAGE_KEYS } from './constants.js'
import { clearContentSnapshotFullTexts, getContentFullTextStorageUsage, loadContentSnapshotIndex } from './content-snapshots.js'
import { collectCustomIconReferences, inspectCustomIconStorage, normalizeCustomIconEntries, resolveCustomIconState } from './repositories/custom-icon-repository.js'
import { getLocalStorage, removeLocalStorage, setLocalStorage, withLocalStorageTransaction } from './storage.js'

const PREVIEW_KEYS = [STORAGE_KEYS.newTabFeaturedBackgroundPreviewCache]
const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) || '').byteLength

function retainLiveIconEntries(local: Record<string, unknown>, tree: chrome.bookmarks.BookmarkTreeNode[]) {
  const bookmarks = extractBookmarkData(tree[0]).bookmarkMap
  return Object.fromEntries(Object.entries(normalizeCustomIconEntries(local[STORAGE_KEYS.newTabCustomIcons]))
    .filter(([id]) => bookmarks.has(id)))
}

export async function getStorageUsage() {
  const [local, protectedIcons, fullText, index, estimate, tree] = await Promise.all([
    getLocalStorage(null), loadBackupProtectedIconReferences(), getContentFullTextStorageUsage(),
    loadContentSnapshotIndex(), navigator.storage?.estimate().catch(() => null), getBookmarkTree()
  ])
  const [icons, resolved] = await Promise.all([
    inspectCustomIconStorage(collectCustomIconReferences({ ...local, [STORAGE_KEYS.newTabCustomIcons]: retainLiveIconEntries(local, tree) }, protectedIcons)),
    resolveCustomIconState(local[STORAGE_KEYS.newTabCustomIcons])
  ])
  const inlineRecords = Object.values(index.records).filter(record => record.fullTextStorage === 'local')
  return {
    localBytes: byteLength(local), originBytes: estimate?.usage ?? null,
    icons, missingIcons: resolved.missingIds.length,
    fullText: { count: fullText.count + inlineRecords.length, bytes: fullText.bytes + inlineRecords.reduce((sum, record) => sum + new TextEncoder().encode(record.fullText || '').byteLength, 0) },
    previewBytes: PREVIEW_KEYS.reduce((sum, key) => sum + (local[key] ? byteLength(local[key]) : 0), 0)
  }
}

export type StorageCleanupCategory = 'icons' | 'missing-icons' | 'full-text' | 'previews'

export async function cleanStorageCategory(category: StorageCleanupCategory): Promise<string> {
  if (category === 'full-text') {
    await clearContentSnapshotFullTexts()
    return '已清除本地正文，摘要与书签仍保留。之后采集的正文仍按当前设置保存。'
  }
  return withLocalStorageTransaction(async transaction => {
    if (category === 'previews') {
      await removeLocalStorage(PREVIEW_KEYS, { transaction })
      return '已清除壁纸预览缓存，下次浏览时会重新获取。'
    }
    const local = await getLocalStorage(null)
    if (category === 'missing-icons') {
      const entries = normalizeCustomIconEntries(local[STORAGE_KEYS.newTabCustomIcons])
      const { missingIds, unavailableIds } = await resolveCustomIconState(entries)
      if (unavailableIds.length) throw new Error('图片存储暂时无法读取，已保留图标引用，请稍后重试。')
      for (const id of missingIds) delete entries[id]
      await setLocalStorage({ [STORAGE_KEYS.newTabCustomIcons]: entries }, { transaction })
      return `已移除 ${missingIds.length} 个失效图标引用。可在新标签页书签菜单重新选择图片。`
    }
    const [tree, protectedRefs] = await Promise.all([getBookmarkTree(), loadBackupProtectedIconReferences()])
    const currentIcons = retainLiveIconEntries(local, tree)
    if (JSON.stringify(currentIcons) !== JSON.stringify(local[STORAGE_KEYS.newTabCustomIcons] || {})) {
      await setLocalStorage({ [STORAGE_KEYS.newTabCustomIcons]: currentIcons }, { transaction })
      local[STORAGE_KEYS.newTabCustomIcons] = currentIcons
    }
    const references = collectCustomIconReferences(local, protectedRefs)
    const result = await inspectCustomIconStorage(references, { transaction })
    return `已清理 ${result.removed} 张闲置图标；${result.unused - result.removed} 张处于 24 小时宽限期。回收站和恢复数据引用的图片已保留。`
  })
}
