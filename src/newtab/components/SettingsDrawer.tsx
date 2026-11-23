import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject
} from 'react'
import { Button } from '../../ui/base/Button'
import { StatusMessage } from '../../ui/base/StatusMessage'
import { Popover } from '../../ui/base/Popover'
import { getMotionAwareScrollBehavior } from '../../shared/motion'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'
import { cx } from '../../ui/base/utils'
import { getFolderSourceSecondaryPath } from '../folder-source-presentation'
import { DrawerOverlay, DrawerPanel } from '../../ui/base/Drawer'
import { Icon } from '../../ui/icons/Icon'
import { Input } from '../../ui/base/Input'
import { Select } from '../../ui/base/Select'
import { SliderControl } from '../../ui/base/Slider'
import { DEFAULT_GLASS_SETTINGS, GLASS_SETTING_LIMITS, type NewtabGlassSettingKey } from '../glass-settings'
import { beginNewtabGlassEditSession, undoNewtabGlassEditSession, changeNewtabGlassSetting, resetNewtabGlassSettings, useNewtabGlassSettings } from '../newtab-glass-settings-store'
import { NewtabGlassSurface } from './NewtabGlassSurface'
import { Surface } from '../../ui/base/Surface'
import { SwitchControl } from '../../ui/base/Switch'
import { TabsIndicator, TabsList, TabsPanel, TabsRoot, TabsTab } from '../../ui/base/Tabs'
import { ToggleGroup } from '../../ui/base/ToggleGroup'
import {
  OPTION_SWITCH_CONTROL_CLASS,
  OPTION_SWITCH_THUMB_CLASS,
  OPTION_SWITCH_WRAP_CLASS
} from '../../ui/switch-classes'
import { SettingsDrawerClose } from './SettingsDrawerClose'
import { BookmarkIconShell } from './BookmarkIconShell'
import { getBookmarkTileClass, getBookmarkTitleClass } from './bookmarkTileClasses'
import { useBookmarkPreviewLayout } from './useBookmarkPreviewLayout'
import {
  ICON_PRESET_META,
  type IconLayoutPresetKey
} from '../icon-settings'
import {
  dispatchNewtabIconPresetApply,
  dispatchNewtabIconResetDefaults,
  dispatchNewtabIconSettingFieldChange,
  dispatchNewtabIconShowTitlesToggle,
  dispatchNewtabIconVerticalCenterToggle,
  useNewtabIconPreviewView,
  type NewtabIconSettingsFieldKey
} from '../newtab-icon-preview-store'
import {
  dispatchNewtabSearchLayoutReset,
  dispatchNewtabSearchSettingCommit,
  dispatchNewtabSearchSettingFieldChange,
  dispatchNewtabSearchSettingToggle,
  useNewtabSearchSettingsView
} from '../newtab-search-settings-store'
import { DEFAULT_SEARCH_LAYOUT, SEARCH_HEIGHT_MIN, SEARCH_HEIGHT_MAX, SEARCH_HEIGHT_STEP } from '../search-layout'
import {
  dispatchNewtabBackgroundFileSelect,
  dispatchNewtabBackgroundSettingFieldChange,
  dispatchNewtabBackgroundUrlCommit,
  useNewtabBackgroundSettingsView
} from '../newtab-background-settings-store'
import { NEWTAB_BACKGROUND_TYPE_OPTIONS } from '../newtab-background-types'
import type { SettingsDrawerSection } from '../settings-group-sync'
import { useSettingsDrawerModalMode } from '../settings-drawer-mode'
import {
  DEFAULT_WALLPAPER_ADJUSTMENTS,
  WALLPAPER_BLUR_MAX,
  WALLPAPER_DIM_MAX,
  WALLPAPER_MASK_PRESETS,
  WALLPAPER_MASK_STYLES
} from '../wallpaper-adjustments'
import {
  dispatchNewtabSettingsDrawerActiveGroupChange,
  dispatchNewtabSettingsDrawerOpenChange,
  dispatchNewtabSettingsDrawerReady,
  getNewtabSettingsDrawerNodes,
  getNewtabSettingsDrawerView,
  setNewtabSettingsDrawerNodes,
  useNewtabSettingsDrawerLayoutRequest,
  useNewtabSettingsDrawerView
} from '../newtab-settings-drawer-store'
import {
  dispatchNewtabModuleSettingToggle,
  useNewtabModuleSettingsView,
  type NewtabModuleSettingRowView
} from '../newtab-module-settings-store'
import {
  dispatchNewtabFolderCandidateFocus,
  dispatchNewtabFolderCandidateKeyDown,
  dispatchNewtabFolderCandidateQueryChange,
  dispatchNewtabFolderCandidateSearchKeyDown,
  dispatchNewtabFolderCandidateSelect,
  dispatchNewtabFolderCandidatesToggle,
  dispatchNewtabFolderHideNamesToggle,
  dispatchNewtabBrowseModeChange,
  dispatchNewtabGeneralSettingToggle,
  dispatchNewtabSelectedFolderRemove,
  useNewtabFolderCandidateFocusRequest,
  useNewtabFolderSourceView,
  type NewtabFolderCandidateFocusRequest,
  type NewtabFolderCandidateItemView,
  type NewtabFolderCandidateState,
  type NewtabSelectedFolderSourceItemView,
  type NewtabSelectedFolderSourceState
} from '../newtab-folder-source-store'

const settingsTabs = [
  ['source', '来源', true],
  ['appearance', '外观', false],
  ['glass', '玻璃', false],
  ['search', '搜索', false],
  ['advanced', '高级设置', false]
] as const

