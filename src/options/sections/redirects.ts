import { STORAGE_KEYS } from '../../shared/constants.js'
import { setLocalStorage } from '../../shared/storage.js'
import { updateBookmark } from '../../shared/bookmarks-api.js'
import { createAutoBackupBeforeDangerousOperation } from '../../shared/backup.js'
import { displayUrl } from '../../shared/text.js'
import {
  availabilityState,
  managerState,
  createEmptyRedirectCache,
  normalizeHistoryRunScope
} from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeHtml, escapeAttr } from '../shared-options/html.js'
import {
  isInteractionLocked,
  syncSelectionSet,
  formatDateTime
} from '../shared-options/utils.js'
import { isRedirectedNavigation } from './classifier.js'
import { deleteBookmarksToRecycle } from './recycle.js'

export function normalizeRedirectCache(rawCache) {
  if (!rawCache || typeof rawCache !== 'object') {
    return createEmptyRedirectCache()
  }

  return {
    savedAt: Number(rawCache.savedAt) || 0,
    scope: normalizeHistoryRunScope(rawCache.scope),
    results: normalizeRedirectCacheResults(rawCache.results)
  }
}

function normalizeRedirectCacheResults(entries) {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries
    .map((entry) => {
      const bookmarkId = String(entry?.id || '').trim()
      const url = String(entry?.url || '').trim()
      const finalUrl = String(entry?.finalUrl || '').trim()

      if (!bookmarkId || !url || !finalUrl) {
        return null
      }

      return {
        id: bookmarkId,
        title: String(entry?.title || '未命名书签').trim() || '未命名书签',
        url,
        finalUrl,
        path: String(entry?.path || '').trim(),
        parentId: String(entry?.parentId || '').trim(),
        index: Number.isFinite(Number(entry?.index)) ? Number(entry.index) : 0,
        ancestorIds: Array.isArray(entry?.ancestorIds)
          ? entry.ancestorIds.map((folderId) => String(folderId)).filter(Boolean)
          : [],
        badgeText: String(entry?.badgeText || '已跳转').trim() || '已跳转',
        detail: String(entry?.detail || '').trim(),
        status: 'redirected'
      }
    })
    .filter(Boolean)
}

function serializeRedirectCache(redirectCache = managerState.redirectCache) {
  return {
    version: 1,
    savedAt: Number(redirectCache?.savedAt) || 0,
    scope: normalizeHistoryRunScope(redirectCache?.scope),
    results: (Array.isArray(redirectCache?.results) ? redirectCache.results : []).map((result) => ({
      id: result.id,
      title: result.title,
      url: result.url,
      finalUrl: result.finalUrl,
      path: result.path,
      parentId: result.parentId,
      index: result.index,
      ancestorIds: Array.isArray(result.ancestorIds) ? result.ancestorIds : [],
      badgeText: result.badgeText,
      detail: result.detail
    }))
  }
}

export async function saveRedirectCache(redirectCache = managerState.redirectCache) {
  await setLocalStorage({
    [STORAGE_KEYS.redirectCache]: serializeRedirectCache(redirectCache)
  })
}

export function synchronizeRedirectResults() {
  const nextResults = availabilityState.redirectResults.filter((result) => {
    return isRedirectedNavigation(result.url, result.finalUrl || result.url)
  })

  if (nextResults.length !== availabilityState.redirectResults.length) {
    availabilityState.redirectResults = nextResults
    availabilityState.redirectedCount = nextResults.length
  }
}

function getCachedRedirectResults() {
  return managerState.redirectCache.results
    .map((cachedResult) => {
      const latestBookmark = availabilityState.bookmarkMap.get(String(cachedResult.id))
      if (!latestBookmark) {
        return null
      }

      const finalUrl = String(cachedResult.finalUrl || '').trim()
      if (!finalUrl || !isRedirectedNavigation(latestBookmark.url, finalUrl)) {
        return null
      }

      return {
        ...cachedResult,
        title: latestBookmark.title,
        url: latestBookmark.url,
        displayUrl: latestBookmark.displayUrl,
        path: latestBookmark.path,
        ancestorIds: latestBookmark.ancestorIds,
        parentId: latestBookmark.parentId,
        index: latestBookmark.index,
        domain: latestBookmark.domain,
        normalizedTitle: latestBookmark.normalizedTitle,
        normalizedUrl: latestBookmark.normalizedUrl,
        duplicateKey: latestBookmark.duplicateKey
      }
    })
    .filter(Boolean)
}

