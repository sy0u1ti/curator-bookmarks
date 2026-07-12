import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { Button } from '../ui/base/Button'
import { cx } from '../ui/base/utils'
import { Icon } from '../ui/icons/Icon'
import { ThemeProvider } from '../ui/theme/ThemeProvider'
import { useNewtabController } from './newtab-controller'
import { DashboardOverlayHost } from './components/DashboardOverlay'
import { BookmarkMenusHost } from './components/BookmarkMenusHost'
import { FeaturedBackgroundModalHost } from './components/FeaturedBackgroundModal'
import { NewtabBackgroundLayer } from './components/NewtabBackgroundLayer'
import { useNewtabAppChromeAttributes } from './components/NewtabBodyClassesHost'
import { NewtabContentHost } from './components/NewtabContentHost'
import { NewtabDeleteToastHost } from './components/NewtabDeleteToastHost'
import { NewtabDragLayerHost } from './components/NewtabDragLayerHost'
import { NewtabInstantWallpaperHost } from './components/NewtabInstantWallpaperHost'
import { NewtabWallpaperFilterLayer } from './components/NewtabWallpaperFilterLayer'
import { NewtabPaperShaderLayer } from './components/NewtabPaperShaderLayer'
import { SettingsDrawerHost } from './components/SettingsDrawer'
import {
  dispatchNewtabBookmarkChanged,
  dispatchNewtabBookmarkCreated,
  dispatchNewtabBookmarkMoved,
  dispatchNewtabBookmarkRemoved
} from './newtab-bookmark-events-store'
import {
  dispatchNewtabContentShellContextMenu,
  dispatchNewtabContentShellPointerDownCapture,
  setNewtabContentShellNode
} from './newtab-content-store'
import { dispatchNewtabDocumentKeyDown } from './newtab-keyboard-store'
import {
  dispatchNewtabPageHide,
  dispatchNewtabVisibilityChange
} from './newtab-lifecycle-store'
import {
  dispatchNewtabWindowHashChange,
  dispatchNewtabWindowMessage,
  dispatchNewtabWindowPointerCancel,
  dispatchNewtabWindowPointerMove,
  dispatchNewtabWindowPointerUp,
  dispatchNewtabWindowResize
} from './newtab-window-store'
import {
  dispatchNewtabDashboardOverlayOpenRequest,
  setNewtabDashboardOverlayNodes,
  useNewtabDashboardOverlayView
} from './newtab-dashboard-overlay-store'
import {
  dispatchNewtabSettingsDrawerOpenChange,
  dispatchNewtabSettingsDrawerToggleRequest,
  setNewtabSettingsDrawerNodes,
  useNewtabSettingsDrawerView
} from './newtab-settings-drawer-store'
import {
  useNewtabBackgroundSettingsView,
  type NewtabBackgroundSettingsView
} from './newtab-background-settings-store'
import { useNewtabInstantWallpaperView } from './newtab-instant-wallpaper-store'
import { useNewtabFolderSourceView } from './newtab-folder-source-store'
import {
  getBackgroundMaskBaseColor,
  getBackgroundMaskBackdropFilter,
  getBackgroundMaskOverlayGradient,
  isLegacyBackgroundMaskStyle
} from './background-mask-settings'