const DRAWER_PORTALED_CONTENT_ATTRIBUTES = { 'data-drawer-content': '' } as const
const SETTINGS_DRAWER_CLASS = 'fixed inset-0 z-[10020] overflow-hidden bg-transparent'
const SETTINGS_DRAWER_SURFACE_CLASS = 'settings-drawer-panel @container/settings isolate rounded-l-ds-dialog rounded-r-none border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-transparent text-ds-text-primary [box-shadow:var(--newtab-glass-drop-shadow)] [filter:none] [hanging-punctuation:allow-end] [line-break:strict] [text-autospace:normal] [text-spacing-trim:trim-start] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[hanging-punctuation:none] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[line-break:auto] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[text-autospace:no-autospace] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[text-spacing-trim:space-all]'
const SETTINGS_DRAWER_PANEL_CLASS = 'pointer-events-auto fixed inset-y-0 right-0 z-[1] grid h-dvh w-[min(520px,calc(100vw-24px))] max-w-full grid-rows-[minmax(0,1fr)] overflow-hidden opacity-100 [transform:translateX(var(--drawer-swipe-movement-x))] curator-drawer-motion data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:[transform:translateX(100%)] data-ending-style:[transform:translateX(100%)] motion-reduce:transition-opacity motion-reduce:duration-[80ms] motion-reduce:[transform:none] max-[600px]:w-full max-[600px]:rounded-none max-[600px]:border-x-0'
const SETTINGS_DRAWER_SCROLL_CLASS = 'settings-drawer-scroll h-full min-h-0 overflow-x-hidden overflow-y-auto px-6 pb-6 pt-4 @max-[440px]/settings:px-4 @max-[440px]/settings:pb-5'
const SETTINGS_ROOT_CLASS = 'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]'
const SETTINGS_CHROME_CLASS = 'settings-drawer-chrome grid gap-3 border-b border-ds-border-subtle px-6 pb-4 pt-4 @max-[440px]/settings:px-4'
const SETTINGS_HEADER_CLASS = 'grid min-h-10 grid-cols-[minmax(0,1fr)_96px_auto] items-center gap-x-3'
const SETTINGS_TITLE_CLASS = 'm-0 text-xl font-semibold leading-tight text-ds-text-primary'
const SETTINGS_SAVE_STATUS_CLASS = 'm-0 text-right text-xs font-medium leading-8 text-ds-text-secondary [align-content:safe_center]'
const SETTINGS_TABS_LIST_CLASS = 't-tabs grid grid-cols-5 gap-1 rounded-ds-md border-0 bg-[rgba(245,245,247,0.06)] p-1'
const SETTINGS_TAB_CLASS = 't-tab min-h-8 min-w-0 whitespace-nowrap rounded-ds-sm bg-transparent px-2 text-xs font-semibold outline-none hover:text-ds-text-primary data-[active]:text-ds-text-primary data-[selected]:text-ds-text-primary data-[state=active]:text-ds-text-primary focus-visible:shadow-ds-focus @max-[380px]/settings:px-0'
const SETTINGS_TABS_INDICATOR_CLASS = 't-tabs-pill'
const SETTINGS_TAB_PANELS_CLASS = 'settings-tab-panels grid min-w-0 items-start'
const SETTINGS_TAB_PANEL_CLASS = 'grid min-w-0 gap-4 outline-none [grid-area:1/1]'
const SETTINGS_NESTED_SURFACE_CLASS = 'border-0 rounded-ds-lg bg-[rgba(245,245,247,0.045)] shadow-none'
const SETTINGS_SEGMENTED_BUTTON_CLASS = 'min-h-7 min-w-20 rounded-ds-sm border border-transparent bg-transparent px-2 text-xs font-semibold text-ds-text-secondary shadow-none data-[pressed]:border-ds-border-hover data-[pressed]:bg-ds-selected data-[pressed]:text-ds-text-primary data-[pressed]:shadow-none'
const SETTINGS_PSEUDO_SHADOW_RESET_CLASS = '[&::before]:shadow-none [&::after]:shadow-none'
const SETTINGS_SECTION_CLASS = 'grid min-w-0 gap-2.5'
const SETTINGS_SECTION_TITLE_CLASS = 'm-0 text-sm font-semibold leading-snug text-ds-text-primary'
const SETTINGS_LIST_CLASS = 'grid gap-2'
const SETTINGS_INPUT_SURFACE_CLASS = 'border-ds-border rounded-ds-sm bg-[rgba(245,245,247,0.055)] text-ds-text-primary shadow-none'
const SETTINGS_INPUT_INTERACTION_CLASS = 'outline-none transition-colors duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary hover:shadow-none hover:outline-none focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const SETTINGS_CONTROL_CLASS = cx(SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_INPUT_INTERACTION_CLASS)
const SETTINGS_TEXT_INPUT_INTERACTION_CLASS = 'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus:bg-ds-hover focus:text-ds-text-primary disabled:cursor-not-allowed disabled:opacity-50'
const SETTINGS_TEXT_INPUT_CLASS = cx('h-9 min-h-9 w-full min-w-0 px-3 text-xs font-semibold', SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_TEXT_INPUT_INTERACTION_CLASS)
const SETTINGS_ROW_BASE_CLASS = 'settings-control-row grid min-h-12 min-w-0 items-center gap-3 rounded-ds-lg border-0 bg-[rgba(245,245,247,0.045)] p-2 @max-[440px]/settings:grid-cols-1 @max-[440px]/settings:justify-items-stretch'
const SETTINGS_ROW_CLASS = cx(SETTINGS_ROW_BASE_CLASS, 'grid-cols-[minmax(0,1fr)_auto]')
const SETTINGS_ROW_TEXT_INPUT_CLASS = cx(SETTINGS_ROW_BASE_CLASS, 'grid-cols-[auto_minmax(0,1fr)]', SETTINGS_PSEUDO_SHADOW_RESET_CLASS)
const SETTINGS_ROW_DISABLED_CLASS = 'opacity-60'
// Switch rows keep label and control side by side at every drawer width.
const SETTINGS_SWITCH_ROW_CLASS = 'settings-switch-row @max-[440px]/settings:grid-cols-[minmax(0,1fr)_auto]'
const SETTINGS_ROW_SLIDER_CLASS = 'grid-cols-[minmax(0,1fr)_minmax(150px,42%)]'
const SETTINGS_LABEL_STACK_CLASS = 'settings-label-stack grid min-w-0 gap-1'
const SETTINGS_LABEL_CLASS = 'min-w-0 text-sm font-semibold leading-5 text-ds-text-primary'
const SETTINGS_DESCRIPTION_CLASS = 'text-xs font-medium leading-5 text-ds-text-secondary'
const SETTINGS_VALUE_CLASS = 'text-ds-text-secondary tabular-nums'
const SETTINGS_SWITCH_WRAP_CLASS = OPTION_SWITCH_WRAP_CLASS
const SETTINGS_SWITCH_CLASS = OPTION_SWITCH_CONTROL_CLASS
const SETTINGS_SWITCH_THUMB_CLASS = OPTION_SWITCH_THUMB_CLASS
const SETTINGS_SLIDER_CLASS = 'min-w-36 @max-[440px]/settings:w-full'
const SETTINGS_SELECT_TRIGGER_CLASS = 'min-h-9 min-w-36 max-w-56 justify-between text-xs font-semibold @max-[440px]/settings:w-full @max-[440px]/settings:max-w-none'
const SETTINGS_SELECT_VALUE_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap'
const SETTINGS_SELECT_POPUP_CLASS = 'max-h-80'
const SETTINGS_SELECT_POSITIONER_CLASS = 'z-[10040]'
const SETTINGS_FIELD_CLASS = 'block min-w-0 @max-[440px]/settings:w-full'
const SETTINGS_NOTE_CLASS = 'm-0 text-xs leading-relaxed text-ds-text-secondary'
const SETTINGS_WIDE_BUTTON_CLASS = 'min-h-9 w-full justify-between px-3 text-xs font-semibold'
const SETTINGS_PICKER_BUTTON_CLASS = 'min-h-9 min-w-32 max-w-56 justify-center overflow-hidden px-3 text-xs font-semibold text-ellipsis whitespace-nowrap @max-[440px]/settings:w-full @max-[440px]/settings:max-w-none'
const SETTINGS_FILE_INPUT_CLASS = 'sr-only'
const SETTINGS_STATUS_CLASS = 'block min-h-8 rounded-ds-sm border border-ds-border bg-ds-surface-2 px-2.5 py-2 text-xs leading-snug text-ds-text-secondary data-[tone=error]:border-ds-danger/60 data-[tone=error]:text-ds-danger-text data-[tone=success]:text-ds-text-primary'
const FOLDER_STACK_CLASS = 'grid min-w-0 gap-2'
const FOLDER_SUMMARY_CLASS = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-ds-lg border-0 bg-ds-surface-2 p-2'
const FOLDER_SELECTED_COPY_CLASS = 'grid min-w-0 gap-0.5 p-1 text-xs leading-[18px] text-ds-text-secondary'
const FOLDER_REMOVE_BUTTON_CLASS = 'curator-compact-hit-target group/folder-remove inline-flex size-8 min-h-8 min-w-8 items-center justify-center rounded-ds-sm border border-ds-border-subtle bg-ds-surface-2 p-0 text-ds-text-secondary outline-none transition-[background-color,border-color,color,scale] duration-ds-fast ease-ds-standard hover:border-ds-danger/45 hover:bg-ds-danger-soft hover:text-ds-danger-text focus-visible:border-ds-danger/55 focus-visible:bg-ds-danger-soft focus-visible:text-ds-danger-text focus-visible:shadow-ds-focus active:scale-[var(--ds-press-scale)] motion-reduce:transition-colors motion-reduce:active:scale-100 [&_svg]:size-[15px] [&_svg]:stroke-[1.9]'
const FOLDER_EMPTY_CLASS = SETTINGS_NOTE_CLASS
const FOLDER_CANDIDATES_PANEL_CLASS = cx('grid gap-2 p-2', SETTINGS_NESTED_SURFACE_CLASS)
const FOLDER_CANDIDATE_LIST_CLASS = 'ds-scrollbar grid max-h-56 gap-1 overflow-y-auto'
const FOLDER_CANDIDATE_CARD_CLASS = 'folder-candidate-card grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-ds-sm border border-transparent bg-transparent px-2.5 py-2 text-left text-ds-text-primary outline-none transition-colors duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover active:bg-ds-active aria-pressed:border-ds-border-hover aria-pressed:bg-ds-selected aria-pressed:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:shadow-ds-focus'
const FOLDER_CANDIDATE_COPY_CLASS = 'grid min-w-0 gap-0.5'
const FOLDER_CANDIDATE_TITLE_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold leading-snug text-ds-text-primary'
const FOLDER_CANDIDATE_META_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-snug text-ds-text-secondary'
const FOLDER_CANDIDATE_BADGE_CLASS = 'inline-flex min-h-5 items-center justify-center rounded-full bg-ds-surface-1 px-2 text-xs font-semibold text-ds-text-secondary whitespace-nowrap'
const MODULE_SWITCH_LABEL_CLASS = SETTINGS_SWITCH_WRAP_CLASS
const SETTING_COLOR_CLASS = 'inline-grid min-h-9 min-w-40 grid-cols-[minmax(0,1fr)_34px] items-center gap-2 overflow-hidden rounded-ds-menu border border-ds-border bg-ds-surface-2 ds-inset-menu pl-3'
const SETTING_COLOR_VALUE_CLASS = 'text-xs font-semibold text-ds-text-primary'
const SETTING_COLOR_INPUT_CLASS = 'h-7 min-h-7 w-8 min-w-8 overflow-hidden rounded-ds-sm border-0 bg-transparent p-0'
const ICON_PREVIEW_PANEL_CLASS = 'grid gap-3 rounded-ds-card border-0 bg-ds-surface-2 p-2'
const ICON_PREVIEW_HEADER_CLASS = 'grid gap-1 px-2 pt-1 text-xs font-semibold leading-5 text-ds-text-primary'
const ICON_PREVIEW_SUMMARY_CLASS = 'min-w-0 text-xs font-medium leading-relaxed text-ds-text-secondary'
const ICON_LIVE_PREVIEW_CLASS = 'ds-scrollbar m-0 overflow-x-auto rounded-ds-lg border border-ds-border bg-ds-app px-2.5 py-4 outline-none focus-visible:shadow-ds-focus'
const ICON_LIVE_PREVIEW_GRID_CLASS = 'mx-auto grid w-[var(--preview-grid-max-width)] content-center [column-gap:var(--preview-column-gap)] [row-gap:var(--preview-row-gap)]'
const ICON_PRESET_ROW_CLASS = 'grid grid-cols-3 gap-2'
const ICON_PRESET_CARD_CLASS = 'curator-control group/preset grid min-h-[104px] min-w-0 content-center gap-2.5 rounded-ds-lg border border-ds-border-subtle bg-ds-surface-1 ds-inset-panel text-left text-ds-text-secondary outline-none hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary aria-pressed:border-ds-focus aria-pressed:bg-ds-selected aria-pressed:text-ds-text-primary aria-pressed:shadow-[inset_0_1px_0_rgba(245,245,247,0.16)] focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-ds-focus'
const ICON_PRESET_PREVIEW_CLASS = 'grid h-[52px] content-center rounded-ds-sm bg-ds-app ring-1 ring-inset ring-ds-border-subtle/60 group-aria-pressed/preset:ring-ds-border'
const ICON_PRESET_PREVIEW_CELL_CLASS = 'block rounded-ds-xs bg-ds-text-primary/20 transition-colors duration-ds-fast ease-ds-standard group-hover/preset:bg-ds-text-primary/32 group-aria-pressed/preset:bg-ds-text-primary/58'
const ICON_PRESET_NAME_CLASS = 'min-w-0 overflow-hidden text-ellipsis px-1 pb-1 text-xs font-semibold leading-5 text-ds-text-secondary transition-colors duration-ds-fast ease-ds-standard group-hover/preset:text-ds-text-primary group-aria-pressed/preset:text-ds-text-primary'

