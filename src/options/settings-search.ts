import { SECTION_META } from './shared-options/constants'
import type { OptionsSectionKey } from './options-section-store'

export interface SettingsSearchItem {
  id: string
  label: string
  section: OptionsSectionKey
  anchor: string
  targetId: string
  keywords: string
}

const setting = (
  section: OptionsSectionKey, anchor: string, label: string, targetId: string, keywords = ''
): SettingsSearchItem => ({ id: `${section}:${anchor}`, section, anchor, label, targetId, keywords })

// Only public setting names and destinations belong in this index. Never index
// saved values (especially provider keys), or execute the control on selection.
export const SETTINGS_SEARCH_ITEMS: readonly SettingsSearchItem[] = [
  setting('general', 'auto-analyze', '自动分析', 'settings-autoAnalyzeBookmarks', '新增书签 标签 自动整理 auto analyze'),
  setting('general', 'remote-parsing', '网页内容辅助解析', 'settings-allowRemoteParsing', 'Jina Reader 第三方 授权 远程解析'),
  setting('general', 'inbox-workflow', '待整理方式', 'settings-inbox-workflow', 'Inbox 快捷键 保存 收藏 移动 标签 建议 手动'),
  setting('general', 'input-caret', '动态输入光标', 'settings-input-caret', '输入框 光标 动画 动效 系统光标 caret cursor animation'),
  setting('general', 'content-index', '保存网页内容索引', 'settings-content-index', '全文 搜索 摘要 本地 离线 index'),
  setting('general', 'full-text', '保存完整正文', 'settings-full-text', '全文 搜索 本地 离线 full text'),
  setting('general', 'shortcuts', '快捷键', 'settings-shortcuts', '键盘 绑定 shortcut keyboard'),
  setting('ai-settings', 'provider', 'AI 服务配置', 'ai-provider-settings', '模型 服务商 渠道 provider 人工智能'),
  setting('ai-settings', 'base-url', 'AI 服务地址', 'ai-base-url', 'Base URL 接口 域名 本机 localhost'),
  setting('ai-settings', 'api-key', 'API Key', 'ai-api-key', 'AI 密钥 令牌 token key'),
  setting('ai-settings', 'model', 'AI 模型', 'settings-ai-model', '推理强度 模型列表 自定义 models reasoning'),
  setting('ai-settings', 'requests', '接口与请求设置', 'ai-advanced-settings', '每批 并发 接口类型 请求数 batch api style'),
  setting('backup', 'full-backup', '完整备份', 'settings-full-backup', '导出 导入 恢复 数据 迁移 backup restore'),
  setting('backup', 'tag-data', '标签数据', 'settings-tag-data', '摘要 别名 导出 导入 清空 tags'),
  setting('backup', 'recovery', '自动恢复点', 'settings-recovery-points', '备份 撤销 回滚 恢复 snapshots rollback'),
  setting('backup', 'storage', '本地存储空间', 'settings-storage', '缓存 清理 图标 正文 用量 storage cache'),
  setting('availability', 'settings', '检测设置', 'settings-availability', '并发数 超时时长 站点权限 检测 timeout concurrency'),
  ...Object.entries(SECTION_META).filter(([key]) => key !== 'ai-settings').map(([key, { title }]) =>
    setting(key as OptionsSectionKey, 'section', title, `${key}-title`, ({
      general: '设置 settings',
      backup: '导入 导出 数据 backup',
      availability: '死链 失效 链接 检测',
      duplicates: '重复 去重 duplicates',
      recycle: '恢复 删除 回收站 trash',
      ignore: '白名单 跳过 域名 ignore',
      redirects: '网址 重定向 301 302 redirect',
      inbox: '待整理 收藏 inbox',
      ai: '智能 分类 命名 摘要 tags',
      'bookmark-history': 'AI 整理 历史 记录',
      history: '检测 历史 记录',
      'ai-settings': 'AI 模型 服务'
    } as Record<string, string>)[key] || '')
  )
]

const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const indexed = SETTINGS_SEARCH_ITEMS.map(item => ({
  item,
  label: normalize(item.label),
  text: normalize(`${item.label} ${item.keywords} ${SECTION_META[item.section].title}`)
}))

export function searchSettings(query: string): SettingsSearchItem[] {
  const normalized = normalize(query)
  if (!normalized) return []
  const terms = normalized.split(/\s+/)
  return indexed
    .filter(entry => terms.every(term => entry.text.includes(term)))
    .map(entry => ({
      ...entry,
      rank: (entry.label === normalized ? 0 : entry.label.startsWith(normalized) ? 1 : entry.label.includes(normalized) ? 2 : 3) +
        (entry.item.anchor === 'section' ? 0.5 : 0)
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 12)
    .map(entry => entry.item)
}

export function resolveSettingsSearchTarget(section: OptionsSectionKey, anchor: string): SettingsSearchItem | undefined {
  return SETTINGS_SEARCH_ITEMS.find(item => item.section === section && item.anchor === anchor)
}
