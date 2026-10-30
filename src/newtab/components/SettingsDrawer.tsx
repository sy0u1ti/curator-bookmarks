import {
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject
} from 'react'
import { Button } from '../../ui/base/Button'
import { getMotionAwareScrollBehavior } from '../../shared/motion'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from '../../ui/base/Collapsible'
import { cx } from '../../ui/base/utils'
import { DrawerOverlay, DrawerPanel } from '../../ui/base/Drawer'
import { Icon } from '../../ui/icons/Icon'
import { Input } from '../../ui/base/Input'
import { Select } from '../../ui/base/Select'
import { SliderControl } from '../../ui/base/Slider'
import { DEFAULT_GLASS_SETTINGS, GLASS_PRESETS, getGlassPresetId, GLASS_SETTING_LIMITS, type NewtabGlassSettingKey } from '../glass-settings'
import { applyNewtabGlassPreset, beginNewtabGlassEditSession, undoNewtabGlassEditSession, changeNewtabGlassSetting, resetNewtabGlassSettings, useNewtabGlassSettings } from '../newtab-glass-settings-store'
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
  dispatchNewtabTimeSettingFieldChange,
  dispatchNewtabTimeSettingToggle,
  useNewtabTimeSettingsView
} from '../newtab-time-settings-store'
import {
  dispatchNewtabSearchLayoutReset,
  dispatchNewtabSearchSettingFieldChange,
  dispatchNewtabSearchSettingToggle,
  dispatchNewtabSearchWebEngineChange,
  useNewtabSearchSettingsView
} from '../newtab-search-settings-store'
import { getSearchSizePreset, SEARCH_SIZE_PRESETS, type SearchSizePreset } from '../search-layout'
import { SEARCH_MULTI_OPEN_LIMIT } from '../search-engines'
import {
  dispatchNewtabBackgroundFileSelect,
  dispatchNewtabBackgroundFilterHoverToggle,
  dispatchNewtabBackgroundMaskToggle,
  dispatchNewtabBackgroundSettingFieldChange,
  dispatchNewtabBackgroundUrlCommit,
  useNewtabBackgroundSettingsView
} from '../newtab-background-settings-store'
import { NEWTAB_BACKGROUND_TYPE_OPTIONS } from '../newtab-background-types'
import type { SettingsDrawerSection } from '../settings-group-sync'
import { useSettingsDrawerModalMode } from '../settings-drawer-mode'
import { BACKGROUND_MASK_META, BACKGROUND_MASK_STYLES, isPaperShaderMaskStyle } from '../background-mask-settings'
import { getBackgroundFilterUnavailableReason, useBackgroundFilterStatus } from '../background-filter-runtime'
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
const SETTINGS_DRAWER_SURFACE_CLASS = 'settings-drawer-panel @container/settings isolate rounded-ds-lg border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)] bg-transparent text-ds-text-primary [box-shadow:var(--newtab-glass-drop-shadow)] [filter:none] [hanging-punctuation:allow-end] [line-break:strict] [text-autospace:normal] [text-spacing-trim:trim-start] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[hanging-punctuation:none] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[line-break:auto] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[text-autospace:no-autospace] [&_:where(input,textarea,button,code,kbd,pre,samp)]:[text-spacing-trim:space-all]'
const SETTINGS_DRAWER_PANEL_CLASS = 'pointer-events-auto fixed inset-y-0 right-0 z-[1] grid h-dvh w-[min(520px,calc(100vw-24px))] max-w-full grid-rows-[minmax(0,1fr)] overflow-hidden opacity-100 [transform:translateX(var(--drawer-swipe-movement-x))] transition-[transform,scale,opacity] duration-[var(--panel-open-dur)] ease-[var(--panel-ease)] data-swiping:duration-0 data-ending-style:duration-[var(--panel-close-dur)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-starting-style:[transform:translateX(100%)] data-ending-style:[transform:translateX(100%)] motion-reduce:transition-opacity motion-reduce:duration-[80ms] motion-reduce:[transform:none] max-[600px]:w-full max-[600px]:rounded-none max-[600px]:border-x-0'
const SETTINGS_DRAWER_SCROLL_CLASS = 'settings-drawer-scroll h-full min-h-0 overflow-x-hidden overflow-y-auto px-6 pb-6 pt-4 @max-[440px]/settings:px-4 @max-[440px]/settings:pb-5'
const SETTINGS_ROOT_CLASS = 'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]'
const SETTINGS_CHROME_CLASS = 'settings-drawer-chrome grid gap-3 border-b border-ds-border-subtle px-6 pb-4 pt-4 @max-[440px]/settings:px-4'
const SETTINGS_HEADER_CLASS = 'grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3'
const SETTINGS_TITLE_CLASS = 'm-0 text-xl font-semibold leading-tight text-ds-text-primary'
const SETTINGS_SAVE_STATUS_CLASS = 'col-span-2 mt-1 text-xs font-semibold text-ds-accent-text data-[state=error]:text-ds-danger-text'
const SETTINGS_TABS_LIST_CLASS = 't-tabs grid grid-cols-5 gap-1 rounded-ds-md border-0 bg-[rgba(245,245,247,0.06)] p-1'
const SETTINGS_TAB_CLASS = 't-tab min-h-8 min-w-0 whitespace-nowrap rounded-ds-sm bg-transparent px-2 text-xs font-semibold outline-none hover:text-ds-text-primary data-[active]:text-ds-text-primary data-[selected]:text-ds-text-primary data-[state=active]:text-ds-text-primary focus-visible:shadow-ds-focus @max-[380px]/settings:px-0'
const SETTINGS_TABS_INDICATOR_CLASS = 't-tabs-pill'
const SETTINGS_TAB_PANELS_CLASS = 'settings-tab-panels grid min-w-0 items-start'
const SETTINGS_TAB_PANEL_CLASS = 'grid min-w-0 gap-4 outline-none [grid-area:1/1]'
const SETTINGS_NESTED_SURFACE_CLASS = 'border-0 rounded-ds-sm bg-[rgba(245,245,247,0.045)] shadow-none'
const SETTINGS_SELECTED_SURFACE_CLASS = 'border-[rgba(245,245,247,0.24)] bg-[rgba(245,245,247,0.14)] text-ds-text-primary shadow-none'
const SETTINGS_SEGMENTED_BUTTON_CLASS = 'min-h-7 min-w-20 rounded-ds-sm border border-transparent bg-transparent px-2 text-xs font-semibold text-ds-text-secondary shadow-none data-[pressed]:border-ds-border-hover data-[pressed]:bg-ds-selected data-[pressed]:text-ds-text-primary data-[pressed]:shadow-none'
const SETTINGS_PSEUDO_SHADOW_RESET_CLASS = '[&::before]:shadow-none [&::after]:shadow-none'
const SETTINGS_SECTION_CLASS = 'grid min-w-0 gap-2.5'
const SETTINGS_SECTION_TITLE_CLASS = 'm-0 text-sm font-semibold leading-snug text-ds-text-primary'
const SETTINGS_LIST_CLASS = 'grid gap-2'
const SETTINGS_INPUT_SURFACE_CLASS = 'border-ds-border rounded-ds-sm bg-[rgba(245,245,247,0.055)] text-ds-text-primary shadow-none'
const SETTINGS_INPUT_INTERACTION_CLASS = 'outline-none transition-colors duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary hover:shadow-none hover:outline-none focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
const SETTINGS_CONTROL_CLASS = cx(SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_INPUT_INTERACTION_CLASS)
const SETTINGS_TEXT_INPUT_FOCUS_CLASS = 'focus:border-ds-focus focus:bg-ds-hover focus:outline-none focus:shadow-ds-focus focus-visible:border-ds-focus focus-visible:bg-ds-hover focus-visible:outline-none focus-visible:shadow-ds-focus'
const SETTINGS_TEXT_INPUT_CLASS = cx('h-9 min-h-9 w-full min-w-0 px-3 text-xs font-semibold', SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_INPUT_INTERACTION_CLASS, SETTINGS_TEXT_INPUT_FOCUS_CLASS)
const SETTINGS_ROW_CLASS = 'grid min-h-12 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-ds-sm border-0 bg-[rgba(245,245,247,0.045)] px-3 py-2.5 @max-[440px]/settings:grid-cols-1 @max-[440px]/settings:justify-items-stretch'
const SETTINGS_ROW_DISABLED_CLASS = 'opacity-60'
// Switch rows keep label and control side by side at every drawer width.
const SETTINGS_SWITCH_ROW_CLASS = 'settings-switch-row @max-[440px]/settings:grid-cols-[minmax(0,1fr)_auto]'
const SETTINGS_ROW_SLIDER_CLASS = 'grid-cols-[minmax(0,1fr)_minmax(150px,42%)]'
const SETTINGS_LABEL_STACK_CLASS = 'grid min-w-0 gap-1'
const SETTINGS_LABEL_CLASS = 'min-w-0 text-sm font-semibold leading-snug text-ds-text-primary'
const SETTINGS_DESCRIPTION_CLASS = 'text-xs font-medium leading-snug text-ds-text-secondary'
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
const FOLDER_SUMMARY_CLASS = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 rounded-ds-sm border-0 bg-ds-surface-2 px-2.5 py-2'
const FOLDER_SELECTED_COPY_CLASS = 'grid min-w-0 gap-0.5 text-xs text-ds-text-secondary'
const FOLDER_REMOVE_BUTTON_CLASS = 'curator-compact-hit-target group/folder-remove inline-flex size-8 min-h-8 min-w-8 items-center justify-center rounded-ds-sm border border-[rgba(245,245,247,0.07)] bg-[rgba(245,245,247,0.045)] p-0 text-[rgba(245,245,247,0.9)] outline-none transition-[background-color,border-color,color,transform,scale,opacity] duration-ds-fast ease-ds-standard hover:border-[rgba(255,138,130,0.24)] hover:bg-[rgba(255,138,130,0.11)] hover:text-[rgba(255,210,205,0.95)] focus-visible:border-[rgba(255,138,130,0.28)] focus-visible:bg-[rgba(255,138,130,0.12)] focus-visible:text-[rgba(255,210,205,0.95)] focus-visible:shadow-ds-focus active:scale-[var(--ds-press-scale)] motion-reduce:transition-colors motion-reduce:duration-[80ms] motion-reduce:active:scale-100 [&_svg]:size-[15px] [&_svg]:stroke-[1.9]'
const FOLDER_EMPTY_CLASS = SETTINGS_NOTE_CLASS
const FOLDER_CANDIDATES_PANEL_CLASS = cx('grid gap-2 px-2.5 py-2', SETTINGS_NESTED_SURFACE_CLASS)
const FOLDER_CANDIDATE_LIST_CLASS = 'grid max-h-56 gap-1 overflow-y-auto'
const FOLDER_CANDIDATE_CARD_CLASS = 'folder-candidate-card grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-ds-sm border border-transparent bg-transparent px-2.5 py-2 text-left text-ds-text-primary outline-none transition-colors duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover aria-pressed:border-ds-border-hover aria-pressed:bg-ds-selected aria-pressed:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:shadow-ds-focus'
const FOLDER_CANDIDATE_COPY_CLASS = 'grid min-w-0 gap-0.5'
const FOLDER_CANDIDATE_TITLE_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold leading-snug text-ds-text-primary'
const FOLDER_CANDIDATE_META_CLASS = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-snug text-ds-text-secondary'
const FOLDER_CANDIDATE_BADGE_CLASS = 'inline-flex min-h-5 items-center justify-center rounded-full bg-ds-surface-1 px-2 text-xs font-semibold text-ds-text-secondary whitespace-nowrap'
const MODULE_SWITCH_LABEL_CLASS = SETTINGS_SWITCH_WRAP_CLASS
const SETTING_COLOR_CLASS = 'inline-grid min-h-9 min-w-40 grid-cols-[minmax(0,1fr)_34px] items-center gap-2 overflow-hidden rounded-ds-sm border border-ds-border bg-ds-surface-2 p-1 pl-2.5'
const SETTING_COLOR_VALUE_CLASS = 'text-xs font-semibold text-ds-text-primary'
const SETTING_COLOR_INPUT_CLASS = 'h-7 min-h-7 w-8 min-w-8 overflow-hidden rounded-ds-sm border-0 bg-transparent p-0'
const ICON_PREVIEW_PANEL_CLASS = 'grid gap-2.5 rounded-ds-sm border-0 bg-ds-surface-2 p-3'
const ICON_PREVIEW_HEADER_CLASS = 'grid gap-1 text-xs font-semibold text-ds-text-primary'
const ICON_PREVIEW_SUMMARY_CLASS = 'min-w-0 text-xs font-medium leading-relaxed text-ds-text-secondary'
const ICON_LIVE_PREVIEW_CLASS = 'm-0 overflow-x-auto rounded-ds-sm border border-ds-border bg-ds-app px-2.5 py-4 outline-none focus-visible:shadow-ds-focus [scrollbar-width:thin] [scrollbar-color:var(--ds-border-hover)_transparent]'
const ICON_LIVE_PREVIEW_GRID_CLASS = 'mx-auto grid w-[var(--preview-grid-max-width)] content-center [column-gap:var(--preview-column-gap)] [row-gap:var(--preview-row-gap)]'
const ICON_PRESET_ROW_CLASS = 'grid grid-cols-3 gap-2'
const ICON_PRESET_CARD_CLASS = 'grid min-h-24 min-w-0 content-center gap-3 rounded-ds-sm border border-ds-border bg-ds-surface-1 p-2.5 text-left text-ds-text-secondary outline-none transition-colors duration-ds-fast ease-ds-standard hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:shadow-ds-focus'
const ICON_PRESET_PREVIEW_CLASS = 'grid min-h-11 content-center rounded-ds-sm bg-ds-app'
const ICON_PRESET_PREVIEW_CELL_CLASS = 'block rounded-ds-sm bg-ds-surface-2'
const ICON_PRESET_NAME_CLASS = 'min-w-0 overflow-hidden text-ellipsis text-xs font-semibold text-ds-text-primary'
const SETTINGS_SEGMENTED_CLASS = 'inline-flex min-h-9 items-center gap-1 rounded-ds-sm border border-ds-border bg-ds-surface-2 p-1 @max-[440px]/settings:w-full'
const ICON_CONTROL_ROW_CLASS = 'grid-cols-[minmax(0,1fr)_auto]'
const SEARCH_ENGINE_ROW_CLASS = 'items-start'
const SEARCH_ENGINE_GRID_CLASS = 'grid min-w-0 grid-cols-3 gap-1.5'
const SEARCH_ENGINE_TOGGLE_CLASS = 'search-engine-toggle relative inline-flex min-h-8 min-w-0 items-center justify-center px-2 text-xs font-semibold'
const SEARCH_ENGINE_HIDDEN_SWITCH_CLASS = 'pointer-events-none absolute h-px w-px opacity-0'
const SETTINGS_SCROLLBAR_MIN_THUMB_HEIGHT = 40