const BROWSE_MODE_ITEMS = [
  { value: 'expanded', label: '平铺书签', attributes: { 'data-browse-mode': 'expanded' } },
  { value: 'navigation', label: '逐级浏览', attributes: { 'data-browse-mode': 'navigation' } }
]
const ICON_LAYOUT_MODE_ITEMS = [
  { value: 'auto', label: '自动适配', attributes: { 'data-icon-layout-mode': 'auto' } },
  { value: 'fixed', label: '固定列数', attributes: { 'data-icon-layout-mode': 'fixed' } }
]
const ICON_TITLE_LINES_ITEMS = [
  { value: '1', label: '1 行', attributes: { 'data-icon-title-lines': '1' } },
  { value: '2', label: '2 行', attributes: { 'data-icon-title-lines': '2' } }
]
const SETTINGS_SEGMENTED_CLASS = 'inline-flex min-h-9 items-center gap-1 rounded-ds-menu border border-ds-border bg-ds-surface-2 ds-inset-menu @max-[440px]/settings:w-full'
const ICON_CONTROL_ROW_CLASS = 'grid-cols-[minmax(0,1fr)_auto]'
const SETTINGS_SCROLLBAR_MIN_THUMB_HEIGHT = 40

function settingsControlClassName(...classNames: Array<string | false | null | undefined>): string {
  return cx(SETTINGS_CONTROL_CLASS, ...classNames)
}

function settingsInputClassName(...classNames: Array<string | false | null | undefined>): string {
  return cx(SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_INPUT_INTERACTION_CLASS, ...classNames)
}

type SettingsSectionRef = (element: HTMLElement | null) => void

function SettingsSectionHeader({ id, title, children }: {
  id: string
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="settings-section-header flex min-h-8 items-center justify-between gap-3">
      <h2 id={id} className={SETTINGS_SECTION_TITLE_CLASS}>{title}</h2>
      {children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}
    </div>
  )
}

function settingRowClassName(...classNames: Array<string | false | null | undefined>): string {
  return cx(SETTINGS_ROW_CLASS, SETTINGS_PSEUDO_SHADOW_RESET_CLASS, ...classNames)
}

function SettingLabelStack({
  title,
  description,
  descriptionId,
  titleId
}: {
  title: ReactNode
  description?: ReactNode
  descriptionId?: string
  titleId?: string
}) {
  return (
    <span className={SETTINGS_LABEL_STACK_CLASS}>
      <span id={titleId} className={SETTINGS_LABEL_CLASS}>{title}</span>
      {description ? <small id={descriptionId} className={SETTINGS_DESCRIPTION_CLASS}>{description}</small> : null}
    </span>
  )
}

function SwitchRow({
  id,
  title,
  description,
  checked,
  defaultChecked = false,
  disabled = false,
  controlRef,
  onCheckedChange,
  hidden = false
}: {
  id: string
  title: string
  description?: string
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  controlRef?: Ref<HTMLElement>
  onCheckedChange?: (checked: boolean) => void
  hidden?: boolean
}) {
  const labelId = `${id}-label`
  const descriptionId = `${id}-description`

  return (
    <div className={settingRowClassName(SETTINGS_SWITCH_ROW_CLASS, disabled ? SETTINGS_ROW_DISABLED_CLASS : undefined)} hidden={hidden}>
      <SettingLabelStack title={title} titleId={labelId} description={description} descriptionId={descriptionId} />
      <span className={SETTINGS_SWITCH_WRAP_CLASS}>
        <SwitchControl
          id={id}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          className={SETTINGS_SWITCH_CLASS}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
          rootRef={controlRef}
          syncInputState
          thumbClassName={SETTINGS_SWITCH_THUMB_CLASS}
          unstyled
        />
      </span>
    </div>
  )
}

function SliderRow({
  id,
  label,
  valueId,
  value,
  min,
  max,
  defaultValue,
  ariaLabel,
  rowId,
  hidden = false,
  description,
  disabled = false,
  onValueChange,
  onValueCommitted,
  sliderValue,
  ticks,
  step = 1
}: {
  id: string
  label: string
  valueId: string
  value: string
  min: string
  max: string
  defaultValue: string
  ariaLabel: string
  rowId?: string
  hidden?: boolean
  description?: string
  disabled?: boolean
  onValueChange?: (value: number) => void
  onValueCommitted?: (value: number) => void
  sliderValue: number
  ticks?: readonly [string, string, string]
  step?: number
}) {
  return (
    <label id={rowId} className={settingRowClassName(SETTINGS_ROW_SLIDER_CLASS, disabled ? SETTINGS_ROW_DISABLED_CLASS : undefined)} hidden={hidden}>
      <span className={description ? SETTINGS_LABEL_STACK_CLASS : SETTINGS_LABEL_CLASS}>
        <span className={description ? SETTINGS_LABEL_CLASS : undefined}>
          {label} <output id={valueId} className={SETTINGS_VALUE_CLASS}>{value}</output>
        </span>
        {description ? <small className={SETTINGS_DESCRIPTION_CLASS}>{description}</small> : null}
      </span>
      <span className="grid min-w-36 gap-1.5 @max-[440px]/settings:w-full">
        <SliderControl
          id={id}
          ariaLabel={ariaLabel}
          className={SETTINGS_SLIDER_CLASS}
          defaultValue={defaultValue}
          disabled={disabled}
          max={max}
          min={min}
          step={step}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          value={sliderValue}
        />
        {ticks ? (
          <span className="flex justify-between px-0.5 text-xs leading-4 text-ds-text-tertiary" aria-hidden="true">
            {ticks.map((tick) => <span key={tick}>{tick}</span>)}
          </span>
        ) : null}
      </span>
    </label>
  )
}

function SettingsSelect({
  id,
  label,
  description,
  ariaLabel,
  defaultValue,
  options,
  portalContainer,
  disabled = false,
  onValueChange,
  value,
  triggerRef
}: {
  id: string
  label: string
  description?: string
  ariaLabel: string
  defaultValue?: string
  options: Array<readonly [string, string]>
  portalContainer?: HTMLElement | null
  disabled?: boolean
  onValueChange?: (value: string | null) => void
  value?: string | null
  triggerRef?: Ref<HTMLButtonElement>
}) {
  return (
    <div className={settingRowClassName(disabled ? SETTINGS_ROW_DISABLED_CLASS : undefined)}>
      <SettingLabelStack title={label} description={description} />
      <Select
        id={id}
        ariaLabel={ariaLabel}
        defaultValue={defaultValue}
        disabled={disabled}
        onValueChange={onValueChange}
        options={options.map(([value, label]) => ({ value, label }))}
        modal={false}
        popupClassName={SETTINGS_SELECT_POPUP_CLASS}
        popupAttributes={DRAWER_PORTALED_CONTENT_ATTRIBUTES}
        portalContainer={portalContainer}
        positionerClassName={SETTINGS_SELECT_POSITIONER_CLASS}
        syncInputState
        triggerClassName={SETTINGS_SELECT_TRIGGER_CLASS}
        triggerRef={triggerRef}
        value={value}
        valueClassName={SETTINGS_SELECT_VALUE_CLASS}
      />
    </div>
  )
}

function SettingsDetails({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <CollapsibleRoot>
      <CollapsibleTrigger
        id={`${id}-toggle`}
        className={settingsControlClassName(SETTINGS_WIDE_BUTTON_CLASS, 'flex items-center gap-3 text-left')}
        aria-controls={`${id}-panel`}
      >
        <span>{title}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel id={`${id}-panel`} className={SETTINGS_LIST_CLASS} keepMounted={false}>
        {children}
      </CollapsiblePanel>
    </CollapsibleRoot>
  )
}

export interface SettingsDrawerProps {
  open: boolean
  activeGroup: SettingsDrawerSection
  onActiveGroupChange: (group: SettingsDrawerSection) => void
  onOpenChange: (open: boolean, event?: Event) => void
}

function SettingsDrawerHeader({ closeButtonRef }: { closeButtonRef: Ref<HTMLButtonElement> }) {
  const view = useNewtabSettingsDrawerView()
  const glass = useNewtabGlassSettings()
  const glassError = view.saveState !== 'error' && glass.saveState === 'error'
  const saveState = glassError ? 'error' : view.saveState
  const detailMessage = view.saveState === 'error'
    ? view.saveMessage
    : glassError
      ? '设置保存失败，请重试。'
      : view.saveMessage

  return (
    <header className={SETTINGS_HEADER_CLASS}>
      <h1 id="newtab-settings-title" className={SETTINGS_TITLE_CLASS}>新标签页设置</h1>
      <StatusMessage
        id="settings-save-status"
        className={SETTINGS_SAVE_STATUS_CLASS}
        lines={1}
        tone={saveState === 'error' ? 'error' : 'neutral'}
        data-state={saveState}
        title={view.saveMessage || (glassError ? '设置保存失败，请重试。' : undefined)}
        aria-label={saveState === 'error' ? detailMessage : undefined}
        style={{ overflow: 'visible', scrollbarGutter: 'auto' }}
      >
        {saveState === 'error' ? (
          <Popover
            title="设置保存失败"
            align="end"
            sideOffset={8}
            collisionPadding={16}
            showArrow={false}
            popupClassName="w-[min(320px,calc(100vw_-_32px))] max-h-[min(320px,var(--available-height))] overflow-auto"
            trigger={<Button size="sm" variant="ghost" className="w-full justify-end gap-1 px-1.5 !text-ds-danger-text hover:bg-ds-danger-soft hover:!text-ds-danger-text" aria-label="查看保存失败详情">
              <Icon name="AlertTriangle" size={13} aria-hidden="true" className="shrink-0" />
              <span><span className="sr-only">设置</span>保存失败</span>
            </Button>}
          >
            <p className="m-0 text-sm leading-relaxed [overflow-wrap:anywhere]">{detailMessage}</p>
          </Popover>
        ) : saveState === 'idle' ? '' : view.saveMessage}
      </StatusMessage>
      <SettingsDrawerClose buttonRef={closeButtonRef} className={SETTINGS_CONTROL_CLASS} />
    </header>
  )
}