const BACKGROUND_MASK_BASE_CLASS = 'newtab-background-mask fixed inset-0 z-0 pointer-events-none opacity-0 [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard)] before:absolute before:inset-0 before:pointer-events-none before:opacity-0 before:mix-blend-overlay before:[transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard)]'
const BACKGROUND_MASK_ENABLED_CLASS = 'opacity-100'
const BACKGROUND_MASK_STYLE_CLASS_BY_STYLE = {
  dark: '',
  frosted: '',
  light: '',
  noise: 'before:opacity-[0.16] before:[background-image:radial-gradient(rgba(255,255,255,0.18)_0.65px,transparent_0.9px),radial-gradient(rgba(0,0,0,0.24)_0.7px,transparent_1px)] before:[background-position:0_0,12px_14px] before:[background-size:4px_4px,5px_5px]'
} as const
const SOLID_BACKGROUND_NOISE_CLASS = 'newtab-solid-background-noise fixed inset-0 z-0 pointer-events-none overflow-hidden'
const NEWTAB_REDUCED_MOTION_DESCENDANTS_CLASS = [
  'motion-reduce:[&_*]:![animation-duration:1ms]',
  'motion-reduce:[&_*::before]:![animation-duration:1ms]',
  'motion-reduce:[&_*::after]:![animation-duration:1ms]',
  'motion-reduce:[&_*]:![transition-duration:1ms]',
  'motion-reduce:[&_*::before]:![transition-duration:1ms]',
  'motion-reduce:[&_*::after]:![transition-duration:1ms]',
  'motion-reduce:[&_*]:![transform:none]',
  'motion-reduce:[&_*::before]:![transform:none]',
  'motion-reduce:[&_*::after]:![transform:none]'
].join(' ')
const NEWTAB_REDUCED_MOTION_SELF_CLASS =
  'motion-reduce:![animation-duration:1ms] motion-reduce:![transition-duration:1ms] motion-reduce:![transform:none]'
