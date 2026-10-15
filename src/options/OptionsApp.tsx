import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent
} from 'react'
import { Button } from '../ui/base/Button'
import { CloseButton } from '../ui/base/CloseButton'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../ui/base/Collapsible'
import {
  DialogBackdrop,
  DialogClose,
  DialogOverlay,
  DialogPanel,
  DialogTitle
} from '../ui/base/Dialog'
import { DotMatrixLoader } from '../ui/base/DotMatrixLoader'
import { Icon } from '../ui/icons/Icon'
import type { IconName } from '../ui/icons/icon-map'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { getMotionAwareScrollBehavior } from '../shared/motion'
import { GeneralPanel } from './components/GeneralPanel'
import { AiSettingsPanel } from './components/AiSettingsPanel'
import { InboxPanel } from './components/InboxPanel'
import { useInboxReviewData } from './components/inbox-review-store'
import { useOptionsModalsState } from './components/options-modals-store'
import {
  getOptionsSectionNavigationFromLink,
  type OptionsSectionKey
} from './options-section-store'
import {
  handleOptionsBookmarkTreeChanged,
  handleOptionsWindowSectionChange,
  subscribeToOptionsStorageEvents,
  useOptionsController
} from './options-controller'
import {
  navClass,
  navCollapsibleClass,
  navGroupClass,
  navGroupTriggerClass,
  navActiveIndicatorClass,
  navActiveIndicatorExitClass,
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
  optionsMobileNavBackdropClass,
  optionsMobileNavCloseClass,
  optionsMobileNavHeaderClass,
  optionsMobileNavOverlayClass,
  optionsMobileNavPanelClass,
  optionsMobileNavTitleClass,
  optionsMobileNavTriggerClass,
  optionsMobileSidebarClass,
  optionsShellClassBase,
  optionsSkipLinkClass,
  optionsSidebarClass,
  optionsSidebarDividerClass,
  optionsSidebarLabelClass
} from './components/options-chrome-classes'
import { useOptionsSectionChrome } from './useOptionsSectionChrome'

const AvailabilityPanel = lazy(() => import('./components/AvailabilityPanel').then((module) => ({ default: module.AvailabilityPanel })))
const AiAnalysisPanel = lazy(() => import('./components/AiAnalysisPanel').then((module) => ({ default: module.AiAnalysisPanel })))
const BookmarkHistoryPanel = lazy(() => import('./components/BookmarkHistoryPanel').then((module) => ({ default: module.BookmarkHistoryPanel })))
// These panels share one chunk. Reuse its resolved lazy boundary so moving to
// another task panel does not suspend again after that chunk has loaded.
const TaskPanel = lazy(() => import('./components/TaskPanels').then((module) => ({ default: module.TaskPanel })))

type OptionsModalsComponent = (typeof import('./components/OptionsModals'))['OptionsModals']

let optionsModalsComponent: OptionsModalsComponent | null = null
let optionsModalsPromise: Promise<OptionsModalsComponent> | null = null

function loadOptionsModals(): Promise<OptionsModalsComponent> {
  if (optionsModalsComponent) {
    return Promise.resolve(optionsModalsComponent)
  }
  optionsModalsPromise ||= import('./components/OptionsModals').then((module) => {
    optionsModalsComponent = module.OptionsModals
    return module.OptionsModals
  })
  return optionsModalsPromise
}

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
  { section: 'inbox', href: '#inbox', icon: 'Bookmark', label: '待整理' },
  { section: 'duplicates', href: '#duplicates', icon: 'Copy', label: '重复书签检测' },
  { section: 'folder-cleanup', href: '#folder-cleanup', icon: 'Folder', label: '文件夹清理' },
  { section: 'recycle', href: '#recycle', icon: 'Trash2', label: '回收站' }
]

const aiLinks: NavLink[] = [
  { section: 'ai-settings', href: '#ai-settings', icon: 'Settings', label: 'AI 服务配置' },
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
      data-options-section={section}
      onClick={onNavigate}
    >
      <span className={navLinkIconClass} aria-hidden="true">
        <Icon name={icon} size={15} />
      </span>
      <span className="relative z-[1] min-w-0 truncate max-[920px]:whitespace-normal">{label}</span>
      {section === 'inbox' ? <InboxPendingCount /> : null}
    </a>
  )
}

function InboxPendingCount() {
  const { data } = useInboxReviewData()
  return data ? <span className="ml-auto text-xs tabular-nums text-ds-text-secondary" aria-label={`${data.pending.length} 条待整理`}>{data.pending.length}</span> : null
}