function SettingsDrawerTabs() {
  return (
    <TabsList className={SETTINGS_TABS_LIST_CLASS} aria-label="新标签页设置分组">
      {settingsTabs.map(([group, label]) => (
        <TabsTab
          className={SETTINGS_TAB_CLASS}
          value={group}
          id={`settings-tab-${group}`}
          key={group}
        >
          {label}
        </TabsTab>
      ))}
      <TabsIndicator className={SETTINGS_TABS_INDICATOR_CLASS} />
    </TabsList>
  )
}

function SettingsTabPanel({
  active,
  visited,
  value,
  children
}: {
  active: boolean
  visited: boolean
  value: SettingsDrawerSection
  children: ReactNode
}) {
  const mounted = active || visited
  return (
    <TabsPanel
      className={SETTINGS_TAB_PANEL_CLASS}
      id={`settings-panel-${value}`}
      value={value}
      keepMounted={mounted}
    >
      {mounted ? children : null}
    </TabsPanel>
  )
}

interface SettingsScrollBarState {
  hidden: boolean
  thumbHeight: number
  thumbTop: number
}

const SETTINGS_SCROLLBAR_HIDDEN_STATE: SettingsScrollBarState = {
  hidden: true,
  thumbHeight: 100,
  thumbTop: 0
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getSettingsScrollBarState(
  scrollHost: HTMLElement | null,
  trackElement: HTMLElement | null
): SettingsScrollBarState {
  if (!scrollHost || scrollHost.scrollHeight <= scrollHost.clientHeight + 1) {
    return SETTINGS_SCROLLBAR_HIDDEN_STATE
  }

  const trackHeight = Math.max(trackElement?.clientHeight || scrollHost.clientHeight, 1)
  const maxScroll = Math.max(scrollHost.scrollHeight - scrollHost.clientHeight, 1)
  const minThumbHeight = (SETTINGS_SCROLLBAR_MIN_THUMB_HEIGHT / trackHeight) * 100
  const thumbHeight = clampNumber((scrollHost.clientHeight / scrollHost.scrollHeight) * 100, minThumbHeight, 100)
  const thumbTop = clampNumber((scrollHost.scrollTop / maxScroll) * (100 - thumbHeight), 0, 100 - thumbHeight)

  return {
    hidden: false,
    thumbHeight: Number(thumbHeight.toFixed(3)),
    thumbTop: Number(thumbTop.toFixed(3))
  }
}

function SettingsDrawerScrollBar({
  activeGroup,
  open,
  scrollHostRef
}: {
  activeGroup: SettingsDrawerSection
  open: boolean
  scrollHostRef: RefObject<HTMLDivElement | null>
}) {
  const [dragging, setDragging] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLSpanElement | null>(null)
  const dragThumbOffsetRef = useRef<number | null>(null)
  const syncFrameRef = useRef(0)

  const syncScrollBarNow = useCallback(() => {
    syncFrameRef.current = 0
    const nextState = getSettingsScrollBarState(scrollHostRef.current, trackRef.current)
    const root = rootRef.current
    const thumb = thumbRef.current
    if (!root || !thumb) {
      return
    }
    thumb.style.transform = `translate3d(0, ${nextState.thumbTop}%, 0) scaleY(${nextState.thumbHeight / 100})`
    root.dataset.visible = open && !nextState.hidden ? 'true' : 'false'
  }, [open, scrollHostRef])

  const syncScrollBar = useCallback(() => {
    if (syncFrameRef.current) {
      return
    }
    syncFrameRef.current = window.requestAnimationFrame(syncScrollBarNow)
  }, [syncScrollBarNow])

  const scrollToClientY = useCallback((clientY: number) => {
    const scrollHost = scrollHostRef.current
    const trackElement = trackRef.current

    if (!scrollHost || !trackElement) {
      return
    }

    const maxScroll = scrollHost.scrollHeight - scrollHost.clientHeight

    if (maxScroll <= 0) {
      return
    }

    const trackRect = trackElement.getBoundingClientRect()
    const thumbHeight = clampNumber(
      (scrollHost.clientHeight / scrollHost.scrollHeight) * trackRect.height,
      SETTINGS_SCROLLBAR_MIN_THUMB_HEIGHT,
      trackRect.height
    )
    const maxThumbTop = Math.max(trackRect.height - thumbHeight, 1)
    const thumbOffset = dragThumbOffsetRef.current ?? thumbHeight / 2
    const thumbTop = clampNumber(clientY - trackRect.top - thumbOffset, 0, maxThumbTop)

    scrollHost.scrollTop = (thumbTop / maxThumbTop) * maxScroll
  }, [scrollHostRef])
  const scrollToClientYFromEffect = useEffectEvent((clientY: number) => {
    scrollToClientY(clientY)
  })

  useLayoutEffect(() => {
    const scrollHost = scrollHostRef.current

    if (!scrollHost) {
      if (rootRef.current) {
        rootRef.current.dataset.visible = 'false'
      }
      return
    }

    syncScrollBar()
    scrollHost.addEventListener('scroll', syncScrollBar, { passive: true })

    const contentElement = scrollHost.firstElementChild
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(syncScrollBar)

    resizeObserver?.observe(scrollHost)

    if (contentElement) {
      resizeObserver?.observe(contentElement)
    }

    window.addEventListener('resize', syncScrollBar)
    const frameId = window.requestAnimationFrame(syncScrollBar)

    return () => {
      scrollHost.removeEventListener('scroll', syncScrollBar)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', syncScrollBar)
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(syncFrameRef.current)
      syncFrameRef.current = 0
    }
  }, [activeGroup, syncScrollBar, scrollHostRef])

  useLayoutEffect(() => {
    syncScrollBar()
  }, [open, syncScrollBar])

  useEffect(() => {
    if (!dragging) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault()
      scrollToClientYFromEffect(event.clientY)
    }
    const handlePointerUp = () => {
      dragThumbOffsetRef.current = null
      setDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [dragging])

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    dragThumbOffsetRef.current = null
    scrollToClientY(event.clientY)
    setDragging(true)
  }

  const handleThumbPointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    dragThumbOffsetRef.current = event.clientY - event.currentTarget.getBoundingClientRect().top
    setDragging(true)
  }

  return (
    <div
      aria-hidden="true"
      className="settings-drawer-scrollbar"
      data-dragging={dragging ? 'true' : 'false'}
      data-visible="false"
      ref={rootRef}
    >
      <div
        className="settings-drawer-scrollbar-track"
        onPointerDown={handleTrackPointerDown}
        ref={trackRef}
      >
        <span
          className="settings-drawer-scrollbar-thumb"
          onPointerDown={handleThumbPointerDown}
          ref={thumbRef}
        />
      </div>
    </div>
  )
}

const AdvancedSettingsSection = memo(function AdvancedSettingsSection({
  firstControlRef,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLElement>
  sectionRef?: SettingsSectionRef
}) {
  const folderSource = useNewtabFolderSourceView()
  const moduleSettings = useNewtabModuleSettingsView()

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="advanced" aria-labelledby="settings-general-title">
      <h2 id="settings-general-title" className="sr-only">高级</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <SwitchRow
          id="general-hide-settings-trigger"
          title="隐藏设置图标"
          description="开启后默认隐藏入口，鼠标悬停于右上角时渐显；触屏设备始终可见。"
          controlRef={firstControlRef}
          checked={folderSource.general.hideSettingsTrigger}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('hideSettingsTrigger', checked)
          }}
        />
        <SwitchRow
          id="general-open-bookmarks-new-tab"
          title="在新标签页打开书签"
          checked={folderSource.general.openBookmarksInNewTab}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('openBookmarksInNewTab', checked)
          }}
        />
        {moduleSettings.rows.map((row) => (
          <ModuleSettingRow row={row} key={row.key} />
        ))}
      </Surface>
    </section>
  )
})

