import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent
} from 'react'
import {
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger
} from '../ui/base/Collapsible'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { BookmarkHistoryPanel } from './components/BookmarkHistoryPanel'
import { AiAnalysisPanel, AvailabilityPanel, GeneralPanel } from './components/CorePanels'
import { DashboardPanel } from './components/DashboardPanel'
import { OptionsModals } from './components/OptionsModals'
import { subscribeToDashboardViewReady } from './components/dashboard-view-ready-store'
import { useOptionsOverview } from './components/options-overview-store'
import {
  getOptionsSectionNavigationFromLink,
  type OptionsSectionKey
} from './options-section-store'
import {
  handleOptionsBookmarkTreeChanged,
  handleOptionsDashboardViewReady,
  handleOptionsWindowMessage,
  handleOptionsWindowSectionChange,
  useOptionsController
} from './options-controller'
import {
  OPTION_PANEL_CLASS,
  OPTION_PANEL_DESCRIPTION_CLASS,
  OPTION_PANEL_TITLE_CLASS,
  OPTION_SECTION_LABEL_CLASS
} from './components/option-layout-classes'
import {
  navClass,
  navCollapsibleClass,
  navGroupClass,
  navGroupTriggerClass,
  navLinkClass,
  navSubitemClass,
  navSublistClass,
  optionsBrandClassBase,
  optionsBrandCopyClass,
  optionsBrandMarkClass,
  optionsBrandMarkImageClass,
  optionsDashboardEntryClass,
  optionsDashboardEntryEyebrowClass,
  optionsDashboardEntryTitleClass,
  optionsHeaderClass,
  optionsLayoutClass,
  optionsMainClass,
  optionsShellClassBase,
  optionsSidebarClass,
  optionsSidebarDividerClass,
  optionsSidebarLabelClass
} from './components/options-chrome-classes'
import { useOptionsSectionChrome } from './useOptionsSectionChrome'
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
  variant?: 'subitem'
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
  { section: 'availability', href: '#availability', label: '书签可用性检测', variant: 'subitem' },
  { section: 'history', href: '#history', label: '检测历史', variant: 'subitem' },
  { section: 'redirects', href: '#redirects', label: '重定向更新', variant: 'subitem' },
  { section: 'ignore', href: '#ignore', label: '忽略规则', variant: 'subitem' }
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
    label: '书签总数',
    stateKey: 'totalBookmarks',
    tone: 'total'
  },
  {
    label: '可检测链接',
    stateKey: 'checkableBookmarks',
    tone: 'info'
  },
  {
    label: '待处理问题',
    stateKey: 'issueCount',
    tone: 'warning'
  },
  {
    label: '回收站',
    stateKey: 'recycleCount',
    tone: 'success'
  }
] as const

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

const overviewHeroClass = [
  'mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[18px]',
  'rounded-[var(--ui-radius-group)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] p-[18px_20px]',
  'max-[760px]:grid-cols-1'
].join(' ')
const overviewBadgeClass =
  'inline-flex min-h-6 w-fit items-center justify-center rounded-full border border-[var(--ui-surface-hover)] bg-[rgba(255,255,255,0.055)] px-2.5 text-[11px] font-semibold leading-none tracking-[0] text-[var(--ui-text-tertiary)]'
const overviewHeroTitleClass =
  'mt-2.5 block text-xl leading-[1.25] text-[var(--ui-text-primary)]'
const overviewCopyClass =
  'mt-2 text-[13px] leading-[1.55] text-[var(--ui-text-tertiary)]'
const overviewPrimaryLinkClass =
  'inline-flex min-h-[34px] flex-none items-center justify-center rounded-[var(--ui-radius-control)] border border-[rgba(218,218,211,0.88)] bg-[#d4d4cf] px-3 text-[13px] font-bold leading-none text-[#050505] no-underline shadow-[inset_0_-1px_0_rgba(0,0,0,0.16)] transition-[background,border-color,color,transform,opacity] hover:border-white hover:bg-white focus-visible:border-white focus-visible:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(245,245,247,0.72)] active:scale-[0.985] max-[760px]:w-full'
const overviewMetricsClass =
  'mt-5 grid grid-cols-4 gap-3 max-[1180px]:grid-cols-3 max-[760px]:grid-cols-1'
const overviewMetricCardClass =
  'relative min-w-0 overflow-hidden rounded-[var(--ui-radius-group)] border border-[var(--ui-divider-subtle)] bg-[#050505] p-[14px_16px] text-[var(--ui-text-primary)] shadow-none transition-colors before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""] hover:border-[var(--ui-divider)] hover:bg-[#080808]'
