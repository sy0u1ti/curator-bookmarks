import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger,
  Icon,
  ThemeProvider
} from '../ui'
import { BookmarkHistoryPanel } from './components/BookmarkHistoryPanel'
import { AiAnalysisPanel, AvailabilityPanel, GeneralPanel } from './components/CorePanels'
import { DashboardPanel } from './components/DashboardPanel'
import { OptionsModals } from './components/OptionsModals'
import {
  BackupPanel,
  DuplicatesPanel,
  FolderCleanupPanel,
  HistoryPanel,
  IgnoreRulesPanel,
  RecyclePanel,
  RedirectsPanel,
  TagManagementPanel
} from './components/TaskPanels'

interface NavLink {
  section: string
  href: string
  label: string
  className?: string
}

interface NavGroup {
  labelId: string
  label: string
  links?: NavLink[]
  collapsible?: {
    key: string
    trigger: string
    panelId: string
    links: NavLink[]
  }
  trailingLinks?: NavLink[]
}

const settingsLinks: NavLink[] = [
  { section: 'general', href: '#general', label: '通用设置' },
  { section: 'backup', href: '#backup', label: '数据与备份' }
]

const availabilityLinks: NavLink[] = [
  { section: 'availability', href: '#availability', label: '书签可用性检测', className: 'options-nav-subitem' },
  { section: 'history', href: '#history', label: '检测历史', className: 'options-nav-subitem' },
  { section: 'redirects', href: '#redirects', label: '重定向更新', className: 'options-nav-subitem' },
  { section: 'ignore', href: '#ignore', label: '忽略规则', className: 'options-nav-subitem' }
]

const bookmarkLinks: NavLink[] = [
  { section: 'duplicates', href: '#duplicates', label: '重复书签检测' },
  { section: 'folder-cleanup', href: '#folder-cleanup', label: '文件夹清理' },
  { section: 'recycle', href: '#recycle', label: '回收站' }
]

const aiLinks: NavLink[] = [
  { section: 'ai', href: '#ai', label: '书签智能分析' },
  { section: 'tags', href: '#tags', label: '标签管理中心' },
  { section: 'bookmark-history', href: '#bookmark-history', label: '自动分析添加历史' }
]

const availabilitySectionKeys = new Set(availabilityLinks.map((link) => link.section))

const overviewMetrics = [
  {
    className: 'metric-total',
    label: '书签总数',
    valueId: 'overview-total-bookmarks',
    initialValue: '读取中'
  },
  {
    className: 'metric-info',
    label: '可检测链接',
    valueId: 'overview-checkable-bookmarks',
    initialValue: '读取中'
  },
  {
    className: 'metric-warning',
    label: '待处理问题',
    valueId: 'overview-issue-count',
    initialValue: '0'
  },
  {
    className: 'metric-success',
    label: '回收站',
    valueId: 'overview-recycle-count',
    initialValue: '0'
  }
]

const overviewTasks = [
  {
    href: '#availability',
    section: 'availability',
    chip: '发现问题',
    title: '先检测可用性',
    copy: '申请范围权限后检测链接；异常项先进入复核列表，不自动修改。'
  },
  {
    href: '#duplicates',
    section: 'duplicates',
    chip: '整理与清理',
    title: '预览重复书签',
    copy: '按策略选择候选，删除前确认并移入回收站。'
  },
  {
    href: '#backup',
    section: 'backup',
    chip: '恢复与备份',
    title: '导出本地备份',
    copy: '重要清理前保留快照，恢复前先预览影响范围。'
  },
  {
    href: '#ai',
    section: 'ai',
    chip: '智能增强',
    title: '配置后再运行 AI',
    copy: '未配置 API Key 时不会启动必然失败的 AI 批处理。'
  }
]

const navGroups: NavGroup[] = [
  {
    labelId: 'options-settings-nav-label',
    label: '设置分类',
    links: settingsLinks
  },
  {
    labelId: 'options-bookmark-nav-label',
    label: '书签管理',
    collapsible: {
      key: 'availability-tools',
      trigger: '可用性管理',
      panelId: 'availability-tools-nav',
      links: availabilityLinks
    },
    trailingLinks: bookmarkLinks
  },
  {
    labelId: 'options-ai-nav-label',
    label: 'AI功能',
    links: aiLinks
  }
]