const LOADING_VISIBILITY_CLASS = 'opacity-100 visible [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),visibility_0s_linear_0s]'
const SETTINGS_TRIGGER_ZONE_BASE_CLASS = `settings-trigger-zone group/settings-trigger-zone fixed top-0 right-0 z-30 h-24 w-[min(360px,calc(100vw-18px))] ${LOADING_VISIBILITY_CLASS} ${NEWTAB_REDUCED_MOTION_SELF_CLASS}`
const SETTINGS_TRIGGER_ZONE_VISIBLE_CLASS = 'pointer-events-none'
const SETTINGS_TRIGGER_ZONE_AUTO_HIDE_CLASS = 'pointer-events-auto'
const SETTINGS_TRIGGER_BUTTON_BASE_CLASS = `settings-trigger absolute top-[18px] right-[18px] inline-flex h-10 min-h-[34px] w-10 min-w-10 cursor-pointer items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-divider)] bg-[rgba(26,27,29,0.68)] p-0 text-center leading-none text-[var(--ui-text-secondary)] outline-none pointer-events-auto [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),background-color_var(--ui-motion-standard)_var(--ui-ease-standard),border-color_var(--ui-motion-standard)_var(--ui-ease-standard),color_var(--ui-motion-standard)_var(--ui-ease-standard),transform_160ms_ease] [-webkit-backdrop-filter:blur(12px)_saturate(1.12)] [backdrop-filter:blur(12px)_saturate(1.12)] hover:border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[rgba(245,245,247,0.34)] aria-expanded:border-[var(--ui-divider-strong)] aria-expanded:bg-[var(--ui-surface-hover)] aria-expanded:text-[var(--ui-text-primary)] active:[transform:scale(var(--ui-press-scale))] motion-reduce:transition-none motion-reduce:transform-none [&_svg]:h-5 [&_svg]:w-5 [&_svg]:flex-none [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] ${NEWTAB_REDUCED_MOTION_SELF_CLASS}`
const SETTINGS_TRIGGER_BUTTON_VISIBLE_CLASS = 'opacity-100'
const SETTINGS_TRIGGER_BUTTON_AUTO_HIDE_CLASS = 'translate-x-2 -translate-y-2 scale-[0.98] opacity-0 group-hover/settings-trigger-zone:translate-x-0 group-hover/settings-trigger-zone:translate-y-0 group-hover/settings-trigger-zone:scale-100 group-hover/settings-trigger-zone:opacity-100 group-focus-within/settings-trigger-zone:translate-x-0 group-focus-within/settings-trigger-zone:translate-y-0 group-focus-within/settings-trigger-zone:scale-100 group-focus-within/settings-trigger-zone:opacity-100 aria-expanded:translate-x-0 aria-expanded:translate-y-0 aria-expanded:scale-100 aria-expanded:opacity-100 [@media(hover:none)]:translate-x-0 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100'
const DASHBOARD_TRIGGER_CLASS = 'dashboard-trigger right-[66px] w-10 min-w-10 p-0 no-underline'
const DASHBOARD_SHORTCUT_HINT_BASE_CLASS = 'dashboard-shortcut-hint absolute top-6 right-[116px] inline-flex min-h-7 max-w-[min(220px,calc(100vw-168px))] items-center overflow-hidden rounded-[var(--ui-radius-control)] border border-[rgba(245,245,247,0.09)] bg-[rgba(24,24,26,0.42)] px-[9px] text-[11px] font-[650] leading-[1.2] text-[rgba(245,245,247,0.54)] pointer-events-none text-ellipsis whitespace-nowrap [-webkit-backdrop-filter:blur(12px)_saturate(1.12)] [backdrop-filter:blur(12px)_saturate(1.12)] max-[520px]:hidden'
const DASHBOARD_SHORTCUT_HINT_VISIBLE_CLASS = 'opacity-100'
const DASHBOARD_SHORTCUT_HINT_AUTO_HIDE_CLASS = 'opacity-0 transition-opacity duration-[var(--ui-motion-standard)] ease-[var(--ui-ease-standard)] group-hover/settings-trigger-zone:opacity-100 group-focus-within/settings-trigger-zone:opacity-100 [@media(hover:none)]:opacity-100'
const SETTINGS_BACKDROP_BASE_CLASS = 'settings-backdrop fixed inset-0 z-[10015] bg-transparent pointer-events-none'
const SETTINGS_BACKDROP_OPEN_CLASS = 'pointer-events-auto'
const WALLPAPER_LOADING_INDICATOR_CLASS = 'wallpaper-loading-indicator fixed inset-0 z-[2] grid place-items-center p-6 pointer-events-none'
const WALLPAPER_LOADING_INDICATOR_HIDDEN_CLASS = 'opacity-0 invisible translate-y-1 scale-[0.98] [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-standard)_var(--ui-ease-standard),visibility_0s_linear_var(--ui-motion-standard)]'
const WALLPAPER_LOADING_INDICATOR_VISIBLE_CLASS = 'opacity-100 visible translate-y-0 scale-100 [transition:opacity_var(--ui-motion-standard)_var(--ui-ease-standard),transform_var(--ui-motion-standard)_var(--ui-ease-standard),visibility_0s_linear_0s]'
const WALLPAPER_LOADING_CARD_CLASS = 'wallpaper-loading-card grid h-14 w-14 place-items-center rounded-lg border border-[rgba(245,245,247,0.12)] [background:linear-gradient(180deg,rgba(255,255,255,0.105),rgba(255,255,255,0.025)),rgba(21,21,22,0.54)] text-[rgba(245,245,247,0.84)] shadow-[inset_0_1px_0_rgba(255,255,255,0.075)] [filter:drop-shadow(0_14px_32px_rgba(0,0,0,0.14))] backdrop-blur-[8px] backdrop-saturate-[1.06]'
const WALLPAPER_LOADING_LOADER_CLASS = 'wallpaper-loading-loader inline-flex h-3.5 w-[30px] items-center gap-1'
const WALLPAPER_LOADING_DOT_CLASS = 'block h-1.5 w-1.5 rounded-full bg-current opacity-[0.32] animate-[wallpaper-loading-loader-pulse_900ms_var(--ui-ease-standard)_infinite_both]'
const NEWTAB_SHELL_CLASS = `newtab-shell relative z-[1] grid h-screen h-dvh items-start justify-items-center overflow-x-hidden overflow-y-auto px-[clamp(14px,5vw,72px)] pt-[clamp(18px,5vh,46px)] pb-[clamp(24px,6vh,64px)] select-none [-webkit-user-select:none] [scrollbar-color:rgba(245,245,247,0.18)_transparent] [scrollbar-width:thin] [line-break:strict] [hanging-punctuation:allow-end] [text-spacing-trim:trim-start] [text-autospace:normal] [&_:where(input,textarea,button,code,kbd,pre,samp,.bookmark-url,.newtab-search-input)]:[line-break:auto] [&_:where(input,textarea,button,code,kbd,pre,samp,.bookmark-url,.newtab-search-input)]:[hanging-punctuation:none] [&_:where(input,textarea,button,code,kbd,pre,samp,.bookmark-url,.newtab-search-input)]:[text-spacing-trim:space-all] [&_:where(input,textarea,button,code,kbd,pre,samp,.bookmark-url,.newtab-search-input)]:[text-autospace:no-autospace] [&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[rgba(245,245,247,0.18)] [&::-webkit-scrollbar-thumb]:bg-clip-padding ${LOADING_VISIBILITY_CLASS} ${NEWTAB_REDUCED_MOTION_DESCENDANTS_CLASS}`

