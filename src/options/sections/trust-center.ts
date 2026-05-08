import { STORAGE_KEYS } from '../../shared/constants.js'
import { getEffectiveBookmarkTags } from '../../shared/bookmark-tags.js'
import {
  appendPrivacyAuditLogEntry,
  clearPrivacyAuditLog,
  loadPrivacyAuditLog,
  normalizePrivacyAuditLog,
  type PrivacyAuditInput,
  type PrivacyAuditLog
} from '../../shared/privacy-audit.js'
import { setLocalStorage } from '../../shared/storage.js'
import { normalizeText } from '../../shared/text.js'
import { aiNamingManagerState, availabilityState, contentSnapshotState, folderCleanupState, managerState, aiNamingState } from '../shared-options/state.js'
import { dom } from '../shared-options/dom.js'
import { escapeAttr, escapeHtml } from '../shared-options/html.js'
import { formatDateTime } from '../shared-options/utils.js'

let privacyAuditLog: PrivacyAuditLog = normalizePrivacyAuditLog(null)

export function normalizeOnboardingCompleted(rawState: unknown): boolean {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return false
  }
  return (rawState as { completed?: unknown }).completed === true
}

export async function completeOnboarding(): Promise<void> {
  await setLocalStorage({
    [STORAGE_KEYS.onboardingState]: {
      version: 1,
      completed: true,
      completedAt: Date.now()
    }
  })
}

export function renderOnboardingSection(onboardingCompleted: boolean): void {
  if (!dom.onboardingStatus) {
    return
  }

  const aiConfigured = hasConfiguredAiProvider(aiNamingManagerState.settings)
  const selectedFolderCount = countSelectedNewTabFolders()
  dom.onboardingStatus.textContent = onboardingCompleted
    ? '已完成或跳过引导，后续不会强制显示。你仍可随时回到这里检查配置。'
    : `待完成：${selectedFolderCount ? `已选择 ${selectedFolderCount} 个新标签页来源` : '尚未选择新标签页来源'}；${aiConfigured ? 'AI 渠道已配置' : 'AI 可稍后配置或跳过'}。`
  if (dom.onboardingComplete) {
    dom.onboardingComplete.disabled = onboardingCompleted
  }
  if (dom.onboardingSkip) {
    dom.onboardingSkip.disabled = onboardingCompleted
  }
}

export async function refreshPrivacyAuditLog(): Promise<void> {
  privacyAuditLog = await loadPrivacyAuditLog().catch(() => normalizePrivacyAuditLog(null))
}

export async function clearPrivacyAuditLogFromOptions(): Promise<void> {
  await clearPrivacyAuditLog()
  privacyAuditLog = normalizePrivacyAuditLog({
    version: 1,
    updatedAt: Date.now(),
    entries: []
  })
}

export function renderPrivacySection(): void {
  renderPermissionCards()
  renderRemoteRequestMatrix()
  renderPrivacyAuditEntries()
}