const overviewMetricAccentClass = {
  info: 'before:bg-[rgba(141,181,255,0.62)]',
  success: 'before:bg-[rgba(189,243,202,0.72)]',
  total: 'before:bg-[rgba(245,245,247,0.4)]',
  warning: 'before:bg-[rgba(255,220,165,0.72)]'
} as const
const overviewMetricLabelClass =
  'block text-[11px] font-semibold uppercase leading-normal tracking-[0] text-[var(--ui-text-disabled)]'
const overviewMetricValueClass =
  'mt-2 block text-2xl font-[650] leading-none tracking-[0] text-[var(--ui-text-primary)]'
const overviewTaskGridClass =
  'mt-[18px] grid grid-cols-2 gap-3 max-[760px]:grid-cols-1'
const overviewTaskClass = [
  'grid min-w-0 gap-2 rounded-[var(--ui-radius-group)] border border-[var(--ui-divider)] bg-[var(--ui-surface)] p-4',
  'text-inherit no-underline outline-none',
  'hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)]',
  'focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)]'
].join(' ')
const overviewTaskTitleClass = 'text-[15px] leading-[1.3] text-[var(--ui-text-primary)]'

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

type SectionLinkClickHandler = (event: MouseEvent<HTMLAnchorElement>) => void

function OptionsNavLink({
  href,
  section,
  label,
  variant,
  activeSectionKey,
  onNavigate
}: NavLink & {
  activeSectionKey: OptionsSectionKey
  onNavigate: SectionLinkClickHandler
}) {
  const active = activeSectionKey === section
  const className = variant === 'subitem' ? navSubitemClass : ''

  return (
    <a
      className={[navLinkClass, className].filter(Boolean).join(' ')}
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >
      {label}
    </a>
  )
}

function OptionsHeader({
  activeSectionKey,
  hidden,
  onNavigate
}: {
  activeSectionKey: OptionsSectionKey
  hidden: boolean
  onNavigate: SectionLinkClickHandler
}) {
  const active = activeSectionKey === 'overview'

  return (
    <header className={optionsHeaderClass} hidden={hidden}>
      <a
        className={optionsBrandClassBase}
        href="#overview"
        aria-label="跳转到概览"
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        <span className={optionsBrandMarkClass} aria-hidden="true">
          <img className={optionsBrandMarkImageClass} src="../assets/icon128.png" alt="" />
        </span>
        <span className={optionsBrandCopyClass}>
          <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0] text-[var(--ui-text-disabled)]">
            Chrome Bookmark Manager
          </span>
          <strong className="block whitespace-nowrap text-[17px] font-[650] leading-none tracking-[0] text-[var(--ui-text-primary)] max-[760px]:text-[20px]">
            Curator Bookmark
          </strong>
        </span>
      </a>
    </header>
  )
}

function OptionsSidebar({
  activeSectionKey,
  hidden,
  onNavigate
}: {
  activeSectionKey: OptionsSectionKey
  hidden: boolean
  onNavigate: SectionLinkClickHandler
}) {
  const [availabilityManuallyOpen, setAvailabilityManuallyOpen] = useState(false)
  const availabilityOpen = availabilitySectionKeys.has(activeSectionKey) || availabilityManuallyOpen
  const dashboardActive = activeSectionKey === 'dashboard'

  return (
    <aside className={optionsSidebarClass} aria-label="设置导航" hidden={hidden}>
      {navGroups.map((group, groupIndex) => (
        <div
          className={[navGroupClass, groupIndex > 0 ? 'mt-[18px]' : ''].filter(Boolean).join(' ')}
          key={group.labelId}
        >
          <p id={group.labelId} className={optionsSidebarLabelClass}>
            {group.label}
          </p>
          <nav className={navClass} aria-labelledby={group.labelId}>
            {group.links?.map((link) => (
              <OptionsNavLink
                key={link.section}
                activeSectionKey={activeSectionKey}
                onNavigate={onNavigate}
                {...link}
              />
            ))}
            {group.collapsible ? (
              <CollapsibleRoot
                className={navCollapsibleClass}
                open={availabilityOpen}
                onOpenChange={setAvailabilityManuallyOpen}
              >
                <CollapsibleTrigger
                  className={navGroupTriggerClass}
                  type="button"
                  aria-controls={group.collapsible.panelId}
                >
                  <span>{group.collapsible.trigger}</span>
                </CollapsibleTrigger>
                <CollapsiblePanel
                  id={group.collapsible.panelId}
                  className={navSublistClass}
                >
                  {group.collapsible.links.map((link) => (
                    <OptionsNavLink
                      key={link.section}
                      activeSectionKey={activeSectionKey}
                      onNavigate={onNavigate}
                      {...link}
                    />
                  ))}
                </CollapsiblePanel>
              </CollapsibleRoot>
            ) : null}
            {group.trailingLinks?.map((link) => (
              <OptionsNavLink
                key={link.section}
                activeSectionKey={activeSectionKey}
                onNavigate={onNavigate}
                {...link}
              />
            ))}
          </nav>
        </div>
      ))}
      <a
        className={optionsDashboardEntryClass}
        href="#dashboard"
        aria-current={dashboardActive ? 'page' : undefined}
        onClick={onNavigate}
      >
        <span className={optionsDashboardEntryEyebrowClass}>视觉化管理</span>
        <strong className={optionsDashboardEntryTitleClass}>书签仪表盘</strong>
      </a>
    </aside>
  )
}