export function NewtabApp() {
  useNewtabController()

  return (
    <ThemeProvider>
      <NewtabShell />
    </ThemeProvider>
  )
}

function NewtabShell() {
  const dashboardOverlay = useNewtabDashboardOverlayView()
  const backgroundSettings = useNewtabBackgroundSettingsView()
  const folderSource = useNewtabFolderSourceView()
  const instantWallpaper = useNewtabInstantWallpaperView()
  const settingsDrawer = useNewtabSettingsDrawerView()
  const appChromeAttributes = useNewtabAppChromeAttributes()
  const autoHideSettingsTrigger = folderSource.general.hideSettingsTrigger
  const dashboardTriggerRef = useRef<HTMLButtonElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const settingsBackdropRef = useRef<HTMLButtonElement | null>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const pendingHandoffFrame = useRef(0)
  const settingsBackgroundProps = settingsDrawer.open
    ? {
        'aria-hidden': true,
        inert: true
      }
    : {}

  useLayoutEffect(() => {
    setNewtabContentShellNode(shellRef.current)
    return () => {
      setNewtabContentShellNode(null)
    }
  }, [])

  useLayoutEffect(() => {
    setNewtabDashboardOverlayNodes({
      trigger: dashboardTriggerRef.current
    })
    return () => {
      setNewtabDashboardOverlayNodes({
        trigger: null
      })
    }
  }, [])

  useLayoutEffect(() => {
    setNewtabSettingsDrawerNodes({
      backdrop: settingsBackdropRef.current,
      trigger: settingsTriggerRef.current
    })
    return () => {
      setNewtabSettingsDrawerNodes({
        backdrop: null,
        trigger: null
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!backgroundSettings.ready) return
    // Hand off without a bare frame: the React mask paints this frame at full
    // opacity (no fade — see [data-mask-initial]); only after it has painted do
    // we drop the identical startup mask on the next frame.
    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        removeStartupBackgroundMask()
        document.getElementById('newtab-background-mask')?.removeAttribute('data-mask-initial')
      })
      pendingHandoffFrame.current = secondFrame
    })
    pendingHandoffFrame.current = firstFrame
    return () => {
      window.cancelAnimationFrame(pendingHandoffFrame.current)
    }
  }, [backgroundSettings.ready])

  useEffect(() => {
    const bookmarks = typeof chrome === 'undefined' ? null : chrome.bookmarks
    const handleVisibilityChange = () => {
      dispatchNewtabVisibilityChange(document.visibilityState)
    }

    bookmarks?.onCreated?.addListener(dispatchNewtabBookmarkCreated)
    bookmarks?.onRemoved?.addListener(dispatchNewtabBookmarkRemoved)
    bookmarks?.onChanged?.addListener(dispatchNewtabBookmarkChanged)
    bookmarks?.onMoved?.addListener(dispatchNewtabBookmarkMoved)
    document.addEventListener('keydown', dispatchNewtabDocumentKeyDown)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('hashchange', dispatchNewtabWindowHashChange)
    window.addEventListener('message', dispatchNewtabWindowMessage)
    window.addEventListener('pagehide', dispatchNewtabPageHide)
    window.addEventListener('pointercancel', dispatchNewtabWindowPointerCancel)
    window.addEventListener('pointermove', dispatchNewtabWindowPointerMove)
    window.addEventListener('pointerup', dispatchNewtabWindowPointerUp)
    window.addEventListener('resize', dispatchNewtabWindowResize)
    return () => {
      bookmarks?.onCreated?.removeListener(dispatchNewtabBookmarkCreated)
      bookmarks?.onRemoved?.removeListener(dispatchNewtabBookmarkRemoved)
      bookmarks?.onChanged?.removeListener(dispatchNewtabBookmarkChanged)
      bookmarks?.onMoved?.removeListener(dispatchNewtabBookmarkMoved)
      document.removeEventListener('keydown', dispatchNewtabDocumentKeyDown)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('hashchange', dispatchNewtabWindowHashChange)
      window.removeEventListener('message', dispatchNewtabWindowMessage)
      window.removeEventListener('pagehide', dispatchNewtabPageHide)
      window.removeEventListener('pointercancel', dispatchNewtabWindowPointerCancel)
      window.removeEventListener('pointermove', dispatchNewtabWindowPointerMove)
      window.removeEventListener('pointerup', dispatchNewtabWindowPointerUp)
      window.removeEventListener('resize', dispatchNewtabWindowResize)
    }
  }, [])

  return (
    <div {...appChromeAttributes} onPointerDownCapture={dispatchNewtabContentShellPointerDownCapture}>
      <NewtabInstantWallpaperHost />
      <NewtabBackgroundLayer loadingWallpaper={instantWallpaper.loading} />
      <SolidBackgroundNoiseLayer active={backgroundSettings.type === 'color'} />
      <NewtabWallpaperFilterLayer />
      <NewtabPaperShaderLayer />
      {backgroundSettings.ready ? (
        <div
          id="newtab-background-mask"
          className={getBackgroundMaskClass(backgroundSettings)}
          style={getBackgroundMaskInlineStyle(backgroundSettings)}
          data-mask-initial=""
          aria-hidden="true"
        ></div>
      ) : null}
      <WallpaperLoadingIndicator />

      <div
        className={cx(
          SETTINGS_TRIGGER_ZONE_BASE_CLASS,
          autoHideSettingsTrigger ? SETTINGS_TRIGGER_ZONE_AUTO_HIDE_CLASS : SETTINGS_TRIGGER_ZONE_VISIBLE_CLASS
        )}
      >
        <Button
          id="newtab-dashboard-trigger"
          className={getSettingsTriggerButtonClass(autoHideSettingsTrigger, DASHBOARD_TRIGGER_CLASS)}
          ref={dashboardTriggerRef}
          type="button"
          aria-label="打开书签仪表盘"
          aria-controls="newtab-dashboard-overlay"
          aria-expanded={dashboardOverlay.open ? 'true' : 'false'}
          {...settingsBackgroundProps}
          onClick={(event) => dispatchNewtabDashboardOverlayOpenRequest(event.currentTarget)}
          unstyled
        >
          <Icon name="Bookmark" size={18} aria-hidden="true" />
          <span className="sr-only">打开书签仪表盘</span>
        </Button>
        <span
          className={cx(
            DASHBOARD_SHORTCUT_HINT_BASE_CLASS,
            autoHideSettingsTrigger ? DASHBOARD_SHORTCUT_HINT_AUTO_HIDE_CLASS : DASHBOARD_SHORTCUT_HINT_VISIBLE_CLASS
          )}
          aria-hidden="true"
        >
          Ctrl/Cmd+K 快捷打开书签仪表盘
        </span>
        <Button
          id="newtab-settings-trigger"
          className={getSettingsTriggerButtonClass(autoHideSettingsTrigger)}
          ref={settingsTriggerRef}
          type="button"
          aria-label="打开设置"
          aria-controls="newtab-settings-drawer"
          aria-expanded={settingsDrawer.open ? 'true' : 'false'}
          {...settingsBackgroundProps}
          onClick={dispatchNewtabSettingsDrawerToggleRequest}
          unstyled
        >
          <Icon name="Settings" size={18} aria-hidden="true" />
        </Button>
      </div>

      <Button
        id="newtab-settings-backdrop"
        className={cx(
          SETTINGS_BACKDROP_BASE_CLASS,
          settingsDrawer.open ? SETTINGS_BACKDROP_OPEN_CLASS : ''
        )}
        ref={settingsBackdropRef}
        type="button"
        aria-label="关闭设置"
        data-close-settings
        onClick={() => dispatchNewtabSettingsDrawerOpenChange(false)}
        unstyled
      />
      <div
        id="newtab-root"
        className={NEWTAB_SHELL_CLASS}
        ref={shellRef}
        onContextMenu={dispatchNewtabContentShellContextMenu}
        {...settingsBackgroundProps}
      >
        <NewtabContentHost shellRef={shellRef} />
      </div>
      <NewtabDragLayerHost />
      <DashboardOverlayHost />
      <SettingsDrawerHost />
      <FeaturedBackgroundModalHost />
      <NewtabDeleteToastHost />
      <BookmarkMenusHost />
    </div>
  )
}