export function getRedirectSectionState(callbacks) {
  synchronizeRedirectResults()

  if (availabilityState.running || availabilityState.lastCompletedAt || availabilityState.redirectResults.length) {
    return {
      useCachedResults: false,
      results: availabilityState.redirectResults,
      scope: callbacks.getCurrentAvailabilityScopeMeta(),
      savedAt: availabilityState.lastCompletedAt
    }
  }

  return {
    useCachedResults: true,
    results: getCachedRedirectResults(),
    scope: normalizeHistoryRunScope(managerState.redirectCache.scope),
    savedAt: managerState.redirectCache.savedAt
  }
}

export async function persistRedirectCacheSnapshot(callbacks, {
  savedAt = managerState.redirectCache.savedAt || availabilityState.lastCompletedAt || Date.now(),
  scope = managerState.redirectCache.scope?.key
    ? managerState.redirectCache.scope
    : callbacks.getCurrentAvailabilityScopeMeta()
} = {}) {
  const scopeMeta = normalizeHistoryRunScope(scope)
  managerState.redirectCache = {
    savedAt: Number(savedAt) || 0,
    scope: scopeMeta,
    results: availabilityState.redirectResults
      .filter((result) => {
        return Boolean(String(result?.id || '').trim()) && isRedirectedNavigation(result.url, result.finalUrl || result.url)
      })
      .map((result) => ({
        id: String(result.id),
        title: String(result.title || '未命名书签'),
        url: String(result.url || ''),
        finalUrl: String(result.finalUrl || ''),
        path: String(result.path || ''),
        parentId: String(result.parentId || ''),
        index: Number.isFinite(Number(result.index)) ? Number(result.index) : 0,
        ancestorIds: Array.isArray(result.ancestorIds) ? result.ancestorIds.map((folderId) => String(folderId)).filter(Boolean) : [],
        badgeText: String(result.badgeText || '已跳转'),
        detail: String(result.detail || ''),
        status: 'redirected'
      }))
  }

  await saveRedirectCache()
}

export function removeRedirectIdsFromState(bookmarkIds) {
  const removedIdSet = new Set(bookmarkIds.map((id) => String(id)).filter(Boolean))
  if (!removedIdSet.size) {
    return
  }

  availabilityState.redirectResults = availabilityState.redirectResults.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  availabilityState.redirectedCount = availabilityState.redirectResults.length
  managerState.redirectCache.results = managerState.redirectCache.results.filter((result) => {
    return !removedIdSet.has(String(result.id))
  })
  managerState.selectedRedirectIds = new Set(
    [...managerState.selectedRedirectIds].filter((id) => !removedIdSet.has(String(id)))
  )
}

export function renderRedirectSection(callbacks) {
  if (!dom.redirectResults) {
    return
  }

  const redirectSection = getRedirectSectionState(callbacks)
  const redirectResults = redirectSection.results

  syncSelectionSet(
    managerState.selectedRedirectIds,
    new Set(redirectResults.map((result) => String(result.id)))
  )

  dom.redirectCount.textContent = `${redirectResults.length} 条待更新`
  dom.redirectSelectionGroup.classList.toggle('hidden', managerState.selectedRedirectIds.size === 0)
  dom.redirectSelectionCount.textContent = `${managerState.selectedRedirectIds.size} 条已选择`
  dom.redirectBatchUpdate.disabled = isInteractionLocked() || managerState.selectedRedirectIds.size === 0
  dom.redirectDeleteSelection.disabled = isInteractionLocked() || managerState.selectedRedirectIds.size === 0
  dom.redirectSelectAll.disabled = redirectResults.length === 0
  dom.redirectDeleteAll.disabled = isInteractionLocked() || redirectResults.length === 0
  if (dom.redirectResultsSubtitle) {
    dom.redirectResultsSubtitle.textContent = redirectSection.useCachedResults && redirectSection.savedAt && redirectResults.length
      ? `当前展示的是 ${formatDateTime(redirectSection.savedAt)} 的本地缓存结果，来源范围：${redirectSection.scope.label}。刷新页面后仍可直接更新，不需要重新检测。`
      : redirectSection.useCachedResults
        ? '完成检测后，这里会展示原书签地址与最终落地地址不一致的结果。结果会本地缓存，刷新页面后仍可直接更新。'
        : '当前展示的是本次设置页会话中的重定向检测结果；刷新页面后，这里的待更新列表会回退到本地缓存结果。'
  }

  if (!redirectResults.length) {
    dom.redirectResults.innerHTML = availabilityState.lastCompletedAt
      ? '<div class="detect-empty">最近一次检测没有发现需要更新最终 URL 的重定向书签。</div>'
      : redirectSection.useCachedResults && redirectSection.savedAt
        ? '<div class="detect-empty">当前没有可直接更新的重定向缓存结果。完成新的检测后，这里会重新生成待更新列表。</div>'
        : '<div class="detect-empty">完成一次检测后，这里会展示可一键更新的重定向书签。</div>'
    return
  }

  dom.redirectResults.innerHTML = redirectResults
    .map((result) => buildRedirectResultCard(result))
    .join('')
}

