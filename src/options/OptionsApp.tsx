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
import type { IconName } from '../ui/icons/icon-map'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { getMotionAwareScrollBehavior } from '../shared/motion'
import { BookmarkHistoryPanel } from './components/BookmarkHistoryPanel'
import { AiAnalysisPanel, AvailabilityPanel, GeneralPanel } from './components/CorePanels'
import { OptionsModals } from './components/OptionsModals'
import {
  getOptionsSectionNavigationFromLink,
  type OptionsSectionKey
} from './options-section-store'
import {
  handleOptionsBookmarkTreeChanged,
  handleOptionsWindowSectionChange,
  useOptionsController
} from './options-controller'
import {
  navClass,
  navCollapsibleClass,
  navGroupClass,
  navGroupTriggerClass,
  navLinkIconClass,
  navLinkClass,
  navSubitemClass,
  navSublistClass,
  optionsBrandClassBase,
  optionsBrandCopyClass,
  optionsBrandMarkClass,
  optionsBrandMarkImageClass,
  optionsHeaderClass,
  optionsLayoutClass,
  optionsMainClass,
  optionsShellClassBase,
  optionsSkipLinkClass,
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
  icon: IconName
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
  { section: 'general', href: '#general', icon: 'Settings', label: '通用设置' },
  { section: 'backup', href: '#backup', icon: 'Save', label: '数据与备份' }
]

const availabilityLinks: NavLink[] = [
  { section: 'availability', href: '#availability', icon: 'Gauge', label: '书签可用性检测', variant: 'subitem' },
  { section: 'history', href: '#history', icon: 'ArchiveRestore', label: '检测历史', variant: 'subitem' },
  { section: 'redirects', href: '#redirects', icon: 'RefreshCw', label: '重定向更新', variant: 'subitem' },
  { section: 'ignore', href: '#ignore', icon: 'CircleHelp', label: '忽略规则', variant: 'subitem' }
]

const bookmarkLinks: NavLink[] = [
  { section: 'duplicates', href: '#duplicates', icon: 'Copy', label: '重复书签检测' },
  { section: 'folder-cleanup', href: '#folder-cleanup', icon: 'Folder', label: '文件夹清理' },
  { section: 'recycle', href: '#recycle', icon: 'Trash2', label: '回收站' }
]

const aiLinks: NavLink[] = [
  { section: 'ai', href: '#ai', icon: 'Bot', label: '书签智能分析' },
  { section: 'bookmark-history', href: '#bookmark-history', icon: 'Bookmark', label: 'AI 整理记录' }
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
    label: 'AI 功能',
    links: aiLinks
  }
]

type SectionLinkClickHandler = (event: MouseEvent<HTMLAnchorElement>) => void

function OptionsNavLink({
  href,
  icon,
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
      className={['group', navLinkClass, className].filter(Boolean).join(' ')}
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >
      <span className={navLinkIconClass} aria-hidden="true">
        <Icon name={icon} size={15} />
      </span>
      <span className="min-w-0 truncate max-[920px]:whitespace-normal">{label}</span>
    </a>
  )
}

function OptionsHeader({
  activeSectionKey,
  onNavigate
}: {
  activeSectionKey: OptionsSectionKey
  onNavigate: SectionLinkClickHandler
}) {
  const active = activeSectionKey === 'general'

  return (
    <header className={optionsHeaderClass}>
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
  onNavigate
}: {
  activeSectionKey: OptionsSectionKey
  onNavigate: SectionLinkClickHandler
}) {
  const [availabilityManuallyOpen, setAvailabilityManuallyOpen] = useState(false)
  const availabilityOpen = availabilitySectionKeys.has(activeSectionKey) || availabilityManuallyOpen

  return (
    <aside className={optionsSidebarClass} aria-label="设置导航">
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
    </aside>
  )
}

function subscribeToOptionsBookmarkEvents(): () => void {
  const bookmarks = typeof chrome === 'undefined' ? null : chrome.bookmarks
  if (!bookmarks) {
    return () => undefined
  }

  bookmarks.onCreated.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onRemoved.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onChanged.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onMoved.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onChildrenReordered.addListener(handleOptionsBookmarkTreeChanged)
  bookmarks.onImportEnded.addListener(handleOptionsBookmarkTreeChanged)
  return () => {
    bookmarks.onCreated.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onRemoved.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onChanged.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onMoved.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onChildrenReordered.removeListener(handleOptionsBookmarkTreeChanged)
    bookmarks.onImportEnded.removeListener(handleOptionsBookmarkTreeChanged)
  }
}

export function OptionsApp() {
  useOptionsController()
  const {
    sectionAnchor,
    sectionKey,
    sectionRevision,
    navigateToSectionHash
  } = useOptionsSectionChrome({ onSectionChange: handleOptionsWindowSectionChange })
  const optionsShellRef = useRef<HTMLDivElement | null>(null)
  const optionsMainRef = useRef<HTMLElement | null>(null)
  const aiProviderAnchorRef = useRef<HTMLDivElement | null>(null)
  const [aiProviderAttentionRequestId, setAiProviderAttentionRequestId] = useState(0)
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

  useEffect(() => {
    return subscribeToOptionsBookmarkEvents()
  }, [])

  useLayoutEffect(() => {
    const shell = optionsShellRef.current
    const root = document.getElementById('options-root')
    root?.setAttribute('data-options-ready', 'true')
    if (!shell) {
      return
    }

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (optionsShellRef.current === shell) {
          shell.classList.add('options-motion-ready')
        }
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame)
      }
      shell.classList.remove('options-motion-ready')
      root?.removeAttribute('data-options-ready')
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
          behavior: getMotionAwareScrollBehavior('smooth')
        })
      } else {
        target.scrollIntoView({
          block: 'start',
          behavior: getMotionAwareScrollBehavior('smooth')
        })
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
      <div className={optionsShellClassBase} ref={optionsShellRef}>
        <a className={optionsSkipLinkClass} href="#options-main">跳到主要内容</a>
        <div className={optionsSidebarDividerClass} aria-hidden="true"></div>
        <OptionsHeader activeSectionKey={sectionKey} onNavigate={handleSectionNavigationClick} />
        <div className={optionsLayoutClass}>
          <OptionsSidebar activeSectionKey={sectionKey} onNavigate={handleSectionNavigationClick} />
          <main id="options-main" className={optionsMainClass} ref={optionsMainRef} tabIndex={-1}>
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