const SourceSettingsSection = memo(function SourceSettingsSection({
  firstControlRef,
  folderCandidateSearchRef,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLElement>
  folderCandidateSearchRef: RefObject<HTMLInputElement | null>
  sectionRef?: SettingsSectionRef
}) {
  const folderSource = useNewtabFolderSourceView()
  const folderCandidateFocusRequest = useNewtabFolderCandidateFocusRequest()
  const candidatesExpanded = folderSource.candidatesExpanded

  useEffect(() => {
    if (folderCandidateFocusRequest.requestId === 0 ||
      folderCandidateFocusRequest.target !== 'search') {
      return
    }
    folderCandidateSearchRef.current?.focus({ preventScroll: folderCandidateFocusRequest.preventScroll })
  }, [folderCandidateFocusRequest, folderCandidateSearchRef])

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="source" aria-labelledby="settings-folder-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="settings-folder-title" className={SETTINGS_SECTION_TITLE_CLASS}>书签来源</h2>
        <span id="folder-selected-count" className="text-xs text-ds-text-secondary tabular-nums" aria-label={`已选 ${folderSource.selectedCount} 个来源文件夹`}>{folderSource.selectedCount}</span>
      </div>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <div className={FOLDER_STACK_CLASS}>
          <div id="folder-selected-list" className={FOLDER_STACK_CLASS}>
            <SelectedFolderSourceList state={folderSource.selected} />
          </div>
          <CollapsibleRoot
            open={candidatesExpanded}
            onOpenChange={(nextOpen) => {
              if (nextOpen !== candidatesExpanded) {
                dispatchNewtabFolderCandidatesToggle()
              }
            }}
          >
            <CollapsibleTrigger
              id="folder-candidates-toggle"
              ref={firstControlRef as Ref<HTMLButtonElement>}
              className={settingsControlClassName(SETTINGS_WIDE_BUTTON_CLASS)}
              type="button"
              aria-controls="folder-candidates-panel"
            >
              <span data-folder-toggle-label>
                {candidatesExpanded ? '完成选择' : '添加来源文件夹'}
              </span>
            </CollapsibleTrigger>
            <CollapsiblePanel
              id="folder-candidates-panel"
              className={FOLDER_CANDIDATES_PANEL_CLASS}
              keepMounted={false}
            >
              <div className={FOLDER_STACK_CLASS}>
                <label className={SETTINGS_FIELD_CLASS} htmlFor="folder-candidate-search">
                  <Input
                    id="folder-candidate-search"
                    className={SETTINGS_TEXT_INPUT_CLASS}
                    type="search"
                    ref={folderCandidateSearchRef}
                    placeholder="搜索文件夹"
                    aria-label="搜索候选文件夹"
                    aria-controls="folder-candidate-list"
                    spellCheck={false}
                    value={folderSource.candidateQuery}
                    onValueChange={dispatchNewtabFolderCandidateQueryChange}
                    onKeyDown={(event) => {
                      if (dispatchNewtabFolderCandidateSearchKeyDown(event.key)) {
                        event.preventDefault()
                        event.stopPropagation()
                      }
                    }}
                    unstyled
                  />
                </label>
                <div
                  id="folder-candidate-list"
                  className={FOLDER_CANDIDATE_LIST_CLASS}
                  aria-label="候选文件夹列表"
                  data-squircle-subtree="off"
                >
                  <FolderCandidateList
                    focusRequest={folderCandidateFocusRequest}
                    state={folderSource.candidates}
                  />
                </div>
              </div>
            </CollapsiblePanel>
          </CollapsibleRoot>
        </div>
      </Surface>
      <Surface className={cx(SETTINGS_LIST_CLASS, 'mt-1.5')} variant="plain">
        <div className={settingRowClassName(ICON_CONTROL_ROW_CLASS)}>
          <SettingLabelStack
            title="浏览方式"
          />
          <ToggleGroup
            id="folder-browse-mode-control"
            slidingIndicator
            aria-label="浏览方式"
            className={SETTINGS_SEGMENTED_CLASS}
            itemClassName={settingsControlClassName(SETTINGS_SEGMENTED_BUTTON_CLASS)}
            onValueChange={(value) => {
              const nextValue = value[0]
              if (nextValue === 'expanded' || nextValue === 'navigation') {
                dispatchNewtabBrowseModeChange(nextValue)
              }
            }}
            items={BROWSE_MODE_ITEMS}
            unstyled
            value={folderSource.browseMode}
          />
        </div>
        <SwitchRow
          id="folder-hide-names"
          title="隐藏文件夹名"
          checked={folderSource.hideFolderNames}
          onCheckedChange={dispatchNewtabFolderHideNamesToggle}
        />
        <SwitchRow
          id="folder-show-source-navigation"
          title="显示来源导航"
          checked={folderSource.general.showSourceNavigation}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('showSourceNavigation', checked)
          }}
        />
      </Surface>
    </section>
  )
})

function SelectedFolderSourceList({ state }: { state: NewtabSelectedFolderSourceState }) {
  if (state.type === 'empty') {
    return <p className={FOLDER_EMPTY_CLASS}>{state.message}</p>
  }

  return (
    <>
      {state.items.map((item) => (
        <div className={FOLDER_SUMMARY_CLASS} key={item.folderId}>
          <span className={FOLDER_SELECTED_COPY_CLASS}>
            <strong className={SETTINGS_LABEL_CLASS}>{item.title}</strong>
            {getFolderSourceSecondaryPath(item.title, item.path) ? (
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.path}</span>
            ) : null}
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.stats}</span>
          </span>
          <Button
            className={FOLDER_REMOVE_BUTTON_CLASS}
            type="button"
            data-folder-remove-id={item.folderId}
            aria-label={getFolderSourceRemoveLabel(item)}
            title={getFolderSourceRemoveLabel(item)}
            onClick={() => {
              dispatchNewtabSelectedFolderRemove(item.folderId)
            }}
            unstyled
          >
            <Icon name="Trash2" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </>
  )
}

function getFolderSourceRemoveLabel(item: NewtabSelectedFolderSourceItemView): string {
  return `从新标签页移除「${item.title || '文件夹'}」，将隐藏 ${item.affectedCount} 个书签，不会删除书签`
}

function FolderCandidateList({
  focusRequest,
  state
}: {
  focusRequest: NewtabFolderCandidateFocusRequest
  state: NewtabFolderCandidateState
}) {
  const candidateRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (focusRequest.requestId === 0 ||
      focusRequest.target !== 'candidate' ||
      !focusRequest.folderId) {
      return
    }
    candidateRefs.current.get(focusRequest.folderId)?.focus({ preventScroll: focusRequest.preventScroll })
  }, [focusRequest])

  const setCandidateRef = (folderId: string) => (element: HTMLButtonElement | null) => {
    if (element) {
      candidateRefs.current.set(folderId, element)
      return
    }
    candidateRefs.current.delete(folderId)
  }

  if (state.type === 'empty') {
    return (
      <p className={FOLDER_EMPTY_CLASS} role="status" aria-live="polite">
        {state.message}
      </p>
    )
  }

  return (
    <>
      {state.items.map((item) => (
        <FolderCandidateItem
          buttonRef={setCandidateRef(item.folderId)}
          item={item}
          key={item.folderId}
        />
      ))}
    </>
  )
}