function OptionsHeader({
  activeSectionKey,
  mobileNavigationOpen,
  onMobileNavigationOpenChange,
  onNavigate
}: {
  activeSectionKey: OptionsSectionKey
  mobileNavigationOpen: boolean
  onMobileNavigationOpenChange: (open: boolean) => void
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
          <strong className="block truncate whitespace-nowrap text-[15px] font-[650] leading-none tracking-[-0.01em] text-ds-text-primary max-[1180px]:text-[13px] max-[1180px]:tracking-[-0.02em] max-[760px]:text-[20px] max-[760px]:tracking-[0]">
            Curator Bookmark
          </strong>
        </span>
      </a>
      <Button
        id="options-mobile-nav-trigger"
        className={optionsMobileNavTriggerClass}
        type="button"
        variant="ghost"
        aria-controls="options-mobile-navigation"
        aria-expanded={mobileNavigationOpen}
        aria-label="打开设置导航"
        title="打开设置导航"
        onClick={() => onMobileNavigationOpenChange(true)}
      >
        <Icon name="Menu" size={20} aria-hidden="true" />
      </Button>
    </header>
  )
}

function OptionsSidebar({
  activeSectionKey,
  onNavigate,
  variant = 'desktop',
  visible = true
}: {
  activeSectionKey: OptionsSectionKey
  onNavigate: SectionLinkClickHandler
  variant?: 'desktop' | 'mobile'
  visible?: boolean
}) {
  const [availabilityOpen, setAvailabilityOpen] = useState(() => availabilitySectionKeys.has(activeSectionKey))
  useLayoutEffect(() => {
    if (availabilitySectionKeys.has(activeSectionKey)) setAvailabilityOpen(true)
  }, [activeSectionKey])
  const idPrefix = variant === 'mobile' ? 'mobile-' : ''
  const sidebarRef = useRef<HTMLElement | null>(null)
  const activeIndicatorRef = useRef<HTMLSpanElement | null>(null)
  const exitIndicatorRef = useRef<HTMLSpanElement | null>(null)
  const activeLinkRef = useRef<HTMLElement | null>(null)
  const exitLinkRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current
    const indicator = activeIndicatorRef.current
    const exitIndicator = exitIndicatorRef.current
    if (!sidebar || !indicator || !exitIndicator || !visible) {
      if (indicator) {
        indicator.style.opacity = '0'
        delete indicator.dataset.ready
      }
      if (exitIndicator) {
        exitIndicator.style.opacity = '0'
      }
      activeLinkRef.current = null
      exitLinkRef.current = null
      return
    }

    let readyFrame = 0

    type IndicatorGeometry = {
      clipPath: string
      height: string
      transform: string
      width: string
    }

    const readGeometry = (link: HTMLElement): IndicatorGeometry | null => {
      const sidebarRect = sidebar.getBoundingClientRect()
      const linkRect = link.getBoundingClientRect()
      if (!linkRect.width || !linkRect.height) {
        return null
      }
      const clipRect = link.closest('.t-acc-panel-inner')?.getBoundingClientRect()
      return {
        clipPath: clipRect
          ? `inset(${Math.max(0, clipRect.top - linkRect.top)}px 0px ${Math.max(0, linkRect.bottom - clipRect.bottom)}px 0px)`
          : '',
        height: `${linkRect.height}px`,
        transform: `translate3d(${linkRect.left - sidebarRect.left + sidebar.scrollLeft}px, ${linkRect.top - sidebarRect.top + sidebar.scrollTop}px, 0)`,
        width: `${linkRect.width}px`
      }
    }

    const paintGeometry = (element: HTMLSpanElement, geometry: IndicatorGeometry) => {
      element.style.transform = geometry.transform
      element.style.width = geometry.width
      element.style.height = geometry.height
      element.style.clipPath = geometry.clipPath
    }

    // Replaying an opacity change from a known start value is what guarantees
    // the browser commits that value before the transition runs.
    const replayOpacity = (element: HTMLSpanElement, from: string, to: string) => {
      element.style.transition = 'none'
      element.style.opacity = from
      void element.offsetWidth
      element.style.removeProperty('transition')
      element.style.opacity = to
    }

    const isDissolving = (element: HTMLSpanElement) =>
      element
        .getAnimations()
        .some(
          (animation) =>
            (animation as CSSTransition).transitionProperty === 'opacity' &&
            animation.playState !== 'finished'
        )

    const positionIndicator = () => {
      const activeLink = sidebar.querySelector<HTMLElement>(
        '.options-nav-link[aria-current="page"]'
      )
      const geometry = activeLink ? readGeometry(activeLink) : null
      if (!activeLink || !geometry) {
        indicator.style.opacity = '0'
        exitIndicator.style.opacity = '0'
        return
      }

      // The highlight never travels across the sidebar. It is placed on the
      // active row at once, while a twin parked on the row that was selected
      // dissolves there, so changing sections reads as one highlight handing
      // over in place instead of a shape drifting between rows.
      const outgoing = activeLinkRef.current
      const selectionChanged = outgoing !== activeLink
      // A second selection can arrive while the twin is still fading.
      // Re-parking it then would snap a half-faded copy back to full opacity
      // on the row in between, so that copy is left to finish where it is.
      const outgoingGeometry =
        selectionChanged && outgoing && !isDissolving(exitIndicator)
          ? readGeometry(outgoing)
          : null
      if (outgoingGeometry) {
        paintGeometry(exitIndicator, outgoingGeometry)
        exitLinkRef.current = outgoing
      }
      activeLinkRef.current = activeLink
      paintGeometry(indicator, geometry)

      if (selectionChanged) {
        if (outgoingGeometry) {
          replayOpacity(exitIndicator, '1', '0')
        }
        // The first placement paints settled: there is nothing to hand over
        // from, so it must not spend a frame fading in. A quick second
        // selection also keeps the fade already running rather than
        // restarting it from nothing.
        if (!outgoing || isDissolving(indicator)) {
          indicator.style.opacity = '1'
        } else {
          replayOpacity(indicator, '0', '1')
        }
      } else {
        // Layout movement only keeps the highlight glued to its row, with no
        // transition to ride; replaying the fade here would flicker on every
        // resize and scroll.
        indicator.style.opacity = '1'
      }

      // Keep an in-flight hand-off glued to the row it is dissolving on, so a
      // resizing disclosure or a scroll never strands it somewhere else.
      const exitLink = exitLinkRef.current
      const exitGeometry = exitLink && isDissolving(exitIndicator) ? readGeometry(exitLink) : null
      if (exitGeometry) {
        paintGeometry(exitIndicator, exitGeometry)
      }

      if (!indicator.dataset.ready && !readyFrame) {
        readyFrame = window.requestAnimationFrame(() => {
          indicator.dataset.ready = 'true'
        })
      }
    }

    positionIndicator()
    const resizeObserver = new ResizeObserver(positionIndicator)
    resizeObserver.observe(sidebar)
    sidebar.querySelectorAll('.t-acc-panel, .options-nav-link[aria-current="page"]').forEach((element) => {
      resizeObserver.observe(element)
    })
    window.addEventListener('resize', positionIndicator)
    return () => {
      window.cancelAnimationFrame(readyFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', positionIndicator)
    }
  }, [activeSectionKey, variant, visible])

  return (
    <aside
      className={variant === 'mobile' ? optionsMobileSidebarClass : optionsSidebarClass}
      aria-label={variant === 'mobile' ? '移动端设置导航' : '设置导航'}
      ref={sidebarRef}
    >
      <span className={navActiveIndicatorClass} ref={activeIndicatorRef} aria-hidden="true" />
      <span className={navActiveIndicatorExitClass} ref={exitIndicatorRef} aria-hidden="true" />
      {navGroups.map((group, groupIndex) => (
        <div
          className={[navGroupClass, groupIndex > 0 ? 'mt-[18px]' : ''].filter(Boolean).join(' ')}
          key={group.labelId}
        >
          <p id={`${idPrefix}${group.labelId}`} className={optionsSidebarLabelClass}>
            {group.label}
          </p>
          <nav className={navClass} aria-labelledby={`${idPrefix}${group.labelId}`}>
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
                onOpenChange={setAvailabilityOpen}
              >
                <CollapsibleTrigger
                  className={navGroupTriggerClass}
                  type="button"
                  aria-controls={`${idPrefix}${group.collapsible.panelId}`}
                >
                  <span>{group.collapsible.trigger}</span>
                  <span className="t-acc-chevron text-ds-text-disabled" aria-hidden="true">
                    <Icon name="ChevronDown" size={14} />
                  </span>
                </CollapsibleTrigger>
                <CollapsiblePanel
                  id={`${idPrefix}${group.collapsible.panelId}`}
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

function OptionsMobileNavigation({
  activeSectionKey,
  onNavigate,
  onOpenChange,
  open
}: {
  activeSectionKey: OptionsSectionKey
  onNavigate: SectionLinkClickHandler
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const handleNavigate: SectionLinkClickHandler = (event) => {
    const shouldClose =
      event.button === 0 &&
      !event.metaKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey
    onNavigate(event)
    if (shouldClose) {
      onOpenChange(false)
    }
  }

  return (
    <DialogOverlay
      id="options-mobile-navigation"
      className={`${optionsMobileNavOverlayClass} ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="options-mobile-nav-trigger"
      aria-hidden={open ? 'false' : 'true'}
      inert={!open}
      tabIndex={-1}
    >
      <DialogBackdrop className={optionsMobileNavBackdropClass} />
      <DialogPanel
        className={optionsMobileNavPanelClass}
        motionVariant="drawer"
        aria-labelledby="options-mobile-navigation-title"
        finalFocus={() => document.getElementById('options-mobile-nav-trigger')}
      >
        <div className={optionsMobileNavHeaderClass}>
          <DialogTitle id="options-mobile-navigation-title" className={optionsMobileNavTitleClass}>
            设置导航
          </DialogTitle>
          <DialogClose
            render={
              <CloseButton
                className={optionsMobileNavCloseClass}
                type="button"
                label="关闭设置导航"
                variant="ghost"
              />
            }
          />
        </div>
        <OptionsSidebar
          activeSectionKey={activeSectionKey}
          onNavigate={handleNavigate}
          variant="mobile"
          visible={open}
        />
      </DialogPanel>
    </DialogOverlay>
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
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
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

  useEffect(subscribeToOptionsStorageEvents, [])

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 921px)')
    const closeMobileNavigation = () => {
      if (desktopQuery.matches) {
        setMobileNavigationOpen(false)
      }
    }
    closeMobileNavigation()
    desktopQuery.addEventListener('change', closeMobileNavigation)
    return () => desktopQuery.removeEventListener('change', closeMobileNavigation)
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
    if (sectionKey !== 'ai-settings') {
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
  }, [sectionKey])

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
        <OptionsHeader
          activeSectionKey={sectionKey}
          mobileNavigationOpen={mobileNavigationOpen}
          onMobileNavigationOpenChange={setMobileNavigationOpen}
          onNavigate={handleSectionNavigationClick}
        />
        <div className={optionsLayoutClass}>
          <OptionsSidebar activeSectionKey={sectionKey} onNavigate={handleSectionNavigationClick} />
          <main id="options-main" className={optionsMainClass} ref={optionsMainRef} tabIndex={-1}>
            <Suspense fallback={<OptionsPanelLoading />}>
              <ActiveOptionsPanel
                aiProviderAnchorRef={handleAiProviderAnchorRef}
                aiProviderAttentionRequestId={aiProviderAttentionRequestId}
                sectionKey={sectionKey}
              />
            </Suspense>
          </main>
        </div>
      </div>
      <OptionsMobileNavigation
        activeSectionKey={sectionKey}
        onNavigate={handleSectionNavigationClick}
        onOpenChange={setMobileNavigationOpen}
        open={mobileNavigationOpen}
      />
      <DeferredOptionsModals />
    </ThemeProvider>
  )
}

function ActiveOptionsPanel({
  aiProviderAnchorRef,
  aiProviderAttentionRequestId,
  sectionKey
}: {
  aiProviderAnchorRef: (node: HTMLDivElement | null) => void
  aiProviderAttentionRequestId: number
  sectionKey: OptionsSectionKey
}) {
  if (sectionKey === 'general') {
    return <GeneralPanel hidden={false} />
  }
  if (sectionKey === 'ai-settings') return <AiSettingsPanel anchorRef={aiProviderAnchorRef} attentionRequestId={aiProviderAttentionRequestId} />
  if (sectionKey === 'inbox') return <InboxPanel />
  if (sectionKey === 'availability') return <AvailabilityPanel hidden={false} />
  if (sectionKey === 'ai') return <AiAnalysisPanel hidden={false} />
  if (sectionKey === 'bookmark-history') return <BookmarkHistoryPanel hidden={false} />
  return <TaskPanel hidden={false} sectionKey={sectionKey} />
}

function OptionsPanelLoading() {
  return (
    <output
      className="flex min-h-40 items-center justify-center gap-2.5 text-[13px] text-ds-text-muted"
      aria-live="polite"
    >
      <DotMatrixLoader className="size-5" variant="bar" />
      <span>正在载入…</span>
    </output>
  )
}

function DeferredOptionsModals() {
  const modals = useOptionsModalsState()
  const open = modals.confirm.open || modals.delete.open || modals.move.open || modals.scope.open
  const [Modals, setModals] = useState<OptionsModalsComponent | null>(optionsModalsComponent)

  useEffect(() => {
    if (Modals || !open) {
      return
    }

    let active = true
    void loadOptionsModals().then((Component) => {
      if (active) {
        setModals(() => Component)
      }
    })

    return () => {
      active = false
    }
  }, [Modals, open])

  return Modals ? <Modals /> : null
}