export function renderHealthCenterSection(): void {
  if (!dom.healthTotalBookmarks) {
    return
  }

  const totalBookmarks = availabilityState.allBookmarks.length
  const duplicateGroups = managerState.duplicateGroups.length
  const duplicateCandidates = managerState.duplicateGroups.reduce((sum, group) => {
    const items = Array.isArray(group?.items) ? group.items.length : 0
    return sum + Math.max(0, items - 1)
  }, 0)
  const deadlinkCandidates = availabilityState.failedResults.length + availabilityState.reviewResults.length
  const inboxCount = availabilityState.allBookmarks.filter((bookmark) => isInboxLikeBookmark(bookmark)).length
  const tagRecords = aiNamingState.tagIndex?.records || {}
  const snapshotRecords = contentSnapshotState.index?.records || {}
  const missingTags = availabilityState.allBookmarks.filter((bookmark) => {
    const record = tagRecords[String(bookmark.id)]
    return !getEffectiveBookmarkTags(record).length
  }).length
  const missingSummaries = availabilityState.allBookmarks.filter((bookmark) => {
    const tagRecord = tagRecords[String(bookmark.id)]
    const snapshotRecord = snapshotRecords[String(bookmark.id)]
    return !String(tagRecord?.summary || snapshotRecord?.summary || '').trim()
  }).length
  const folderSuggestionCount = folderCleanupState.suggestions.filter((suggestion) => (
    !folderCleanupState.executedSuggestionIds.has(String(suggestion.id))
  )).length

  dom.healthTotalBookmarks.textContent = String(totalBookmarks)
  dom.healthFolderCount.textContent = String(availabilityState.allFolders.length)
  dom.healthInboxCount.textContent = String(inboxCount)
  dom.healthDuplicateCount.textContent = String(duplicateCandidates)
  if (dom.healthDeadlinkCount) {
    dom.healthDeadlinkCount.textContent = String(deadlinkCandidates)
  }
  dom.healthMissingTagCount.textContent = String(missingTags)
  dom.healthMissingSummaryCount.textContent = String(missingSummaries)
  dom.healthFolderSuggestionCount.textContent = String(folderSuggestionCount)

  if (dom.healthActionList) {
    const actions = [
      {
        href: '#backup',
        title: '先备份再清理',
        copy: '导出完整备份；备份不会导出 API Key、Cookie 或网页正文缓存。'
      },
      {
        href: '#duplicates',
        title: '处理重复书签',
        copy: `${duplicateGroups} 组重复链接，按推荐策略预览后再移入回收站。`
      },
      {
        href: '#availability',
        title: '检查死链和重定向',
        copy: '用户主动运行，可暂停/停止，结果按高低置信和重定向分类。'
      },
      {
        href: '#folder-cleanup',
        title: '整理 Inbox 和文件夹结构',
        copy: `${folderSuggestionCount} 条文件夹建议，所有建议默认只预览。`
      },
      {
        href: '#ai',
        title: '为未标记书签生成标签',
        copy: `${missingTags} 条缺少标签；AI 可跳过，发送字段会写入本地审计日志。`
      },
      {
        href: '#recycle',
        title: '查看回收站和恢复链路',
        copy: `${managerState.recycleBin.length} 条回收站记录可恢复或清除。`
      }
    ]
    dom.healthActionList.innerHTML = actions.map((action) => `
      <a class="health-action-card" href="${escapeAttr(action.href)}" data-section-link="${escapeAttr(action.href.replace(/^#/, ''))}">
        <strong>${escapeHtml(action.title)}</strong>
        <span>${escapeHtml(action.copy)}</span>
      </a>
    `).join('')
  }
}

export function recordPrivacyAudit(input: PrivacyAuditInput, options: { isPrivacySectionActive?: () => boolean; renderPrivacy?: () => void } = {}): void {
  void appendPrivacyAuditLogEntry(input)
    .then((log) => {
      privacyAuditLog = log
      if (options.isPrivacySectionActive?.()) {
        options.renderPrivacy?.()
      }
    })
    .catch((error) => {
      console.warn('[Curator] 隐私审计日志写入失败', error)
    })
}

export function getAiPreparedItemAuditFields(preparedItems): string[] {
  const fields = new Set(['标题', 'URL', '文件夹路径', '目标域名', '已有文件夹候选'])
  for (const item of Array.isArray(preparedItems) ? preparedItems : []) {
    const pageContext = item?.requestItem?.page_context || item?.pageContext || {}
    if (pageContext.description) {
      fields.add('网页描述')
    }
    if (Array.isArray(pageContext.headings) && pageContext.headings.length) {
      fields.add('标题层级')
    }
    if (pageContext.main_text_excerpt) {
      fields.add('正文片段')
    }
    if (Array.isArray(pageContext.source_contexts) && pageContext.source_contexts.length) {
      fields.add('内容来源')
    }
  }
  return [...fields]
}

export function aiPreparedItemsIncludeBody(preparedItems): boolean {
  return (Array.isArray(preparedItems) ? preparedItems : []).some((item) => {
    const pageContext = item?.requestItem?.page_context || item?.pageContext || {}
    return Boolean(pageContext.main_text_excerpt)
  })
}

export function getSafeAuditTarget(url: unknown): string {
  try {
    const parsed = new URL(String(url || '').trim())
    return parsed.origin
  } catch {
    return String(url || '').trim().slice(0, 120) || '外部服务'
  }
}