function OptionsOverviewPanel({
  hidden,
  onNavigate
}: {
  hidden: boolean
  onNavigate: SectionLinkClickHandler
}) {
  const overview = useOptionsOverview()

  return (
    <section
      id="overview"
      className={OPTION_PANEL_CLASS}
      aria-labelledby="overview-title"
      hidden={hidden}
    >
      <p className={OPTION_SECTION_LABEL_CLASS}>Overview</p>
      <h1 id="overview-title" className={OPTION_PANEL_TITLE_CLASS}>概览</h1>
      <p className={OPTION_PANEL_DESCRIPTION_CLASS}>
        先看当前书签状态，再选择发现、清理、恢复或智能增强任务。所有会修改书签树的操作都走预览、确认、自动备份和回收站路径。
      </p>

      <div className={overviewHeroClass}>
        <div>
          <span className={overviewBadgeClass}>建议下一步</span>
          <strong className={overviewHeroTitleClass}>
            {overview.nextStepTitle}
          </strong>
          <p className={overviewCopyClass}>
            {overview.nextStepCopy}
          </p>
        </div>
        <a
          className={overviewPrimaryLinkClass}
          href="#availability"
          onClick={onNavigate}
        >
          开始可用性检测
        </a>
      </div>

      <div className={overviewMetricsClass}>
        {overviewMetrics.map((metric) => (
          <article
            className={`${overviewMetricCardClass} ${overviewMetricAccentClass[metric.tone]}`}
            key={metric.stateKey}
          >
            <span className={overviewMetricLabelClass}>{metric.label}</span>
            <strong className={overviewMetricValueClass}>
              {overview.metrics[metric.stateKey]}
            </strong>
          </article>
        ))}
      </div>

      <div className={overviewTaskGridClass}>
        {overviewTasks.map((task) => (
          <a
            className={overviewTaskClass}
            href={task.href}
            key={task.section}
            onClick={onNavigate}
          >
            <span className={overviewBadgeClass}>{task.chip}</span>
            <strong className={overviewTaskTitleClass}>{task.title}</strong>
            <p className={overviewCopyClass}>{task.copy}</p>
          </a>
        ))}
      </div>
    </section>
  )
}