function buildRedirectResultCard(result) {
  const selected = managerState.selectedRedirectIds.has(String(result.id))
  const interactionLocked = isInteractionLocked()

  return `
    <article class="detect-result-card ${selected ? 'selected' : ''}">
      <div class="detect-result-head">
        <div class="detect-result-head-left">
          <label class="detect-result-check">
            <input
              type="checkbox"
              data-redirect-select="true"
              data-bookmark-id="${escapeAttr(result.id)}"
              ${selected ? 'checked' : ''}
              ${interactionLocked ? 'disabled' : ''}
            >
            <span>选择</span>
          </label>
          <span class="options-chip success">已跳转</span>
        </div>
        <div class="detect-result-actions">
          <button
            class="detect-result-action"
            type="button"
            data-redirect-update="${escapeAttr(result.id)}"
            ${interactionLocked ? 'disabled' : ''}
          >
            更新为最终 URL
          </button>
          <a class="detect-result-open" href="${escapeAttr(result.finalUrl || result.url)}" target="_blank" rel="noreferrer noopener">
            打开最终链接
          </a>
        </div>
      </div>
      <div class="detect-result-copy">
        <strong>${escapeHtml(result.title || '未命名书签')}</strong>
        <div class="detect-result-detail">
          原地址：<span class="detect-inline-url">${escapeHtml(displayUrl(result.url))}</span>
        </div>
        <div class="detect-result-detail">
          最终地址：<span class="detect-inline-url">${escapeHtml(displayUrl(result.finalUrl || result.url))}</span>
        </div>
        <p class="detect-result-path" title="${escapeAttr(result.path || '未归档路径')}">${escapeHtml(result.path || '未归档路径')}</p>
      </div>
    </article>
  `
}

export function handleRedirectResultsClick(event, callbacks) {
  const selectionInput = event.target.closest('input[data-redirect-select]')
  if (selectionInput) {
    const bookmarkId = String(selectionInput.getAttribute('data-bookmark-id') || '').trim()
    if (selectionInput.checked) {
      managerState.selectedRedirectIds.add(bookmarkId)
    } else {
      managerState.selectedRedirectIds.delete(bookmarkId)
    }
    callbacks.renderAvailabilitySection()
    return
  }

  const updateButton = event.target.closest('[data-redirect-update]')
  if (!updateButton || isInteractionLocked()) {
    return
  }

  const bookmarkId = String(updateButton.getAttribute('data-redirect-update') || '').trim()
  if (!bookmarkId) {
    return
  }

  updateRedirectEntries([bookmarkId], callbacks)
}

export function clearRedirectSelection(callbacks) {
  managerState.selectedRedirectIds.clear()
  callbacks.renderAvailabilitySection()
}

export function selectAllRedirects(callbacks) {
  const { results } = getRedirectSectionState(callbacks)
  managerState.selectedRedirectIds = new Set(
    results.map((result) => String(result.id))
  )
  callbacks.renderAvailabilitySection()
}