function SolidBackgroundNoiseLayer({ active }: { active: boolean }) {
  return (
    <div
      id="newtab-solid-background-noise"
      className={SOLID_BACKGROUND_NOISE_CLASS}
      data-active={active ? 'true' : 'false'}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" preserveAspectRatio="none" focusable="false">
        <filter id="newtab-solid-background-noise-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#newtab-solid-background-noise-filter)" />
      </svg>
    </div>
  )
}

function getBackgroundMaskClass(background: NewtabBackgroundSettingsView): string {
  return cx(
    BACKGROUND_MASK_BASE_CLASS,
    background.maskEnabled ? BACKGROUND_MASK_ENABLED_CLASS : '',
    background.maskEnabled ? getBackgroundMaskStyleClass(background.maskStyle) : ''
  )
}

function getBackgroundMaskStyleClass(maskStyle: string): string {
  if (!isLegacyBackgroundMaskStyle(maskStyle)) {
    return ''
  }
  return BACKGROUND_MASK_STYLE_CLASS_BY_STYLE[maskStyle]
}

function removeStartupBackgroundMask(): void {
  document.getElementById('newtab-startup-background-mask')?.remove()
  document.getElementById('newtab-startup-background-mask-style')?.remove()
  document.documentElement.style.removeProperty('--instant-wallpaper-mask-color')
  document.documentElement.style.removeProperty('--instant-wallpaper-mask-filter')
  document.documentElement.style.removeProperty('--instant-wallpaper-mask-image')
  delete document.documentElement.dataset.instantWallpaperMask
}