export function OptionsApp() {
  useOptionsController()
  const {
    sectionAnchor,
    sectionKey,
    sectionRevision,
    isDashboardActive,
    isDashboardEmbed,
    navigateToSectionHash
  } = useOptionsSectionChrome({ onSectionChange: handleOptionsWindowSectionChange })
  const optionsShellRef = useRef<HTMLDivElement | null>(null)
  const optionsMainRef = useRef<HTMLElement | null>(null)
  const aiProviderAnchorRef = useRef<HTMLDivElement | null>(null)
  const [aiProviderAttentionRequestId, setAiProviderAttentionRequestId] = useState(0)
  const shellClassName = [
    optionsShellClassBase,
    isDashboardActive ? 'dashboard-fullscreen-active' : '',
    isDashboardEmbed ? 'options-dashboard-embed' : ''
  ].filter(Boolean).join(' ')

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) {
      return
    }

    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    const body = document.body
    const previousRootBackground = root.style.background
    const previousBodyBackground = body.style.background
    if (isDashboardEmbed) {
      root.style.background = 'transparent'
      body.style.background = 'transparent'
    }
    return () => {
      root.style.background = previousRootBackground
      body.style.background = previousBodyBackground
    }
  }, [isDashboardEmbed])

  useEffect(() => {
    const bookmarks = typeof chrome === 'undefined' ? null : chrome.bookmarks

    bookmarks?.onCreated?.addListener(handleOptionsBookmarkTreeChanged)
    bookmarks?.onRemoved?.addListener(handleOptionsBookmarkTreeChanged)
    bookmarks?.onChanged?.addListener(handleOptionsBookmarkTreeChanged)
    bookmarks?.onMoved?.addListener(handleOptionsBookmarkTreeChanged)
    bookmarks?.onChildrenReordered?.addListener(handleOptionsBookmarkTreeChanged)
    bookmarks?.onImportEnded?.addListener(handleOptionsBookmarkTreeChanged)
    return () => {
      bookmarks?.onCreated?.removeListener(handleOptionsBookmarkTreeChanged)
      bookmarks?.onRemoved?.removeListener(handleOptionsBookmarkTreeChanged)
      bookmarks?.onChanged?.removeListener(handleOptionsBookmarkTreeChanged)
      bookmarks?.onMoved?.removeListener(handleOptionsBookmarkTreeChanged)
      bookmarks?.onChildrenReordered?.removeListener(handleOptionsBookmarkTreeChanged)
      bookmarks?.onImportEnded?.removeListener(handleOptionsBookmarkTreeChanged)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', handleOptionsWindowMessage)
    const unsubscribeFromDashboardViewReady = subscribeToDashboardViewReady(handleOptionsDashboardViewReady)
    return () => {
      window.removeEventListener('message', handleOptionsWindowMessage)
      unsubscribeFromDashboardViewReady()
    }
  }, [])

  const requestAiProviderAnchorAttention = useCallback(() => {
    if (sectionKey !== 'general' || sectionAnchor !== 'ai-provider') {
      return
    }

    const target = aiProviderAnchorRef.current
    if (!target) {
      return
    }

    window.requestAnimationFrame(() => {
      if (aiProviderAnchorRef.current !== target) {
        return
      }

      const scrollHost = optionsMainRef.current
      if (scrollHost && scrollHost.scrollHeight > scrollHost.clientHeight) {
        const hostRect = scrollHost.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        const top = scrollHost.scrollTop + targetRect.top - hostRect.top - 24
        scrollHost.scrollTo({
          top: Math.max(0, Math.min(top, scrollHost.scrollHeight - scrollHost.clientHeight)),
          behavior: 'smooth'
        })
      } else {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
      setAiProviderAttentionRequestId((requestId) => requestId + 1)
    })
  }, [sectionAnchor, sectionKey])

  const handleAiProviderAnchorRef = useCallback((node: HTMLDivElement | null) => {
    aiProviderAnchorRef.current = node
    if (node) {
      window.requestAnimationFrame(requestAiProviderAnchorAttention)
    }
  }, [requestAiProviderAnchorAttention])

  useEffect(() => {
    requestAiProviderAnchorAttention()
  }, [requestAiProviderAnchorAttention, sectionRevision])

  useEffect(() => {
    if (sectionAnchor) {
      return
    }

    let secondFrame = 0
    const scrollTop = () => {
      optionsMainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      optionsShellRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    scrollTop()
    const firstFrame = window.requestAnimationFrame(() => {
      scrollTop()
      secondFrame = window.requestAnimationFrame(scrollTop)
    })
    const timeout = window.setTimeout(scrollTop, 0)
    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame)
      }
      window.clearTimeout(timeout)
    }
  }, [sectionAnchor, sectionRevision])

  const handleSectionNavigationClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }

    const navigation = getOptionsSectionNavigationFromLink(event.currentTarget)
    if (!navigation) {
      return
    }

    event.preventDefault()
    navigateToSectionHash(navigation.hash)
  }

  return (
    <ThemeProvider>
      <div className={shellClassName} ref={optionsShellRef}>
        <div className={optionsSidebarDividerClass} aria-hidden="true" hidden={isDashboardActive}></div>
        <OptionsHeader activeSectionKey={sectionKey} hidden={isDashboardActive} onNavigate={handleSectionNavigationClick} />
        <div className={optionsLayoutClass}>
          <OptionsSidebar activeSectionKey={sectionKey} hidden={isDashboardActive} onNavigate={handleSectionNavigationClick} />
          <main className={optionsMainClass} ref={optionsMainRef}>
            <OptionsOverviewPanel hidden={sectionKey !== 'overview'} onNavigate={handleSectionNavigationClick} />
            <DashboardPanel hidden={sectionKey !== 'dashboard'} />
            <GeneralPanel
              aiProviderAnchorRef={handleAiProviderAnchorRef}
              aiProviderAttentionRequestId={aiProviderAttentionRequestId}
              hidden={sectionKey !== 'general'}
            />
            <AvailabilityPanel hidden={sectionKey !== 'availability'} />
            <HistoryPanel hidden={sectionKey !== 'history'} />
            <AiAnalysisPanel hidden={sectionKey !== 'ai'} />
            <BookmarkHistoryPanel hidden={sectionKey !== 'bookmark-history'} />
            <BackupPanel hidden={sectionKey !== 'backup'} />
            <TagManagementPanel hidden={sectionKey !== 'tags'} />
            <RedirectsPanel hidden={sectionKey !== 'redirects'} />
            <DuplicatesPanel hidden={sectionKey !== 'duplicates'} />
            <FolderCleanupPanel hidden={sectionKey !== 'folder-cleanup'} />
            <IgnoreRulesPanel hidden={sectionKey !== 'ignore'} />
            <RecyclePanel hidden={sectionKey !== 'recycle'} />
          </main>
        </div>
      </div>
      <OptionsModals />
    </ThemeProvider>
  )
}
