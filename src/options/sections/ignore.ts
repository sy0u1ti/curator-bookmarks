import { STORAGE_KEYS } from '../../shared/constants.js'
import { getLocalStorage, setLocalStorage, withLocalStorageTransaction } from '../../shared/storage.js'
import {
  managerState,
  createEmptyIgnoreRules
} from '../shared-options/state.js'
import { publishIgnoreRules } from '../components/ignore-rules-store.js'
import { isInteractionLocked } from '../shared-options/utils.js'

export function normalizeIgnoreRules(rawRules) {
  const normalized = createEmptyIgnoreRules()
  const source = rawRules && typeof rawRules === 'object' ? rawRules : {}

  normalized.bookmarks = normalizeBookmarkIgnoreRules(source.bookmarks)
  normalized.domains = normalizeDomainIgnoreRules(source.domains)
  normalized.folders = normalizeFolderIgnoreRules(source.folders)
  normalized.bookmarkIds = new Set(normalized.bookmarks.map((rule) => rule.bookmarkId))
  normalized.domainValues = new Set(normalized.domains.map((rule) => rule.domain))
  normalized.folderIds = new Set(normalized.folders.map((rule) => rule.folderId))

  return normalized
}

function normalizeBookmarkIgnoreRules(rules) {
  if (!Array.isArray(rules)) {
    return []
  }

  return rules.flatMap((combineValue, combineIndex, combineArray) => { const combinedResult = ((rule) => {
      return {
        bookmarkId: String(rule?.bookmarkId || '').trim(),
        title: String(rule?.title || '未命名书签').trim() || '未命名书签',
        url: String(rule?.url || '').trim(),
        createdAt: Number(rule?.createdAt) || Date.now()
      }
    })(combineValue); return ((rule) => rule.bookmarkId)(combinedResult) ? [combinedResult] : [] })
}

function normalizeDomainIgnoreRules(rules) {
  if (!Array.isArray(rules)) {
    return []
  }

  return rules.flatMap((combineValue, combineIndex, combineArray) => { const combinedResult = ((rule) => {
      return {
        domain: String(rule?.domain || '').trim().toLowerCase(),
        createdAt: Number(rule?.createdAt) || Date.now()
      }
    })(combineValue); return ((rule) => rule.domain)(combinedResult) ? [combinedResult] : [] })
}

function normalizeFolderIgnoreRules(rules) {
  if (!Array.isArray(rules)) {
    return []
  }

  return rules.flatMap((combineValue, combineIndex, combineArray) => { const combinedResult = ((rule) => {
      return {
        folderId: String(rule?.folderId || '').trim(),
        title: String(rule?.title || '未命名文件夹').trim() || '未命名文件夹',
        path: String(rule?.path || '').trim(),
        createdAt: Number(rule?.createdAt) || Date.now()
      }
    })(combineValue); return ((rule) => rule.folderId)(combinedResult) ? [combinedResult] : [] })
}

function serializeIgnoreRules(ignoreRules) {
  return {
    bookmarks: ignoreRules.bookmarks.map((rule) => ({
      bookmarkId: rule.bookmarkId,
      title: rule.title,
      url: rule.url,
      createdAt: rule.createdAt
    })),
    domains: ignoreRules.domains.map((rule) => ({
      domain: rule.domain,
      createdAt: rule.createdAt
    })),
    folders: ignoreRules.folders.map((rule) => ({
      folderId: rule.folderId,
      title: rule.title,
      path: rule.path,
      createdAt: rule.createdAt
    }))
  }
}

export async function saveIgnoreRules(nextIgnoreRules = managerState.ignoreRules) {
  const previous = normalizeIgnoreRules(managerState.ignoreRules)
  const normalized = normalizeIgnoreRules(nextIgnoreRules)
  const saved = await withLocalStorageTransaction(async transaction => {
    const stored = await getLocalStorage(STORAGE_KEYS.ignoreRules)
    const current = normalizeIgnoreRules(stored[STORAGE_KEYS.ignoreRules])
    const merged = normalizeIgnoreRules({
      bookmarks: mergeIgnoreRuleChanges(current.bookmarks, previous.bookmarks, normalized.bookmarks, rule => rule.bookmarkId),
      domains: mergeIgnoreRuleChanges(current.domains, previous.domains, normalized.domains, rule => rule.domain),
      folders: mergeIgnoreRuleChanges(current.folders, previous.folders, normalized.folders, rule => rule.folderId)
    })
    await setLocalStorage({ [STORAGE_KEYS.ignoreRules]: serializeIgnoreRules(merged) }, { transaction })
    return merged
  })
  managerState.ignoreRules = saved
}