function settingsControlClassName(...classNames: Array<string | false | null | undefined>): string {
  return cx(SETTINGS_CONTROL_CLASS, ...classNames)
}

function settingsInputClassName(...classNames: Array<string | false | null | undefined>): string {
  return cx(SETTINGS_INPUT_SURFACE_CLASS, SETTINGS_INPUT_INTERACTION_CLASS, ...classNames)
}

type SettingsSectionRef = (element: HTMLElement | null) => void

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

const searchEngines = [
  ['google', 'Google', true],
  ['bing', 'Bing', true],
  ['baidu', '百度', true],
  ['duckduckgo', 'DuckDuckGo', true],
  ['perplexity', 'Perplexity', false],
  ['chatgpt', 'ChatGPT', false],
  ['you', 'You.com', false],
  ['kagi', 'Kagi', false],
  ['brave', 'Brave', false]
] as const

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
        <span className="t-acc-chevron"><Icon name="ChevronDown" size={14} aria-hidden="true" /></span>
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

  return (
    <header className={SETTINGS_HEADER_CLASS}>
      <h1 id="newtab-settings-title" className={SETTINGS_TITLE_CLASS}>新标签页设置</h1>
      <SettingsDrawerClose buttonRef={closeButtonRef} className={SETTINGS_CONTROL_CLASS} />
      <output
        id="settings-save-status"
        className={SETTINGS_SAVE_STATUS_CLASS}
        aria-live="polite"
        data-state={view.saveState}
        hidden={view.saveState === 'idle'}
      >
        {view.saveMessage}
      </output>
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
      <h2 id="settings-general-title" className={SETTINGS_SECTION_TITLE_CLASS}>高级</h2>
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
          title="新标签页打开"
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
  folderCandidateSearchRef,
  sectionRef
}: {
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
      <h2 id="settings-folder-title" className={SETTINGS_SECTION_TITLE_CLASS}>书签来源</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <div className={FOLDER_STACK_CLASS}>
          <div className="flex items-center justify-between gap-2.5 px-0.5 py-1">
            <span className={SETTINGS_LABEL_CLASS}>已选文件夹</span>
            <strong id="folder-selected-count" className="text-sm font-semibold text-ds-text-primary tabular-nums">{folderSource.selectedCount}</strong>
          </div>
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
              className={settingsControlClassName(SETTINGS_WIDE_BUTTON_CLASS)}
              type="button"
              aria-controls="folder-candidates-panel"
            >
              <span data-folder-toggle-label>
                {candidatesExpanded ? '收起候选文件夹' : '展开候选文件夹'}
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
            items={[
              { value: 'expanded', label: '平铺书签', attributes: { 'data-browse-mode': 'expanded' } },
              { value: 'navigation', label: '逐级浏览', attributes: { 'data-browse-mode': 'navigation' } }
            ]}
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
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{item.path}</span>
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
        <span className={FOLDER_CANDIDATE_META_CLASS}>{`${item.path || item.title || '未命名文件夹'} · ${item.stats}`}</span>
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
      <h2 id="settings-background-title" className={SETTINGS_SECTION_TITLE_CLASS}>背景</h2>
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
        <div id="background-url-row" className={settingRowClassName()} hidden={backgroundSettings.urlRowHidden}>
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
        <output
          id="background-status"
          className={SETTINGS_STATUS_CLASS}
          aria-live="polite"
          data-tone={backgroundSettings.backgroundStatusTone}
          hidden={!backgroundSettings.backgroundStatus}
        >
          {backgroundSettings.backgroundStatus}
        </output>
        <BackgroundMaskSettings panelElement={panelElement} />
      </Surface>
    </section>
  )
})