function getSectionKeyFromLocation() {
  if (new URLSearchParams(window.location.search).get('embed') === 'newtab-dashboard') {
    return 'dashboard'
  }

  const key = window.location.hash.replace(/^#/, '').split(':')[0]
  return key || 'overview'
}

function getSectionKeyFromLink(link: HTMLAnchorElement) {
  const rawKey = link.getAttribute('data-section-link') || ''
  if (rawKey) {
    return rawKey
  }

  const targetUrl = new URL(link.href, window.location.href)
  return targetUrl.hash.replace(/^#/, '').split(':')[0]
}

function OptionsNavLink({ href, section, label, className }: NavLink) {
  return (
    <a
      className={['options-nav-link', className].filter(Boolean).join(' ')}
      href={href}
      data-section-link={section}
    >
      {label}
    </a>
  )
}

function OptionsHeader() {
  return (
    <header className="options-header">
      <a className="options-brand" href="#overview" data-section-link="overview" aria-label="跳转到概览">
        <span className="options-brand-mark" aria-hidden="true">
          <img src="../assets/icon128.png" alt="" />
        </span>
        <span className="options-brand-copy">
          <span className="options-brand-eyebrow">Chrome Bookmark Manager</span>
          <strong>Curator Bookmark</strong>
        </span>
      </a>
    </header>
  )
}

function OptionsSidebar() {
  const [availabilityOpen, setAvailabilityOpen] = useState(() =>
    availabilitySectionKeys.has(getSectionKeyFromLocation())
  )

  useEffect(() => {
    function handleHashChange() {
      syncAvailabilityGroupOpen()
    }

    function handlePopState() {
      syncAvailabilityGroupOpen()
    }

    function syncAvailabilityGroupOpen(nextSectionKey = getSectionKeyFromLocation()) {
      if (availabilitySectionKeys.has(nextSectionKey)) {
        setAvailabilityOpen(true)
      }
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) {
        return
      }

      const link = event.target.closest('a[data-section-link]')
      if (!(link instanceof HTMLAnchorElement)) {
        return
      }

      syncAvailabilityGroupOpen(getSectionKeyFromLink(link))
    }

    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', handlePopState)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [])

  return (
    <aside className="options-sidebar" aria-label="设置导航">
      {navGroups.map((group) => (
        <div className="options-nav-group" key={group.labelId}>
          <p id={group.labelId} className="options-sidebar-label">
            {group.label}
          </p>
          <nav className="options-nav" aria-labelledby={group.labelId}>
            {group.links?.map((link) => <OptionsNavLink key={link.section} {...link} />)}
            {group.collapsible ? (
              <CollapsibleRoot
                className="options-nav-collapsible"
                data-nav-group={group.collapsible.key}
                open={availabilityOpen}
                onOpenChange={setAvailabilityOpen}
              >
                <CollapsibleTrigger
                  className="options-nav-group-trigger"
                  type="button"
                  aria-controls={group.collapsible.panelId}
                  data-nav-group-trigger={group.collapsible.key}
                >
                  <span>{group.collapsible.trigger}</span>
                  <span className="options-nav-group-caret" aria-hidden="true">
                    <Icon name="ChevronDown" size={14} />
                  </span>
                </CollapsibleTrigger>
                <CollapsiblePanel
                  id={group.collapsible.panelId}
                  className="options-nav-sublist"
                  data-nav-group-panel={group.collapsible.key}
                >
                  {group.collapsible.links.map((link) => <OptionsNavLink key={link.section} {...link} />)}
                </CollapsiblePanel>
              </CollapsibleRoot>
            ) : null}
            {group.trailingLinks?.map((link) => <OptionsNavLink key={link.section} {...link} />)}
          </nav>
        </div>
      ))}
      <a className="options-dashboard-entry" href="#dashboard" data-section-link="dashboard">
        <span>视觉化管理</span>
        <strong>书签仪表盘</strong>
      </a>
    </aside>
  )
}

function OptionsOverviewPanel() {
  return (
    <section
      id="overview"
      className="options-panel"
      data-section-panel="overview"
      aria-labelledby="overview-title"
      hidden
    >
      <p className="options-section-label">Overview</p>
      <h1 id="overview-title">概览</h1>
      <p className="options-description">
        先看当前书签状态，再选择发现、清理、恢复或智能增强任务。所有会修改书签树的操作都走预览、确认、自动备份和回收站路径。
      </p>

      <div className="options-overview-hero">
        <div>
          <Badge className="options-chip muted">建议下一步</Badge>
          <strong id="overview-next-step-title">正在读取书签目录</strong>
          <p id="overview-next-step-copy">读取完成后这里会显示建议下一步和当前影响范围。</p>
        </div>
        <Button
          className="options-button small"
          size="sm"
          render={<a href="#availability" data-section-link="availability" />}
        >
          开始可用性检测
        </Button>
      </div>

      <div className="detect-summary-grid compact-grid options-overview-metrics">
        {overviewMetrics.map((metric) => (
          <Card
            className={`summary-card compact metric-card ${metric.className}`}
            key={metric.valueId}
          >
            <span className="summary-label">{metric.label}</span>
            <strong id={metric.valueId}>{metric.initialValue}</strong>
          </Card>
        ))}
      </div>

      <div className="options-overview-grid">
        {overviewTasks.map((task) => (
          <a
            className="options-overview-task"
            href={task.href}
            data-section-link={task.section}
            key={task.section}
          >
            <Badge className="options-chip muted">{task.chip}</Badge>
            <strong>{task.title}</strong>
            <p>{task.copy}</p>
          </a>
        ))}
      </div>
    </section>
  )
}

export function OptionsApp() {
  useEffect(() => {
    let disposed = false

    void import('./options-runtime.js').then(({ startOptionsRuntime }) => {
      if (!disposed) {
        void startOptionsRuntime()
      }
    })

    return () => {
      disposed = true
    }
  }, [])

  return (
    <ThemeProvider>
      <div className="options-shell">
        <OptionsHeader />
        <div className="options-layout">
          <OptionsSidebar />
          <main className="options-main">
            <OptionsOverviewPanel />
            <DashboardPanel />
            <GeneralPanel />
            <AvailabilityPanel />
            <HistoryPanel />
            <AiAnalysisPanel />
            <BookmarkHistoryPanel />
            <BackupPanel />
            <TagManagementPanel />
            <RedirectsPanel />
            <DuplicatesPanel />
            <FolderCleanupPanel />
            <IgnoreRulesPanel />
            <RecyclePanel />
          </main>
        </div>
      </div>
      <OptionsModals />
    </ThemeProvider>
  )
}