function renderPermissionCards(): void {
  if (!dom.privacyPermissionList) {
    return
  }

  const cards = [
    {
      title: 'bookmarks',
      copy: '读取、创建、移动、更新和删除 Chrome 书签。危险操作通过预览、回收站和备份链路保护。',
      items: ['搜索和仪表盘', '重复/文件夹清理', '回收站恢复']
    },
    {
      title: 'storage',
      copy: '保存标签、索引、设置、回收站、脱敏审计日志和备份元数据。',
      items: ['API Key 只保存在本地扩展存储', '普通备份排除审计日志和正文缓存', '不使用默认远程行为遥测']
    },
    {
      title: 'optional http/https host permissions',
      copy: 'manifest 只把 http://*/* 与 https://*/* 声明为可选主机权限；链接检测、可选内容提取、用户配置 AI 服务和 Jina Reader 会在用户触发时按 origin 请求授权。',
      items: ['安装时不授予全站点访问', 'AI 关闭时不主动请求 AI 服务', 'Jina Reader 默认关闭', '网页搜索和远程背景不是主机权限理由', '敏感 URL 默认跳过']
    },
    {
      title: 'webNavigation / webRequest',
      copy: '用于死链检测、重定向证据和后台导航结果，不读取浏览历史。',
      items: ['用户主动运行检测', '可暂停或停止']
    },
    {
      title: 'notifications',
      copy: '后台任务完成或停止时显示本地通知。',
      items: ['可用性检测完成', 'AI 批量分析完成']
    }
  ]

  dom.privacyPermissionList.innerHTML = cards.map((card) => `
    <article class="privacy-permission-card">
      <strong>${escapeHtml(card.title)}</strong>
      <p>${escapeHtml(card.copy)}</p>
      <ul>${card.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </article>
  `).join('')
}

function renderRemoteRequestMatrix(): void {
  if (dom.privacyAiStatus) {
    const aiConfigured = hasConfiguredAiProvider(aiNamingManagerState.settings)
    dom.privacyAiStatus.className = `options-chip ${aiConfigured ? 'success' : 'muted'}`
    dom.privacyAiStatus.textContent = aiConfigured ? 'AI 已配置' : 'AI 未配置'
  }
  if (dom.privacyJinaStatus) {
    const jinaEnabled = Boolean(aiNamingManagerState.settings.allowRemoteParsing)
    dom.privacyJinaStatus.className = `options-chip ${jinaEnabled ? 'warning' : 'muted'}`
    dom.privacyJinaStatus.textContent = jinaEnabled ? 'Jina 已开启' : 'Jina 未开启'
  }
  if (!dom.privacyRemoteMatrix) {
    return
  }

  const rows = [
    {
      title: 'Newtab 网页搜索',
      enabled: '可关闭',
      target: '用户选择的 Google、Bing、百度、DuckDuckGo 等搜索引擎',
      fields: '搜索关键词和浏览器常规网络请求元数据',
      body: '否',
      credentials: '浏览器按搜索引擎自身登录状态处理；Curator 不代理',
      off: '在新标签页设置关闭“启用网页搜索”',
      audit: '否，Curator 不记录网页搜索 query'
    },
    {
      title: '精选远程背景',
      enabled: '默认关闭，主动选择后启用',
      target: 'NASA、The Met、Smithsonian、Rijksmuseum 图片域名或 CDN',
      fields: '图片请求、IP、User-Agent 等常规网络元数据；不包含书签数据',
      body: '否',
      credentials: '不主动附加 API Key 或 Authorization',
      off: '背景类型切回纯色、本地图片或关闭远程链接',
      audit: '否'
    },
    {
      title: '用户自定义远程背景',
      enabled: '默认关闭',
      target: '用户输入的图片 URL 所在服务',
      fields: '图片请求和网络元数据，不包含书签数据',
      body: '否',
      credentials: 'fetch 缓存请求不携带自定义凭据',
      off: '删除图片链接或切换为纯色/本地背景',
      audit: '否'
    },
    {
      title: 'AI 命名/分类',
      enabled: '默认关闭',
      target: '用户配置的 OpenAI-compatible 服务',
      fields: '标题、URL、文件夹路径、元信息、可选摘要/正文片段',
      body: '可选',
      credentials: 'Authorization 只发送给用户配置服务，不写入日志或普通备份',
      off: '关闭 AI 或不配置 API Key',
      audit: '是'
    },
    {
      title: 'Popup AI 自然语言改写',
      enabled: '默认关闭',
      target: '用户配置的 AI 服务',
      fields: '搜索查询、本地解析计划',
      body: '否',
      credentials: 'Authorization 只发送给用户配置服务，不写入日志或普通备份',
      off: '关闭自然语言搜索或 AI 渠道',
      audit: '是'
    },
    {
      title: 'Jina Reader 远程解析',
      enabled: '默认关闭',
      target: 'https://r.jina.ai/',
      fields: '目标 URL',
      body: '返回正文由设置决定是否保存/使用',
      credentials: '不发送 API Key；使用 HTTPS',
      off: '关闭 Jina Reader',
      audit: '是'
    },
    {
      title: '死链/重定向检测',
      enabled: '用户主动运行',
      target: '书签目标网站',
      fields: '被检测 URL 请求、HTTP 状态、重定向证据；日志默认只保留目标域名和状态类别',
      body: '否',
      credentials: '后台检测不主动附加 API Key；敏感 URL 默认跳过',
      off: '不运行检测或停止任务',
      audit: '是'
    }
  ]

  dom.privacyRemoteMatrix.innerHTML = rows.map((row) => `
    <article class="privacy-matrix-card">
      <strong>${escapeHtml(row.title)}</strong>
      <p>默认启用：${escapeHtml(row.enabled)}</p>
      <ul>
        <li>发送到：${escapeHtml(row.target)}</li>
        <li>可能发送字段：${escapeHtml(row.fields)}</li>
        <li>是否含正文：${escapeHtml(row.body)}</li>
        <li>凭据：${escapeHtml(row.credentials)}</li>
        <li>关闭方式：${escapeHtml(row.off)}</li>
        <li>审计日志：${escapeHtml(row.audit)}</li>
      </ul>
    </article>
  `).join('')
}