function getBackgroundMaskInlineStyle(background: NewtabBackgroundSettingsView): CSSProperties {
  if (!background.maskEnabled) {
    return {}
  }
  const backdropFilter = getBackgroundMaskBackdropFilter(background.maskStyle, background.maskBlur)
  return {
    backgroundColor: getBackgroundMaskBaseColor(background.maskStyle),
    backgroundImage: getBackgroundMaskOverlayGradient(background.maskOverlay),
    WebkitBackdropFilter: backdropFilter,
    backdropFilter
  }
}

function getSettingsTriggerButtonClass(autoHide: boolean, className = ''): string {
  return cx(
    SETTINGS_TRIGGER_BUTTON_BASE_CLASS,
    autoHide ? SETTINGS_TRIGGER_BUTTON_AUTO_HIDE_CLASS : SETTINGS_TRIGGER_BUTTON_VISIBLE_CLASS,
    className
  )
}

function WallpaperLoadingIndicator() {
  const instantWallpaper = useNewtabInstantWallpaperView()
  const visible = instantWallpaper.loading && instantWallpaper.loaderVisible

  return (
    <output
      className={cx(
        WALLPAPER_LOADING_INDICATOR_CLASS,
        visible ? WALLPAPER_LOADING_INDICATOR_VISIBLE_CLASS : WALLPAPER_LOADING_INDICATOR_HIDDEN_CLASS
      )}
      aria-live="polite"
      aria-label="正在加载背景图"
    >
      <div className={WALLPAPER_LOADING_CARD_CLASS}>
        <div className={WALLPAPER_LOADING_LOADER_CLASS} aria-hidden="true">
          <span className={WALLPAPER_LOADING_DOT_CLASS}></span>
          <span className={cx(WALLPAPER_LOADING_DOT_CLASS, '[animation-delay:120ms]')}></span>
          <span className={cx(WALLPAPER_LOADING_DOT_CLASS, '[animation-delay:240ms]')}></span>
        </div>
      </div>
    </output>
  )
}