function FolderCandidateItem({
  buttonRef,
  item
}: {
  buttonRef: (element: HTMLButtonElement | null) => void
  item: NewtabFolderCandidateItemView
}) {
  return (
    <Button
      className={FOLDER_CANDIDATE_CARD_CLASS}
      type="button"
      ref={buttonRef}
      tabIndex={item.active ? 0 : -1}
      title={item.path || item.title}
      aria-pressed={item.selected}
      onClick={() => {
        dispatchNewtabFolderCandidateSelect(item.folderId)
      }}
      onFocus={() => {
        dispatchNewtabFolderCandidateFocus(item.folderId)
      }}
      onKeyDown={(event) => {
        if (dispatchNewtabFolderCandidateKeyDown(event.key, item.folderId)) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      unstyled
    >
      <span className={FOLDER_CANDIDATE_COPY_CLASS}>
        <strong className={FOLDER_CANDIDATE_TITLE_CLASS}>{item.title || '未命名文件夹'}</strong>
        <span className={FOLDER_CANDIDATE_META_CLASS}>{[getFolderSourceSecondaryPath(item.title || '未命名文件夹', item.path), item.stats].filter(Boolean).join(' · ')}</span>
      </span>
      <span className={FOLDER_CANDIDATE_BADGE_CLASS}>{item.badge}</span>
    </Button>
  )
}

function ModuleSettingRow({
  controlRef,
  row
}: {
  controlRef?: Ref<HTMLElement>
  row: NewtabModuleSettingRowView
}) {
  return (
    <div className={settingRowClassName(SETTINGS_SWITCH_ROW_CLASS)} data-module-row={row.key}>
      <SettingLabelStack title={row.label} />
      <span className={MODULE_SWITCH_LABEL_CLASS}>
        <SwitchControl
          aria-label={`${row.enabled ? '隐藏' : '显示'}模块：${row.label}`}
          checked={row.enabled}
          className={SETTINGS_SWITCH_CLASS}
          data-module-setting-toggle={row.key}
          onCheckedChange={(checked) => {
            dispatchNewtabModuleSettingToggle(row.key, checked)
          }}
          rootRef={controlRef}
          syncInputState
          thumbClassName={SETTINGS_SWITCH_THUMB_CLASS}
          unstyled
        />
      </span>
    </div>
  )
}

function handleBackgroundFileChange(mediaType: 'image' | 'video', file: File | null): void {
  if (!file) return
  dispatchNewtabBackgroundFileSelect(mediaType, file)
}

const BackgroundSettingsSection = memo(function BackgroundSettingsSection({
  firstControlRef,
  panelElement,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLButtonElement>
  panelElement: HTMLElement | null
  sectionRef?: SettingsSectionRef
}) {
  const backgroundSettings = useNewtabBackgroundSettingsView()
  const imageFileInputRef = useRef<HTMLInputElement | null>(null)
  const videoFileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="appearance" aria-labelledby="settings-background-title">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <h2 id="settings-background-title" className={SETTINGS_SECTION_TITLE_CLASS}>背景</h2>
        <StatusMessage
          id="background-status"
          className="m-0 text-right text-xs leading-5 text-ds-text-secondary [align-content:safe_center]"
          lines={1}
          tone={backgroundSettings.backgroundStatusTone === 'error' ? 'error' : backgroundSettings.backgroundStatusTone === 'warning' ? 'warning' : 'neutral'}
          title={backgroundSettings.backgroundStatus || undefined}
        >
          {backgroundSettings.backgroundStatus}
        </StatusMessage>
      </div>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <SettingsSelect
          id="background-type"
          label="背景类型"
          ariaLabel="背景类型"
          onValueChange={(value) => {
            if (value) dispatchNewtabBackgroundSettingFieldChange('type', value)
          }}
          portalContainer={panelElement}
          triggerRef={firstControlRef}
          value={backgroundSettings.type}
          options={[...NEWTAB_BACKGROUND_TYPE_OPTIONS]}
        />
        <label id="background-color-row" className={settingRowClassName()} htmlFor="background-color" hidden={backgroundSettings.type !== 'color'}>
          <span className={SETTINGS_LABEL_CLASS}>背景颜色</span>
          <span id="background-color-control" className={SETTING_COLOR_CLASS}>
            <span id="background-color-value" className={SETTING_COLOR_VALUE_CLASS}>{backgroundSettings.color.toUpperCase()}</span>
            <Input
              id="background-color"
              className={settingsInputClassName(SETTING_COLOR_INPUT_CLASS)}
              type="color"
              value={backgroundSettings.color}
              onChange={(event) => dispatchNewtabBackgroundSettingFieldChange('color', event.currentTarget.value)}
              aria-label="背景颜色"
              unstyled
            />
          </span>
        </label>
        <div id="background-image-row" className={settingRowClassName()} hidden={backgroundSettings.imageRowHidden}>
          <span className={SETTINGS_LABEL_CLASS}>背景图片</span>
          <Button unstyled id="background-image-picker" className={settingsControlClassName(SETTINGS_PICKER_BUTTON_CLASS)} type="button" title={backgroundSettings.imageName || undefined} onClick={() => imageFileInputRef.current?.click()}>{backgroundSettings.imageName ? '更换图片' : '选择图片'}</Button>
          <Input
            id="background-image-file"
            ref={imageFileInputRef}
            className={settingsInputClassName(SETTINGS_FILE_INPUT_CLASS)}
            type="file"
            accept="image/*"
            onChange={(event) => {
              handleBackgroundFileChange('image', event.currentTarget.files?.[0] || null)
              event.currentTarget.value = ''
            }}
            unstyled
          />
        </div>
        <div id="background-video-row" className={settingRowClassName()} hidden={backgroundSettings.videoRowHidden}>
          <span className={SETTINGS_LABEL_CLASS}>背景视频</span>
          <Button unstyled id="background-video-picker" className={settingsControlClassName(SETTINGS_PICKER_BUTTON_CLASS)} type="button" title={backgroundSettings.videoName || undefined} onClick={() => videoFileInputRef.current?.click()}>{backgroundSettings.videoName ? '更换视频' : '选择视频'}</Button>
          <Input
            id="background-video-file"
            ref={videoFileInputRef}
            className={settingsInputClassName(SETTINGS_FILE_INPUT_CLASS)}
            type="file"
            accept="video/*"
            onChange={(event) => {
              handleBackgroundFileChange('video', event.currentTarget.files?.[0] || null)
              event.currentTarget.value = ''
            }}
            unstyled
          />
        </div>
        <div id="background-url-row" className={SETTINGS_ROW_TEXT_INPUT_CLASS} hidden={backgroundSettings.urlRowHidden}>
          <span className={SETTINGS_LABEL_CLASS}>图片链接</span>
          <span className={SETTINGS_FIELD_CLASS}>
            <Input
              id="background-url"
              className={SETTINGS_TEXT_INPUT_CLASS}
              type="url"
              placeholder="图片链接"
              aria-label="背景图片链接"
              spellCheck={false}
              value={backgroundSettings.url}
              onBlur={dispatchNewtabBackgroundUrlCommit}
              onChange={(event) => dispatchNewtabBackgroundSettingFieldChange('url', event.currentTarget.value)}
              unstyled
            />
          </span>
        </div>
        <WallpaperAdjustmentSettings panelElement={panelElement} />
      </Surface>
    </section>
  )
})

const WallpaperAdjustmentSettings = memo(function WallpaperAdjustmentSettings({ panelElement }: { panelElement: HTMLElement | null }) {
  const backgroundSettings = useNewtabBackgroundSettingsView()
  const hidden = backgroundSettings.wallpaperAdjustmentsHidden || !backgroundSettings.wallpaperEnabled

  return (
    <>
      <SwitchRow
        id="wallpaper-enabled"
        title="背景蒙版"
        hidden={backgroundSettings.wallpaperAdjustmentsHidden}
        checked={backgroundSettings.wallpaperEnabled}
        onCheckedChange={value => dispatchNewtabBackgroundSettingFieldChange('wallpaperEnabled', value)}
      />
      <div id="wallpaper-style-row" className={settingRowClassName()} hidden={hidden}>
        <SettingLabelStack title="蒙版样式" />
        <Select
          id="wallpaper-style"
          ariaLabel="背景蒙版样式"
          options={WALLPAPER_MASK_STYLES.map(value => ({ value, label: WALLPAPER_MASK_PRESETS[value].label }))}
          onValueChange={value => {
            if (value) dispatchNewtabBackgroundSettingFieldChange('wallpaperStyle', value)
          }}
          value={backgroundSettings.wallpaperStyle}
          popupClassName={SETTINGS_SELECT_POPUP_CLASS}
          popupAttributes={DRAWER_PORTALED_CONTENT_ATTRIBUTES}
          modal={false}
          portalContainer={panelElement}
          positionerClassName={SETTINGS_SELECT_POSITIONER_CLASS}
          syncInputState
          triggerClassName={SETTINGS_SELECT_TRIGGER_CLASS}
          valueClassName={SETTINGS_SELECT_VALUE_CLASS}
        />
      </div>
      <SliderRow rowId="wallpaper-dim-row" id="wallpaper-dim" label="遮罩浓度" valueId="wallpaper-dim-value" value={`${backgroundSettings.wallpaperDim}%`} min="0" max={String(WALLPAPER_DIM_MAX)} defaultValue={String(DEFAULT_WALLPAPER_ADJUSTMENTS.dim)} ariaLabel="背景遮罩浓度" hidden={hidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('wallpaperDim', value)} sliderValue={backgroundSettings.wallpaperDim} />
      <SliderRow rowId="wallpaper-blur-row" id="wallpaper-blur" label="模糊" valueId="wallpaper-blur-value" value={`${backgroundSettings.wallpaperBlur}px`} min="0" max={String(WALLPAPER_BLUR_MAX)} defaultValue={String(WALLPAPER_MASK_PRESETS[backgroundSettings.wallpaperStyle].blur)} ariaLabel="壁纸模糊" hidden={hidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('wallpaperBlur', value)} sliderValue={backgroundSettings.wallpaperBlur} />
    </>
  )
})

// Changing a layout segment must not re-render every unrelated slider.
// Stable scalar props let React retain the Base UI controls and their observers.
const IconSettingSwitchRow = memo(SwitchRow)

const GLASS_CONTROLS: Array<{ key: NewtabGlassSettingKey; label: string; description: string; unit?: string }> = [
  { key: 'blur', label: '玻璃模糊', description: '', unit: 'px' },
  { key: 'tint', label: '底色深浅', description: '', unit: '%' },
  { key: 'saturation', label: '背景饱和度', description: '', unit: '%' },
  { key: 'brightness', label: '背景亮度', description: '', unit: '%' },
  { key: 'highlight', label: '边缘高光', description: '', unit: '%' }
]

const GlassSettingsSection = memo(function GlassSettingsSection({
  firstControlRef,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLButtonElement>
  sectionRef?: SettingsSectionRef
}) {
  const view = useNewtabGlassSettings()
  const settings = view.settings
  const drawer = useNewtabSettingsDrawerView()
  useEffect(() => {
    if (view.ready && drawer.open) beginNewtabGlassEditSession()
  }, [view.ready, drawer.open])
  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="glass" aria-labelledby="settings-glass-title">
      <SettingsSectionHeader id="settings-glass-title" title="液态玻璃">
        <Button size="sm" variant="ghost" disabled={!view.ready || !view.canUndo} onClick={undoNewtabGlassEditSession}>撤销本次调整</Button>
        <Button id="glass-reset-defaults" ref={firstControlRef} size="sm" variant="ghost" aria-label="恢复玻璃默认值" onClick={resetNewtabGlassSettings} disabled={!view.ready}>恢复默认值</Button>
      </SettingsSectionHeader>
      <div className="newtab-glass-controls grid gap-2.5">
        <div className="newtab-glass-preview-scene" aria-label="玻璃效果实时预览">
          <NewtabGlassSurface className="newtab-glass-preview">
            <strong className="block text-sm font-semibold">实时预览</strong>
          </NewtabGlassSurface>
        </div>
        {GLASS_CONTROLS.map(control => {
          const [min, max, step] = GLASS_SETTING_LIMITS[control.key]
          return <SliderRow key={control.key} id={'glass-' + control.key} label={control.label}
            description={control.description} valueId={'glass-' + control.key + '-value'}
            value={settings[control.key] + (control.unit || '')} min={String(min)} max={String(max)}
            step={step} defaultValue={String(DEFAULT_GLASS_SETTINGS[control.key])}
            ariaLabel={control.label} sliderValue={settings[control.key]} disabled={!view.ready}
            onValueChange={value => changeNewtabGlassSetting(control.key, value)} />
        })}
      </div>
    </section>
  )
})

const IconSettingSliderRow = memo(function IconSettingSliderRow({
  field,
  ...props
}: Omit<Parameters<typeof SliderRow>[0], 'onValueChange'> & { field: NewtabIconSettingsFieldKey }) {
  const handleValueChange = useCallback((value: number) => {
    dispatchNewtabIconSettingFieldChange(field, value)
  }, [field])
  return <SliderRow {...props} onValueChange={handleValueChange} />
})

const IconPresetRow = memo(function IconPresetRow({
  firstControlRef,
  preset
}: {
  firstControlRef?: Ref<HTMLElement>
  preset: string
}) {
  return (
    <div id="icon-preset-row" className={ICON_PRESET_ROW_CLASS} role="group" aria-label="书签卡片密度">
      {iconPresetCards.map((card, index) => (
        <Button
          ref={index === 0 ? firstControlRef : undefined}
          className={cx(ICON_PRESET_CARD_CLASS, SETTINGS_PSEUDO_SHADOW_RESET_CLASS)}
          type="button"
          data-preset={card.key}
          aria-pressed={preset === card.key}
          aria-label={`${card.name}布局`}
          onClick={() => dispatchNewtabIconPresetApply(card.key)}
          key={card.key}
          unstyled
        >
          <span
            className={ICON_PRESET_PREVIEW_CLASS}
            aria-hidden="true"
            style={card.previewGridStyle}
          >
            {card.previewCells.map((cellKey) => (
              <span
                className={ICON_PRESET_PREVIEW_CELL_CLASS}
                style={card.previewCellStyle}
                key={cellKey}
              />
            ))}
          </span>
          <span className={ICON_PRESET_NAME_CLASS}>{card.name}</span>
        </Button>
      ))}
    </div>
  )
})