function renderPrivacyAuditEntries(): void {
  if (!dom.privacyAuditLog) {
    return
  }
  const entries = privacyAuditLog.entries.slice(0, 12)
  if (!entries.length) {
    dom.privacyAuditLog.innerHTML = '<div class="detect-empty">暂无外部请求记录。</div>'
    if (dom.privacyClearAudit) {
      dom.privacyClearAudit.disabled = true
    }
    return
  }
  if (dom.privacyClearAudit) {
    dom.privacyClearAudit.disabled = false
  }
  dom.privacyAuditLog.innerHTML = entries.map((entry) => `
    <article class="detect-result-card privacy-audit-card">
      <div class="detect-result-main">
        <strong>${escapeHtml(entry.label)}</strong>
        <p>${escapeHtml(entry.reason || '任务已记录。')}</p>
      </div>
      <div class="privacy-audit-meta">
        <span>${escapeHtml(formatDateTime(entry.createdAt))}</span>
        <span>${escapeHtml(entry.targetDomain || entry.target)}</span>
        <span>${entry.itemCount} 条</span>
        <span>${entry.includesBody ? '可能含正文' : '不含正文'}</span>
        <span>${escapeHtml(entry.status)}</span>
      </div>
      <p class="detect-results-subtitle">字段：${escapeHtml(entry.fields.join('、') || '未记录')}</p>
    </article>
  `).join('')
}

function hasConfiguredAiProvider(settings): boolean {
  return Boolean(settings?.baseUrl && settings?.apiKey && settings?.model)
}

function countSelectedNewTabFolders(): number {
  return Math.max(0, availabilityState.allFolders.filter((folder) => {
    const title = normalizeText(folder?.title || '')
    return title === normalizeText('Inbox / 待整理') || title === normalizeText('Speed Dial')
  }).length)
}

function isInboxLikeBookmark(bookmark): boolean {
  const path = normalizeText(bookmark?.path || '')
  return /(^|[>/|›»])\s*(inbox|待整理|未分类|收件箱|临时收藏|稍后整理)\s*($|[>/|›»])/i.test(path)
}