export async function updateSelectedRedirects(callbacks) {
  if (isInteractionLocked() || !managerState.selectedRedirectIds.size) {
    return
  }

  const selectedIds = [...managerState.selectedRedirectIds]
  const redirectSection = getRedirectSectionState(callbacks)
  const targetResults = redirectSection.results.filter((result) => {
    return selectedIds.includes(String(result.id))
  })
  if (!targetResults.length) {
    return
  }

  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `更新 ${targetResults.length} 条重定向书签 URL？`,
        copy: `会把这些书签的原地址替换为最终地址：${formatRedirectImpactList(targetResults)}。书签标题和所在文件夹不变。`,
        confirmLabel: `更新 ${targetResults.length} 条 URL`,
        label: '更新 URL',
        tone: 'warning'
      })
    : true
  if (!confirmed) {
    return
  }

  await updateRedirectEntries(selectedIds, callbacks)
  clearRedirectSelection(callbacks)
}

export async function deleteSelectedRedirects(callbacks) {
  if (isInteractionLocked() || !managerState.selectedRedirectIds.size) {
    return
  }

  const targetIds = [...managerState.selectedRedirectIds]
  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `删除 ${targetIds.length} 条重定向书签？`,
        copy: '这些书签会从 Chrome 书签中移除并进入回收站。重定向缓存中的对应结果也会被清理。',
        confirmLabel: '删除并移入回收站',
        label: '移入回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(targetIds, '重定向书签批量删除', callbacks.recycleCallbacks)
  clearRedirectSelection(callbacks)
}

export async function deleteAllRedirects(callbacks) {
  const { results } = getRedirectSectionState(callbacks)
  if (isInteractionLocked() || !results.length) {
    return
  }

  const targetIds = results.map((result) => result.id)
  const confirmed = callbacks.confirm
    ? await callbacks.confirm({
        title: `删除本区全部 ${targetIds.length} 条重定向书签？`,
        copy: '这些书签会从 Chrome 书签中移除并进入回收站。此操作只影响当前重定向更新区。',
        confirmLabel: '删除本区并移入回收站',
        label: '移入回收站',
        tone: 'danger'
      })
    : true
  if (!confirmed) {
    return
  }

  await deleteBookmarksToRecycle(targetIds, '重定向书签整区删除', callbacks.recycleCallbacks)
  clearRedirectSelection(callbacks)
}

async function updateRedirectEntries(bookmarkIds, callbacks) {
  const redirectSection = getRedirectSectionState(callbacks)
  const targetResults = redirectSection.results.filter((result) => {
    return bookmarkIds.includes(String(result.id))
  })

  if (!targetResults.length) {
    return
  }

  availabilityState.deleting = true
  availabilityState.lastError = ''
  callbacks.renderAvailabilitySection()

  const updatedIds = []
  let updateError = null

  try {
    await createAutoBackupBeforeDangerousOperation({
      kind: 'redirect-url-update',
      source: 'options',
      reason: `批量更新 ${targetResults.length} 条重定向 URL`,
      targetBookmarkIds: targetResults.map((result) => String(result.id)),
      estimatedChangeCount: targetResults.length
    })

    for (const result of targetResults) {
      const finalUrl = String(result.finalUrl || '').trim()
      if (!finalUrl || !isRedirectedNavigation(result.url, finalUrl)) {
        continue
      }

      await updateBookmark(result.id, { url: finalUrl })
      updatedIds.push(result.id)
    }
  } catch (error) {
    updateError = error
  } finally {
    availabilityState.deleting = false

    if (updatedIds.length) {
      removeRedirectIdsFromState(updatedIds)
      await callbacks.hydrateAvailabilityCatalog({ preserveResults: true })
      await saveRedirectCache()
    }

    if (updateError) {
      availabilityState.lastError =
        updateError instanceof Error
          ? `批量更新重定向过程中断，已更新 ${updatedIds.length} 条：${updateError.message}`
          : `批量更新重定向过程中断，已更新 ${updatedIds.length} 条。`
    } else if (updatedIds.length) {
      availabilityState.lastError = `已将 ${updatedIds.length} 条重定向书签更新为最终 URL。`
    }

    callbacks.renderAvailabilitySection()
  }
}

function formatRedirectImpactList(results) {
  const names = results.slice(0, 3).map((result) => {
    return result.title || displayUrl(result.url) || result.id
  })
  const remaining = Math.max(0, results.length - names.length)
  return remaining ? `${names.join('、')} 等 ${results.length} 条` : names.join('、')
}