const IconPreviewTile = memo(function IconPreviewTile({
  iconSource,
  mark,
  showTitles,
  title
}: {
  iconSource: string
  mark: string
  showTitles: boolean
  title: string
}) {
  const favicon = useMemo(
    () => ({ src: iconSource, pageUrl: '', fetchpriority: 'low' as const, loading: 'eager' as const }),
    [iconSource]
  )
  return (
    <NewtabGlassSurface as="span" className={getBookmarkTileClass({ showTitles, preview: true })}>
      <BookmarkIconShell
        customIcon={false}
        fallbackLabel={mark}
        favicon={favicon}
      />
      {showTitles ? <span className={getBookmarkTitleClass()} title={title}>{title}</span> : null}
    </NewtabGlassSurface>
  )
})

const IconSettingsSection = memo(function IconSettingsSection({
  firstControlRef,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLElement>
  sectionRef?: SettingsSectionRef
}) {
  const iconPreview = useNewtabIconPreviewView()
  const layout = useBookmarkPreviewLayout()
  const tileWidth = layout?.tileWidth ?? iconPreview.previewTileWidth
  const columnGap = layout?.columnGap ?? iconPreview.previewColumnGap
  const previewColumns = Math.min(layout?.columns ?? iconPreview.columns, iconPreview.showTitles ? 2 : 4)
  const previewGridWidth = previewColumns * tileWidth + (previewColumns - 1) * columnGap
  const previewStyle = {
    '--preview-column-gap': `${columnGap}px`,
    '--preview-grid-max-width': `${previewGridWidth}px`,
    '--preview-row-gap': `${layout?.rowGap ?? iconPreview.previewRowGap}px`,
    '--preview-tile-width': `${tileWidth}px`,
    '--icon-shell-size': `${iconPreview.iconShellSize}px`,
    '--icon-title-lines': String(iconPreview.titleLines)
  } as React.CSSProperties

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="appearance" aria-labelledby="settings-icon-title">
      <SettingsSectionHeader id="settings-icon-title" title="书签卡片">
        <Button id="icon-reset-defaults" variant="ghost" size="sm" onClick={dispatchNewtabIconResetDefaults}>恢复默认布局</Button>
      </SettingsSectionHeader>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <IconPresetRow firstControlRef={firstControlRef} preset={iconPreview.preset} />
        <IconSettingSwitchRow
          id="icon-show-titles"
          title="显示标题"
          checked={iconPreview.showTitles}
          onCheckedChange={dispatchNewtabIconShowTitlesToggle}
        />
        <SettingsDetails id="icon-advanced" title="自定义布局">
          <div className={settingRowClassName(ICON_CONTROL_ROW_CLASS)}>
            <SettingLabelStack title="排列" />
            <ToggleGroup
              id="icon-layout-control"
              slidingIndicator
              aria-label="布局方式"
              className={SETTINGS_SEGMENTED_CLASS}
              itemClassName={settingsControlClassName(SETTINGS_SEGMENTED_BUTTON_CLASS)}
              onValueChange={(value) => {
                const nextValue = value[0]
                if (nextValue) dispatchNewtabIconSettingFieldChange('layoutMode', nextValue)
              }}
              items={ICON_LAYOUT_MODE_ITEMS}
              unstyled
              value={iconPreview.layoutMode}
            />
          </div>
          {iconPreview.layoutMode === 'fixed' ? (
            <IconSettingSliderRow field="columns" rowId="icon-columns-row" id="icon-columns" label="固定列数" valueId="icon-columns-value" value={String(iconPreview.fixedColumns)} min="2" max="8" defaultValue="4" ariaLabel="书签卡片固定列数" sliderValue={iconPreview.fixedColumns} />
          ) : null}
          <IconSettingSliderRow field="pageWidth" id="icon-page-width" label="页面宽度" valueId="icon-page-width-value" value={`${iconPreview.pageWidth}%`} min="16" max="100" defaultValue="78" ariaLabel="书签卡片页面宽度" sliderValue={iconPreview.pageWidth} />
          <IconSettingSwitchRow
            id="icon-vertical-center"
            title="垂直居中"
            checked={iconPreview.verticalCenter}
            onCheckedChange={dispatchNewtabIconVerticalCenterToggle}
          />
          {iconPreview.showTitles ? (
            <div id="icon-title-lines-row" className={settingRowClassName(ICON_CONTROL_ROW_CLASS)}>
              <span className={SETTINGS_LABEL_CLASS}>标题行数</span>
              <ToggleGroup
                id="icon-title-lines-control"
                slidingIndicator
                aria-label="标题行数"
                className={SETTINGS_SEGMENTED_CLASS}
                itemClassName={settingsControlClassName(SETTINGS_SEGMENTED_BUTTON_CLASS)}
                onValueChange={(value) => {
                  const nextValue = value[0]
                  if (nextValue) dispatchNewtabIconSettingFieldChange('titleLines', Number(nextValue))
                }}
                items={ICON_TITLE_LINES_ITEMS}
                unstyled
                value={String(iconPreview.titleLines)}
              />
            </div>
          ) : null}
          <div className={ICON_PREVIEW_PANEL_CLASS}>
            <div className={ICON_PREVIEW_HEADER_CLASS}>
              <span>布局预览</span>
              <span id="icon-live-preview-summary" className={ICON_PREVIEW_SUMMARY_CLASS}>
                {iconPreview.layoutMode === 'fixed' ? `${layout?.columns ?? iconPreview.fixedColumns} 列` : '自动适配'}
              </span>
            </div>
            <figure
              id="icon-live-preview"
              className={ICON_LIVE_PREVIEW_CLASS}
              aria-label="书签卡片布局预览"
              data-icon-layout-mode={iconPreview.layoutMode}
              data-squircle="off"
              tabIndex={0}
              style={previewStyle}
            >
              <div
                className={cx(ICON_LIVE_PREVIEW_GRID_CLASS, 'max-w-full justify-center')}
                style={{ minWidth: tileWidth, gridTemplateColumns: 'repeat(auto-fit, var(--preview-tile-width))' }}
              >
                {iconPreview.tiles.map((item) => (
                  <IconPreviewTile
                    iconSource={item.iconSource}
                    key={item.id}
                    mark={item.mark}
                    showTitles={iconPreview.showTitles}
                    title={item.title}
                  />
                ))}
              </div>
            </figure>
          </div>
        </SettingsDetails>
      </Surface>
    </section>
  )
})

const iconPresetCards = (Object.entries(ICON_PRESET_META) as Array<[
  IconLayoutPresetKey,
  typeof ICON_PRESET_META[IconLayoutPresetKey]
]>).map(([key, meta]) => {
  const previewCellHeight = key === 'compact' ? '6px' : key === 'spacious' ? '11px' : '8.5px'
  const previewGap = key === 'compact' ? '2.5px' : key === 'spacious' ? '4px' : '3.5px'
  return {
    key,
    name: meta.name,
    previewCellStyle: { height: previewCellHeight } as React.CSSProperties,
    previewCells: Array.from({ length: meta.cols * meta.rows }, (_, index) => `${key}:${index}`),
    previewGridStyle: {
      gap: previewGap,
      gridTemplateColumns: `repeat(${meta.cols}, 1fr)`,
      padding: '4.5px 6px'
    } as React.CSSProperties
  }
})

const SearchSettingsSection = memo(function SearchSettingsSection({
  firstControlRef,
  panelElement,
  sectionRef
}: {
  firstControlRef?: Ref<HTMLElement>
  panelElement: HTMLElement | null
  sectionRef?: SettingsSectionRef
}) {
  const searchSettings = useNewtabSearchSettingsView()

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="search" aria-labelledby="settings-search-title">
      <SettingsSectionHeader id="settings-search-title" title="搜索栏">
        {searchSettings.enabled ? <Button id="search-reset-layout" variant="ghost" size="sm" onClick={dispatchNewtabSearchLayoutReset}>恢复默认布局</Button> : null}
      </SettingsSectionHeader>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <SwitchRow
          id="search-enabled"
          title="显示搜索栏"
          controlRef={firstControlRef}
          checked={searchSettings.enabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('enabled', checked)}
        />
        {searchSettings.enabled ? <>
          <SwitchRow
            id="search-web-enabled"
            title="网页搜索"
            checked={searchSettings.webSearchEnabled}
            onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('webSearchEnabled', checked)}
          />
          <div id="search-details-panel" className={SETTINGS_LIST_CLASS}>
            {searchSettings.webSearchEnabled ? <>
              <SwitchRow
                id="search-open-new-tab"
                title="在新标签页打开网页"
                checked={searchSettings.openInNewTab}
                onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('openInNewTab', checked)}
              />
            </> : null}
            <SliderRow
              id="search-height"
              label="高度"
              valueId="search-height-value"
              value={`${searchSettings.height}px`}
              min={String(SEARCH_HEIGHT_MIN)}
              max={String(SEARCH_HEIGHT_MAX)}
              step={SEARCH_HEIGHT_STEP}
              defaultValue={String(DEFAULT_SEARCH_LAYOUT.height)}
              ariaLabel="搜索栏高度"
              onValueChange={(value) => dispatchNewtabSearchSettingFieldChange('height', value)}
              onValueCommitted={dispatchNewtabSearchSettingCommit}
              sliderValue={searchSettings.height}
            />
            {!searchSettings.widthDisabled ? (
              <SliderRow
                id="search-width"
                label="宽度"
                valueId="search-width-value"
                value={`${searchSettings.width}vw`}
                min={String(searchSettings.widthMin)}
                max={String(searchSettings.widthMax)}
                defaultValue="44"
                ariaLabel="搜索栏宽度"
                onValueChange={(value) => dispatchNewtabSearchSettingFieldChange('width', value)}
                onValueCommitted={dispatchNewtabSearchSettingCommit}
                sliderValue={searchSettings.width}
              />
            ) : null}
            <SettingsSelect
              id="search-position"
              label="位置"
              ariaLabel="搜索栏位置"
              portalContainer={panelElement}
              value={searchSettings.autoVerticalCenter ? 'center' : searchSettings.offsetY === 0 ? 'flow' : 'custom'}
              options={[
                ['flow', '跟随页面布局'],
                ['center', '自动居中'],
                ...(!searchSettings.autoVerticalCenter && searchSettings.offsetY !== 0
                  ? [['custom', `自定义 ${searchSettings.offsetY}px`] as const]
                  : [])
              ]}
              onValueChange={(value) => {
                if (!value || value === 'custom') return
                dispatchNewtabSearchSettingFieldChange('offsetY', 0)
                dispatchNewtabSearchSettingToggle('autoVerticalCenter', value === 'center')
              }}
            />
            <div className={SETTINGS_ROW_TEXT_INPUT_CLASS}>
              <label className={SETTINGS_LABEL_CLASS} htmlFor="search-placeholder">提示文字</label>
              <span className={SETTINGS_FIELD_CLASS}>
                <Input
                  id="search-placeholder"
                  className={SETTINGS_TEXT_INPUT_CLASS}
                  type="text"
                  maxLength={40}
                  aria-label="搜索栏占位符文本"
                  onChange={(event) => dispatchNewtabSearchSettingFieldChange('placeholder', event.currentTarget.value)}
                  value={searchSettings.placeholder}
                  unstyled
                />
              </span>
            </div>
            <p className={SETTINGS_NOTE_CLASS}>仅影响 Curator 内的搜索，不会修改浏览器的默认搜索引擎。</p>
          </div>
        </> : null}
      </Surface>
    </section>
  )
})