const BackgroundMaskSettings = memo(function BackgroundMaskSettings({ panelElement }: { panelElement: HTMLElement | null }) {
  const backgroundSettings = useNewtabBackgroundSettingsView()
  const filterStatus = useBackgroundFilterStatus()
  const maskMeta = BACKGROUND_MASK_META[backgroundSettings.maskStyle]
  const unavailableReason = getBackgroundFilterUnavailableReason(backgroundSettings.maskStyle, backgroundSettings.type)
  const filterMessage = unavailableReason || (filterStatus.style === backgroundSettings.maskStyle ? filterStatus.message : '')
  const filterControlsHidden = Boolean(unavailableReason)

  return (
    <>
      <SwitchRow
        id="background-mask-enabled"
        title="背景蒙版"
        description="在壁纸与卡片之间叠加视觉蒙版，提升文字和图标的可读性。"
        checked={backgroundSettings.maskEnabled}
        onCheckedChange={dispatchNewtabBackgroundMaskToggle}
      />
      <SliderRow rowId="background-mask-overlay-row" id="background-mask-overlay" label="遮罩浓度" description="控制背景明暗遮罩强度；0% 保持原图明度，提高后压暗以突出文字。" valueId="background-mask-overlay-value" value={`${backgroundSettings.maskOverlay}%`} min="0" max="100" defaultValue="50" ariaLabel="背景遮罩效果" hidden={backgroundSettings.maskStyleHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskOverlay', value)} sliderValue={backgroundSettings.maskOverlay} ticks={['透明', '50%', '覆盖']} />
      <div id="background-mask-style-row" className={settingRowClassName()} hidden={backgroundSettings.maskStyleHidden}>
        <SettingLabelStack title="蒙版样式" description={maskMeta.description} />
        <Select
          id="background-mask-style"
          ariaLabel="背景蒙版样式"
          onValueChange={(value) => {
            if (value) dispatchNewtabBackgroundSettingFieldChange('maskStyle', value)
          }}
          options={BACKGROUND_MASK_STYLES.map(value => ({
            value,
            label: BACKGROUND_MASK_META[value].label,
            disabled: isPaperShaderMaskStyle(value) && Boolean(getBackgroundFilterUnavailableReason(value, backgroundSettings.type))
          }))}
          popupClassName={SETTINGS_SELECT_POPUP_CLASS}
          popupAttributes={DRAWER_PORTALED_CONTENT_ATTRIBUTES}
          modal={false}
          portalContainer={panelElement}
          positionerClassName={SETTINGS_SELECT_POSITIONER_CLASS}
          syncInputState
          triggerClassName={SETTINGS_SELECT_TRIGGER_CLASS}
          value={backgroundSettings.maskStyle}
          valueClassName={SETTINGS_SELECT_VALUE_CLASS}
        />
      </div>
      {backgroundSettings.maskEnabled && filterMessage ? <p id="background-filter-status" className={SETTINGS_STATUS_CLASS} role="status">{filterMessage}</p> : null}
      <SwitchRow
        id="background-mask-filter-hover"
        title="悬停效果"
        description="鼠标在壁纸空白处移动时，动态增强指针周围的滤镜纹理交互。"
        checked={backgroundSettings.maskFilterHover}
        hidden={backgroundSettings.maskFilterHoverHidden}
        onCheckedChange={dispatchNewtabBackgroundFilterHoverToggle}
      />
      <SliderRow rowId="background-mask-blur-row" id="background-mask-blur" label="背景模糊" description={backgroundSettings.type === 'color' ? '纯色没有可模糊的细节，切换到图片或视频后可见。' : '只柔化壁纸，文字和书签保持清晰。'} valueId="background-mask-blur-value" value={`${backgroundSettings.maskBlur}px`} min="0" max="32" defaultValue="12" ariaLabel="背景蒙版模糊程度" hidden={backgroundSettings.maskBlurHidden} disabled={backgroundSettings.type === 'color'} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskBlur', value)} sliderValue={backgroundSettings.maskBlur} ticks={['清晰', '16px', '柔和']} />
      <SliderRow rowId="background-mask-filter-strength-row" id="background-mask-filter-strength" label="滤镜强度" description="0% 显示原图，向右增强纹理。" valueId="background-mask-filter-strength-value" value={`${backgroundSettings.maskFilterStrength}%`} min="0" max="100" defaultValue="50" ariaLabel="壁纸滤镜采样强度" hidden={backgroundSettings.maskFilterStrengthHidden || filterControlsHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskFilterStrength', value)} sliderValue={backgroundSettings.maskFilterStrength} ticks={['原图', '50%', '完整效果']} />
      <SliderRow rowId="background-mask-filter-size-row" id="background-mask-filter-size" label={maskMeta.sizeLabel || '大小'} valueId="background-mask-filter-size-value" value={`${backgroundSettings.maskFilterSize}%`} min="0" max="100" defaultValue="50" ariaLabel="壁纸滤镜元素大小" hidden={backgroundSettings.maskFilterSizeHidden || filterControlsHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskFilterSize', value)} sliderValue={backgroundSettings.maskFilterSize} ticks={['小', '50%', '大']} />
      <SliderRow rowId="background-mask-filter-spacing-row" id="background-mask-filter-spacing" label={maskMeta.spacingLabel || '间距'} valueId="background-mask-filter-spacing-value" value={`${backgroundSettings.maskFilterSpacing}%`} min="0" max="100" defaultValue="50" ariaLabel="壁纸滤镜元素间距" hidden={backgroundSettings.maskFilterSpacingHidden || filterControlsHidden} onValueChange={(value) => dispatchNewtabBackgroundSettingFieldChange('maskFilterSpacing', value)} sliderValue={backgroundSettings.maskFilterSpacing} ticks={['低', '50%', '高']} />
    </>
  )
})

// Changing a layout segment must not re-render every unrelated slider.
// Stable scalar props let React retain the Base UI controls and their observers.
const IconSettingSwitchRow = memo(SwitchRow)

const GLASS_CONTROLS: Array<{ key: NewtabGlassSettingKey; label: string; description: string; unit?: string }> = [
  { key: 'blur', label: '玻璃模糊', description: '背景模糊半径；数值越小越透光，数值越大磨砂感越强。', unit: 'px' },
  { key: 'tint', label: '底色深浅', description: '卡片底色浓度；浅色壁纸调高可提升对比度，深色壁纸调低透出背景。', unit: '%' },
  { key: 'bevel', label: '边缘范围', description: '玻璃斜切边宽度；拉高后边缘折射更宽阔厚实。' },
  { key: 'thickness', label: '折射强度', description: '背景透视扭曲度；数值越大，穿透玻璃的壁纸弯曲形变越明显。' },
  { key: 'dispersion', label: '色散', description: '棱镜分光强度；在卡片高光边缘产生微妙的彩虹色色散。' },
  { key: 'rim', label: '边缘高光', description: '卡片边缘轮廓光的亮度，突出悬浮晶莹感。' },
  { key: 'light', label: '光照方向', description: '模拟光源照射的角度（0°~360°），改变亮边与阴影方位。', unit: '°' },
  { key: 'smooth', label: '边缘柔化', description: '倒角过渡平滑度；让高光边缘与镜面衔接更细腻自然。', unit: 'px' }
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
  const presetId = getGlassPresetId(settings)
  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="glass" aria-labelledby="settings-glass-title">
      <h2 id="settings-glass-title" className={SETTINGS_SECTION_TITLE_CLASS}>液态玻璃</h2>
      <div className="mb-3 grid grid-cols-3 gap-2" role="group" aria-label="玻璃材质预设">
        {GLASS_PRESETS.map(preset => <Button key={preset.id} size="sm" variant={presetId === preset.id ? 'primary' : 'secondary'}
          disabled={!view.ready} aria-pressed={presetId === preset.id} title={preset.description}
          onClick={() => applyNewtabGlassPreset({ ...preset.settings })}>{preset.label}</Button>)}
      </div>
      {presetId === 'custom' ? <p className={SETTINGS_NOTE_CLASS}>当前使用自定义材质。</p> : null}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={!view.ready || !view.canUndo} onClick={undoNewtabGlassEditSession}>撤销本次调整</Button>
        <Button size="sm" variant="secondary" onClick={resetNewtabGlassSettings} disabled={!view.ready}>恢复玻璃默认值</Button>
      </div>
      <output className={SETTINGS_NOTE_CLASS} aria-live="polite">
        {view.saveState === 'error' ? '设置保存失败，请重试。' : view.saveState === 'saving' ? '正在保存…' : view.saveState === 'saved' ? '已保存' : ''}
      </output>
      <CollapsibleRoot className="newtab-glass-controls">
        <CollapsibleTrigger
          render={<Button unstyled ref={firstControlRef} />}
          aria-label="精细调整玻璃材质"
          className={settingsControlClassName('flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left text-sm')}
        >
          <span className="grid gap-1">
            <span>精细调整</span>
            <span className={SETTINGS_DESCRIPTION_CLASS}>模糊 {settings.blur}px · 底色 {settings.tint}%</span>
          </span>
          <span className="t-acc-chevron"><Icon name="ChevronDown" size={14} aria-hidden="true" /></span>
        </CollapsibleTrigger>
        <CollapsiblePanel className="grid gap-2.5">
          <div className="newtab-glass-preview-scene" aria-label="玻璃效果实时预览">
            <div className="newtab-glass-preview">
              <strong className="block text-sm font-semibold">实时预览</strong>
            </div>
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
        </CollapsiblePanel>
      </CollapsibleRoot>
    </section>
  )
})

const IconSettingSliderRow = memo(function IconSettingSliderRow({
  field,
  ...props
}: Omit<Parameters<typeof SliderRow>[0], 'onValueChange'> & { field: NewtabIconSettingsFieldKey }) {
  return <SliderRow {...props} onValueChange={(value) => dispatchNewtabIconSettingFieldChange(field, value)} />
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
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="settings-icon-title" className={SETTINGS_SECTION_TITLE_CLASS}>书签卡片</h2>
        <Button id="icon-reset-defaults" variant="ghost" size="sm" onClick={dispatchNewtabIconResetDefaults}>恢复默认布局</Button>
      </div>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <div id="icon-preset-row" className={ICON_PRESET_ROW_CLASS} role="group" aria-label="书签卡片密度">
          {iconPresetCards.map((card, index) => (
            <Button
              ref={index === 0 ? firstControlRef : undefined}
              className={cx(
                ICON_PRESET_CARD_CLASS,
                SETTINGS_PSEUDO_SHADOW_RESET_CLASS,
                iconPreview.preset === card.key ? SETTINGS_SELECTED_SURFACE_CLASS : undefined
              )}
              type="button"
              data-preset={card.key}
              aria-pressed={iconPreview.preset === card.key}
              aria-label={`${card.name}布局`}
              onClick={() => dispatchNewtabIconPresetApply(card.key)}
              key={card.key}
              unstyled
            >
              <span
                className={ICON_PRESET_PREVIEW_CLASS}
                aria-hidden="true"
                style={{
                  gap: card.previewGap,
                  gridTemplateColumns: `repeat(${card.previewColumnCount}, 1fr)`,
                  padding: card.previewPadding
                }}
              >
                {Array.from({ length: card.previewColumnCount * card.previewRowCount }, (_, index) => (
                  <span
                    className={ICON_PRESET_PREVIEW_CELL_CLASS}
                    style={{ height: card.previewCellHeight }}
                    key={`${card.key}:${index}`}
                  />
                ))}
              </span>
              <span className={ICON_PRESET_NAME_CLASS}>{card.name}</span>
            </Button>
          ))}
        </div>
        {iconPreview.preset === 'custom' ? <p className={SETTINGS_NOTE_CLASS}>自定义密度</p> : null}
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
              items={[
                { value: 'auto', label: '自动适配', attributes: { 'data-icon-layout-mode': 'auto' } },
                { value: 'fixed', label: '固定列数', attributes: { 'data-icon-layout-mode': 'fixed' } }
              ]}
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
                items={[
                  { value: '1', label: '1 行', attributes: { 'data-icon-title-lines': '1' } },
                  { value: '2', label: '2 行', attributes: { 'data-icon-title-lines': '2' } }
                ]}
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
                  <span className={getBookmarkTileClass({ showTitles: iconPreview.showTitles, preview: true })} key={item.id}>
                    <BookmarkIconShell
                      customIcon={false}
                      fallbackLabel={item.mark}
                      favicon={{ src: item.iconSource, pageUrl: '', fetchpriority: 'low', loading: 'eager' }}
                    />
                    {iconPreview.showTitles ? <span className={getBookmarkTitleClass()} title={item.title}>{item.title}</span> : null}
                  </span>
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
]>).map(([key, meta]) => ({
  key,
  name: meta.name,
  previewCellHeight: key === 'compact' ? '8px' : key === 'spacious' ? '12px' : '10px',
  previewColumnCount: meta.cols,
  previewGap: key === 'compact' ? '3px' : key === 'spacious' ? '5px' : '4px',
  previewPadding: '0 4px',
  previewRowCount: meta.rows
}))

const TimeSettingsSection = memo(function TimeSettingsSection({ panelElement }: { panelElement: HTMLElement | null }) {
  const timeSettings = useNewtabTimeSettingsView()

  return (
    <section className={SETTINGS_SECTION_CLASS} data-settings-group="appearance" aria-labelledby="settings-time-title">
      <h2 id="settings-time-title" className={SETTINGS_SECTION_TITLE_CLASS}>时间和日期</h2>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <SwitchRow
          id="time-enabled"
          title="显示时间和日期"
          checked={timeSettings.enabled}
          onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('enabled', checked)}
        />
        {timeSettings.enabled ? <>
          <SettingsSelect
            id="time-display-mode"
            label="显示内容"
            ariaLabel="时间显示内容"
            onValueChange={(value) => {
              if (value) dispatchNewtabTimeSettingFieldChange('displayMode', value)
            }}
            portalContainer={panelElement}
            value={timeSettings.displayMode}
            options={[['time-date', '时间和日期'], ['time', '仅时间'], ['date', '仅日期']]}
          />
          <SettingsSelect
            id="time-density"
            label="样式"
            ariaLabel="时间布局密度"
            onValueChange={(value) => {
              if (value) dispatchNewtabTimeSettingFieldChange('density', value)
            }}
            portalContainer={panelElement}
            value={timeSettings.density}
            options={[['compact', '单行'], ['balanced', '胶囊'], ['comfortable', '卡片']]}
          />
          <SettingsDetails id="time-details" title="时间格式">
            <SettingsSelect
              id="time-time-zone"
              label="时区"
              ariaLabel="时区"
              onValueChange={(value) => {
                if (value) dispatchNewtabTimeSettingFieldChange('timeZone', value)
              }}
              portalContainer={panelElement}
              value={timeSettings.timeZone}
              options={[['auto', '自动跟随系统'], ['UTC', 'UTC'], ['Asia/Shanghai', '北京'], ['Asia/Hong_Kong', '香港'], ['Asia/Tokyo', '东京'], ['Asia/Singapore', '新加坡'], ['Europe/London', '伦敦'], ['Europe/Paris', '巴黎'], ['America/New_York', '纽约'], ['America/Los_Angeles', '洛杉矶']]}
            />
            {timeSettings.displayMode !== 'time' ? (
              <SettingsSelect
                id="time-date-format"
                label="日期格式"
                ariaLabel="日期格式"
                onValueChange={(value) => {
                  if (value) dispatchNewtabTimeSettingFieldChange('dateFormat', value)
                }}
                portalContainer={panelElement}
                value={timeSettings.dateFormat}
                options={[['year-month-day-weekday', '2026.05.01 周五'], ['chinese-date-weekday', '2026年5月1日 周五'], ['month-day-weekday', '05.01 周五'], ['weekday-month-day', '周五 05/01'], ['weekday-day-month', '周五 01/05'], ['year-month-day', '2026.05.01']]}
              />
            ) : null}
            {timeSettings.displayMode !== 'date' ? <>
              <SwitchRow
                id="time-show-seconds"
                title="显示秒数"
                checked={timeSettings.showSeconds}
                onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('showSeconds', checked)}
              />
              <SwitchRow
                id="time-hour12"
                title="12 小时制"
                checked={timeSettings.hour12}
                onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('hour12', checked)}
              />
            </> : null}
          </SettingsDetails>
        </> : null}
      </Surface>
    </section>
  )
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
  const sizePreset = getSearchSizePreset(searchSettings.height)
  const enabledEngineSet = new Set(searchSettings.enabledEngines)
  const handleSearchEngineToggle = (engine: string, checked: boolean) => {
    const currentEngines = searchSettings.enabledEngines.includes(searchSettings.engine)
      ? searchSettings.enabledEngines
      : [...searchSettings.enabledEngines, searchSettings.engine]
    const nextEngines = checked
      ? [...new Set([...currentEngines, engine])]
      : currentEngines.filter((item) => item !== engine)

    dispatchNewtabSearchSettingFieldChange('enabledEngines', nextEngines)
  }

  return (
    <section ref={sectionRef} className={SETTINGS_SECTION_CLASS} data-settings-group="search" aria-labelledby="settings-search-title">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="settings-search-title" className={SETTINGS_SECTION_TITLE_CLASS}>搜索栏</h2>
        {searchSettings.enabled ? <Button id="search-reset-layout" variant="ghost" size="sm" onClick={dispatchNewtabSearchLayoutReset}>恢复默认布局</Button> : null}
      </div>
      <Surface className={SETTINGS_LIST_CLASS} variant="plain">
        <SwitchRow
          id="search-enabled"
          title="显示搜索栏"
          controlRef={firstControlRef}
          checked={searchSettings.enabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('enabled', checked)}
        />
        {searchSettings.enabled ? <>
          <SettingsSelect
            id="search-engine"
            label="网页搜索"
            ariaLabel="默认搜索引擎"
            onValueChange={(value) => {
              if (value) dispatchNewtabSearchWebEngineChange(value === 'bookmarks' ? null : value)
            }}
            portalContainer={panelElement}
            value={searchSettings.webSearchEnabled ? searchSettings.engine : 'bookmarks'}
            options={[['bookmarks', '关闭，仅搜索书签'], ...searchEngines.map(([value, label]) => [value, label] as const)]}
          />
          <div className={settingRowClassName()}>
            <SettingLabelStack title="尺寸" description={sizePreset === 'custom' ? `自定义 · ${searchSettings.height}px` : undefined} />
            <ToggleGroup
              id="search-size-control"
              slidingIndicator
              aria-label="搜索栏尺寸"
              className={SETTINGS_SEGMENTED_CLASS}
              itemClassName={settingsControlClassName(SETTINGS_SEGMENTED_BUTTON_CLASS)}
              value={sizePreset}
              onValueChange={(value) => {
                const key = value[0] as SearchSizePreset | undefined
                if (key && key in SEARCH_SIZE_PRESETS) {
                  dispatchNewtabSearchSettingFieldChange('height', SEARCH_SIZE_PRESETS[key])
                }
              }}
              items={[
                { value: 'compact', label: '紧凑' },
                { value: 'standard', label: '标准' },
                { value: 'comfortable', label: '宽松' }
              ]}
              unstyled
            />
          </div>
          <SettingsDetails id="search-details" title="更多搜索设置">
            {searchSettings.webSearchEnabled ? <>
              <SwitchRow
                id="search-open-new-tab"
                title="在新标签页打开网页"
                checked={searchSettings.openInNewTab}
                onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('openInNewTab', checked)}
              />
              <div className={settingRowClassName(SEARCH_ENGINE_ROW_CLASS)}>
                <SettingLabelStack title="快捷引擎" description={`Cmd/Ctrl+Enter 同时搜索前 ${SEARCH_MULTI_OPEN_LIMIT} 个。`} />
                <div className={SEARCH_ENGINE_GRID_CLASS} aria-label="启用的搜索引擎">
                  {searchEngines.map(([value, label]) => {
                    const isSelected = searchSettings.engine === value
                    const checked = enabledEngineSet.has(value) || isSelected
                    return (
                      <label
                        className={settingsControlClassName(SEARCH_ENGINE_TOGGLE_CLASS, checked ? SETTINGS_SELECTED_SURFACE_CLASS : undefined, isSelected ? 'opacity-80' : undefined)}
                        key={value}
                      >
                        <SwitchControl
                          aria-label={label}
                          checked={checked}
                          disabled={isSelected}
                          className={SEARCH_ENGINE_HIDDEN_SWITCH_CLASS}
                          data-search-engine-toggle={value}
                          onCheckedChange={(checked) => handleSearchEngineToggle(value, checked)}
                          syncInputState
                          unstyled
                        />
                        <span>{label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </> : null}
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
                  ? [['custom', `自定义 · ${searchSettings.offsetY}px`] as const]
                  : [])
              ]}
              onValueChange={(value) => {
                if (!value || value === 'custom') return
                dispatchNewtabSearchSettingFieldChange('offsetY', 0)
                dispatchNewtabSearchSettingToggle('autoVerticalCenter', value === 'center')
              }}
            />
            <div className={settingRowClassName()}>
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
          </SettingsDetails>
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
        folderCandidateSearchRef.current?.focus()
        return
      }

      firstControlRefs.current[layoutRequest.section]?.focus()
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
                  <TimeSettingsSection panelElement={panelElement} />
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
