import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent
} from 'react'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../ui/base/Collapsible'
import { Icon } from '../ui/icons/Icon'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { BookmarkHistoryPanel } from './components/BookmarkHistoryPanel'
import { AiAnalysisPanel, AvailabilityPanel, GeneralPanel } from './components/CorePanels'
import { DashboardPanel } from './components/DashboardPanel'
import { OptionsModals } from './components/OptionsModals'
import { subscribeToDashboardViewReady } from './components/dashboard-view-ready-store'
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
  RedirectsPanel
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
  { section: 'bookmark-history', href: '#bookmark-history', label: 'AI 整理记录' }
]

const availabilitySectionKeys = new Set(availabilityLinks.map((link) => link.section))

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
  const active = activeSectionKey === 'general'

  return (
    <header className={optionsHeaderClass} hidden={hidden}>
      <a
        className={optionsBrandClassBase}
        href="#general"
        aria-label="跳转到通用设置"
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        <span className={optionsBrandMarkClass} aria-hidden="true">
          <img className={optionsBrandMarkImageClass} src="../assets/icon128.png" alt="" />
        </span>
        <span className={optionsBrandCopyClass}>
          <span className="truncate whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0] text-ds-text-disabled">
            Chrome Bookmark Manager
          </span>
          <strong className="block truncate whitespace-nowrap text-[17px] font-[650] leading-none tracking-[0] text-ds-text-primary max-[760px]:text-[20px]">
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
                  <span className="t-acc-chevron text-ds-text-disabled" aria-hidden="true">
                    <Icon name="ChevronDown" size={14} />
                  </span>
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