export function SettingsDrawerHost() {
  const view = useNewtabSettingsDrawerView()

  useEffect(() => {
    dispatchNewtabSettingsDrawerReady()
  }, [])

  return (
    <SettingsDrawer
      open={view.open}
      activeGroup={view.activeGroup}
      onActiveGroupChange={dispatchNewtabSettingsDrawerActiveGroupChange}
      onOpenChange={dispatchNewtabSettingsDrawerOpenChange}
    />
  )
}

function SettingsDrawer({ open, activeGroup, onActiveGroupChange, onOpenChange }: SettingsDrawerProps) {
  const modal = useSettingsDrawerModalMode()
  const [visitedGroups, setVisitedGroups] = useState<Set<SettingsDrawerSection>>(() => new Set([activeGroup]))
  const [drawerElement, setDrawerElement] = useState<HTMLDivElement | null>(null)
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null)
  const layoutRequest = useNewtabSettingsDrawerLayoutRequest()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const outsideFocusRef = useRef<HTMLElement | null>(null)
  const firstControlRefs = useRef<Record<SettingsDrawerSection, HTMLElement | null>>({
    advanced: null,
    appearance: null,
    glass: null,
    search: null,
    source: null
  })
  const scrollHostRef = useRef<HTMLDivElement | null>(null)
  const folderCandidateSearchRef = useRef<HTMLInputElement | null>(null)
  const sectionRefs = useRef<Record<SettingsDrawerSection, HTMLElement | null>>({
    advanced: null,
    appearance: null,
    glass: null,
    search: null,
    source: null
  })

  useEffect(() => {
    if (!open || modal) return
    outsideFocusRef.current = null
    const rememberFocus = (event: FocusEvent) => {
      if (!getNewtabSettingsDrawerView().open) return
      const target = event.target
      outsideFocusRef.current = target instanceof HTMLElement && target !== document.body &&
        !panelElement?.contains(target) && !target.closest('[data-drawer-content]') ? target : null
    }
    document.addEventListener('focusin', rememberFocus, true)
    return () => document.removeEventListener('focusin', rememberFocus, true)
  }, [modal, open, panelElement])

  const resolveFinalFocus = useCallback(() => {
    if (!modal && outsideFocusRef.current?.isConnected) return outsideFocusRef.current
    return getNewtabSettingsDrawerNodes().trigger
  }, [modal])

  useLayoutEffect(() => {
    setNewtabSettingsDrawerNodes({
      drawer: drawerElement,
      panel: panelElement
    })

    return () => {
      setNewtabSettingsDrawerNodes({
        drawer: null,
        panel: null
      })
    }
  }, [drawerElement, panelElement])

  useLayoutEffect(() => {
    if (!open || layoutRequest.requestId === 0) {
      return
    }

    if (layoutRequest.action === 'scroll-top') {
      scrollHostRef.current?.scrollTo({
        top: 0,
        behavior: getMotionAwareScrollBehavior(layoutRequest.behavior)
      })
      return
    }

    if (layoutRequest.action === 'focus-first-control') {
      ;(closeButtonRef.current || panelElement)?.focus()
      return
    }

    if (layoutRequest.action === 'focus-section') {
      const targetSection = sectionRefs.current[layoutRequest.section]
      targetSection?.scrollIntoView({
        block: 'start',
        behavior: getMotionAwareScrollBehavior(layoutRequest.behavior)
      })

      if (layoutRequest.section === 'source') {
        const searchInput = folderCandidateSearchRef.current
        const target = searchInput && searchInput.offsetParent !== null
          ? searchInput
          : firstControlRefs.current.source
        target?.focus({ preventScroll: true })
        return
      }

      firstControlRefs.current[layoutRequest.section]?.focus({ preventScroll: true })
    }
  }, [layoutRequest, open, panelElement])

  const setAdvancedSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.advanced = element
  }, [])
  const setAppearanceSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.appearance = element
  }, [])
  const setSearchSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.search = element
  }, [])
  const setGlassSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.glass = element
  }, [])
  const setGlassFirstControlRef = useCallback((element: HTMLButtonElement | null) => {
    firstControlRefs.current.glass = element
  }, [])
  const setSourceSectionRef = useCallback<SettingsSectionRef>((element) => {
    sectionRefs.current.source = element
  }, [])
  const setSourceFirstControlRef = useCallback((element: HTMLElement | null) => {
    firstControlRefs.current.source = element
  }, [])
  const setAdvancedFirstControlRef = useCallback((element: HTMLElement | null) => {
    firstControlRefs.current.advanced = element
  }, [])
  const setAppearanceFirstControlRef = useCallback((element: HTMLElement | null) => {
    firstControlRefs.current.appearance = element
  }, [])
  const setSearchFirstControlRef = useCallback((element: HTMLElement | null) => {
    firstControlRefs.current.search = element
  }, [])

  const handleActiveGroupChange = useCallback((value: string) => {
    const group = value as SettingsDrawerSection
    setVisitedGroups(previous => previous.has(group) ? previous : new Set(previous).add(group))
    onActiveGroupChange(group)
  }, [onActiveGroupChange])

  return (
    <DrawerOverlay
      id="newtab-settings-drawer"
      className={cx(
        SETTINGS_DRAWER_CLASS,
        open && modal ? 'pointer-events-auto' : 'pointer-events-none',
        open ? 'open' : ''
      )}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="newtab-settings-trigger"
      modal={modal ? 'trap-focus' : false}
      disablePointerDismissal={!modal}
      aria-hidden={open ? 'false' : 'true'}
      inert={!open}
      tabIndex={-1}
      overlayRef={setDrawerElement}
    >
      <DrawerPanel
        className={cx(SETTINGS_DRAWER_PANEL_CLASS, SETTINGS_DRAWER_SURFACE_CLASS)}
        ref={setPanelElement}
        aria-labelledby="newtab-settings-title"
        initialFocus={false}
        finalFocus={resolveFinalFocus}
        unanimated
      >
        <TabsRoot
          className={SETTINGS_ROOT_CLASS}
          value={activeGroup}
          onValueChange={handleActiveGroupChange}
        >
          <div className={SETTINGS_CHROME_CLASS}>
            <SettingsDrawerHeader closeButtonRef={closeButtonRef} />
            <SettingsDrawerTabs />
          </div>
          <div className="relative min-h-0 overflow-hidden">
            <div className={SETTINGS_DRAWER_SCROLL_CLASS} ref={scrollHostRef}>
              <div className={SETTINGS_TAB_PANELS_CLASS}>
                <SettingsTabPanel value="advanced" active={activeGroup === 'advanced'} visited={visitedGroups.has('advanced')}>
                  <AdvancedSettingsSection
                    firstControlRef={setAdvancedFirstControlRef}
                    sectionRef={setAdvancedSectionRef}
                  />
                </SettingsTabPanel>
                <SettingsTabPanel value="source" active={activeGroup === 'source'} visited={visitedGroups.has('source')}>
                  <SourceSettingsSection
                    firstControlRef={setSourceFirstControlRef}
                    folderCandidateSearchRef={folderCandidateSearchRef}
                    sectionRef={setSourceSectionRef}
                  />
                </SettingsTabPanel>
                <SettingsTabPanel value="appearance" active={activeGroup === 'appearance'} visited={visitedGroups.has('appearance')}>
                  <IconSettingsSection
                    firstControlRef={setAppearanceFirstControlRef}
                    sectionRef={setAppearanceSectionRef}
                  />
                  <BackgroundSettingsSection panelElement={panelElement} />
                </SettingsTabPanel>
                <SettingsTabPanel value="glass" active={activeGroup === 'glass'} visited={visitedGroups.has('glass')}>
                  <GlassSettingsSection
                    firstControlRef={setGlassFirstControlRef}
                    sectionRef={setGlassSectionRef}
                  />
                </SettingsTabPanel>
                <SettingsTabPanel value="search" active={activeGroup === 'search'} visited={visitedGroups.has('search')}>
                  <SearchSettingsSection
                    firstControlRef={setSearchFirstControlRef}
                    panelElement={panelElement}
                    sectionRef={setSearchSectionRef}
                  />
                </SettingsTabPanel>
              </div>
            </div>
            <SettingsDrawerScrollBar
              activeGroup={activeGroup}
              open={open}
              scrollHostRef={scrollHostRef}
            />
          </div>
        </TabsRoot>
      </DrawerPanel>
    </DrawerOverlay>
  )
}