function mergeIgnoreRuleChanges<T>(current: T[], previous: T[], next: T[], key: (rule: T) => string): T[] {
  const before = new Map(previous.map(rule => [key(rule), rule]))
  const after = new Map(next.map(rule => [key(rule), rule]))
  const merged = new Map(current.map(rule => [key(rule), rule]))
  for (const id of before.keys()) {
    if (!after.has(id)) merged.delete(id)
  }
  for (const [id, rule] of after) {
    if (!before.has(id) || JSON.stringify(before.get(id)) !== JSON.stringify(rule)) merged.set(id, rule)
  }
  return [...merged.values()]
}

export function matchesIgnoreRules(result) {
  if (!result) {
    return false
  }

  if (managerState.ignoreRules.bookmarkIds.has(String(result.id))) {
    return true
  }

  if (result.domain && managerState.ignoreRules.domainValues.has(String(result.domain))) {
    return true
  }

  return (result.ancestorIds || []).some((folderId) => {
    return managerState.ignoreRules.folderIds.has(String(folderId))
  })
}

export function renderIgnoreSection() {
  publishIgnoreRules({
    locked: isInteractionLocked(),
    bookmarks: managerState.ignoreRules.bookmarks,
    domains: managerState.ignoreRules.domains,
    folders: managerState.ignoreRules.folders
  })
}

export async function removeIgnoreRule(kind, ruleId, callbacks) {
  const releaseMutationLock = await callbacks?.claimAvailabilityMutationLock?.()
  if (!releaseMutationLock) {
    return
  }

  try {
    const nextIgnoreRules = normalizeIgnoreRules(managerState.ignoreRules)
    if (kind === 'bookmark') {
      nextIgnoreRules.bookmarks = nextIgnoreRules.bookmarks.filter((rule) => {
        return String(rule.bookmarkId) !== ruleId
      })
      nextIgnoreRules.bookmarkIds.delete(ruleId)
    }

    if (kind === 'domain') {
      nextIgnoreRules.domains = nextIgnoreRules.domains.filter((rule) => {
        return String(rule.domain) !== ruleId
      })
      nextIgnoreRules.domainValues.delete(ruleId)
    }

    if (kind === 'folder') {
      nextIgnoreRules.folders = nextIgnoreRules.folders.filter((rule) => {
        return String(rule.folderId) !== ruleId
      })
      nextIgnoreRules.folderIds.delete(ruleId)
    }

    await saveIgnoreRules(nextIgnoreRules)
    callbacks?.onIgnoreRulesChanged?.()
  } catch (error) {
    callbacks?.onIgnoreRulesError?.(error)
  } finally {
    releaseMutationLock()
  }
}

export async function clearIgnoreRules(kind, callbacks) {
  const confirmedRules = normalizeIgnoreRules(managerState.ignoreRules)
  const meta = {
    bookmark: {
      label: '书签',
      count: managerState.ignoreRules.bookmarks.length
    },
    domain: {
      label: '域名',
      count: managerState.ignoreRules.domains.length
    },
    folder: {
      label: '文件夹',
      count: managerState.ignoreRules.folders.length
    }
  }[kind]

  if (!meta?.count) {
    return
  }

  const confirmed = callbacks?.confirm
    ? await callbacks.confirm({
        title: `清空 ${meta.count} 条${meta.label}忽略规则？`,
        copy: '清空后，对应异常会重新出现在后续检测结果中。已保存的书签不会被删除。',
        confirmLabel: '清空规则',
        label: '清空规则',
        tone: 'warning'
      })
    : true
  if (!confirmed) {
    return
  }

  const releaseMutationLock = await callbacks?.claimAvailabilityMutationLock?.()
  if (!releaseMutationLock) {
    return
  }

  try {
    const nextIgnoreRules = normalizeIgnoreRules(managerState.ignoreRules)
    if (kind === 'bookmark') {
      nextIgnoreRules.bookmarks = nextIgnoreRules.bookmarks.filter(rule => !confirmedRules.bookmarkIds.has(rule.bookmarkId))
      nextIgnoreRules.bookmarkIds = new Set(nextIgnoreRules.bookmarks.map(rule => rule.bookmarkId))
    }

    if (kind === 'domain') {
      nextIgnoreRules.domains = nextIgnoreRules.domains.filter(rule => !confirmedRules.domainValues.has(rule.domain))
      nextIgnoreRules.domainValues = new Set(nextIgnoreRules.domains.map(rule => rule.domain))
    }

    if (kind === 'folder') {
      nextIgnoreRules.folders = nextIgnoreRules.folders.filter(rule => !confirmedRules.folderIds.has(rule.folderId))
      nextIgnoreRules.folderIds = new Set(nextIgnoreRules.folders.map(rule => rule.folderId))
    }

    await saveIgnoreRules(nextIgnoreRules)
    callbacks?.onIgnoreRulesChanged?.()
  } catch (error) {
    callbacks?.onIgnoreRulesError?.(error)
  } finally {
    releaseMutationLock()
  }
}
