import { useEffect, useState } from 'react'
import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { Surface } from '../../ui/base/Surface'
import { ToggleGroup } from '../../ui/base/ToggleGroup'
import { Button } from '../../ui/primitives/Button'
import { DrawerOverlay, DrawerPanel } from '../../ui/primitives/Drawer'
import { Input } from '../../ui/primitives/Input'
import { Select } from '../../ui/primitives/Select'
import { SliderControl } from '../../ui/primitives/Slider'
import { SwitchControl } from '../../ui/primitives/Switch'
import { Icon } from '../../ui/icons/Icon'
import { SettingsDrawerClose } from './SettingsDrawerClose'
import {
  ICON_PRESET_META,
  type IconLayoutPresetKey
} from '../icon-settings'
import {
  dispatchNewtabIconShowTitlesToggle,
  dispatchNewtabIconVerticalCenterToggle,
  useNewtabIconPreviewView
} from '../newtab-icon-preview-store'
import {
  dispatchNewtabTimeSettingFieldChange,
  dispatchNewtabTimeSettingToggle,
  useNewtabTimeSettingsView
} from '../newtab-time-settings-store'
import {
  dispatchNewtabSearchSettingToggle,
  useNewtabSearchSettingsView
} from '../newtab-search-settings-store'
import {
  dispatchNewtabBackgroundMaskToggle,
  useNewtabBackgroundSettingsView
} from '../newtab-background-settings-store'
import type { SettingsDrawerSection } from '../settings-group-sync'
import {
  dispatchNewtabSettingsDrawerActiveGroup,
  dispatchNewtabSettingsDrawerFeaturedPickerClick,
  dispatchNewtabSettingsDrawerOpenChange,
  dispatchNewtabSettingsDrawerReady,
  useNewtabSettingsDrawerView
} from '../newtab-settings-drawer-store'
import {
  dispatchNewtabModuleSettingMove,
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
  dispatchNewtabGeneralSettingToggle,
  dispatchNewtabSelectedFolderRemove,
  useNewtabFolderSourceView,
  type NewtabFolderCandidateItemView,
  type NewtabFolderCandidateState,
  type NewtabSelectedFolderSourceItemView,
  type NewtabSelectedFolderSourceState
} from '../newtab-folder-source-store'

const settingsTabs = [
  ['source', '来源', true],
  ['appearance', '外观', false],
  ['search', '搜索', false],
  ['modules', '模块', false],
  ['advanced', '高级', false]
] as const

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
  onCheckedChange
}: {
  id: string
  title: string
  description: string
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <label className={`setting-row${disabled ? ' setting-row-disabled' : ''}`}>
      <span className="setting-label-stack">
        <span>{title}</span>
        <small>{description}</small>
      </span>
      <SwitchControl
        id={id}
        className="setting-switch"
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        inputClassName="setting-switch-input"
        onCheckedChange={onCheckedChange}
        syncInputState
        thumbClassName="setting-switch-thumb"
        unstyled
      />
    </label>
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
  sliderValue
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
  sliderValue?: number
}) {
  return (
    <label id={rowId} className={`setting-row slider-row${disabled ? ' setting-row-disabled' : ''}`} hidden={hidden}>
      <span className={description ? 'setting-label-stack' : undefined}>
        <span>
          {label} <output id={valueId} className="setting-value">{value}</output>
        </span>
        {description ? <small>{description}</small> : null}
      </span>
      <SliderControl
        id={id}
        ariaLabel={ariaLabel}
        className="setting-slider"
        controlClassName="setting-slider-control"
        defaultValue={defaultValue}
        disabled={disabled}
        indicatorClassName="setting-slider-indicator"
        inputClassName="setting-range"
        max={max}
        min={min}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
        syncInputState
        thumbClassName="setting-slider-thumb"
        trackClassName="setting-slider-track"
        unstyled
        value={sliderValue}
      />
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
  value
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
}) {
  return (
    <div className={`setting-row${disabled ? ' setting-row-disabled' : ''}`}>
      <span className="setting-label-stack">
        <span>{label}</span>
        {description ? <small>{description}</small> : null}
      </span>
      <Select
        id={id}
        defaultValue={defaultValue}
        disabled={disabled}
        inputAttributes={{ 'aria-label': ariaLabel, id }}
        inputClassName="setting-select-input"
        itemClassName="custom-select-option"
        onValueChange={onValueChange}
        options={options.map(([value, label]) => ({ value, label }))}
        modal={false}
        popupClassName="custom-select-setting-list"
        portalContainer={portalContainer}
        positionerClassName="custom-select-setting-positioner"
        syncInputState
        triggerClassName="setting-select custom-select-trigger"
        unstyled
        value={value}
        valueClassName="custom-select-trigger-label"
      />
    </div>
  )
}

export interface SettingsDrawerProps {
  open: boolean
  activeGroup: SettingsDrawerSection
  onActiveGroupChange: (group: SettingsDrawerSection) => void
  onOpenChange: (open: boolean, event?: Event) => void
}

function SettingsDrawerHeader() {
  return (
    <header className="settings-drawer-header">
      <p className="settings-drawer-kicker">New Tab</p>
      <h1 id="newtab-settings-title">新标签页设置</h1>
      <p id="newtab-settings-summary" className="settings-drawer-summary">书签来源、背景、卡片布局、时间与搜索栏。</p>
      <output id="settings-save-status" className="settings-save-status" aria-live="polite" data-state="idle" />
    </header>
  )
}

function SettingsDrawerTabs({
  activeGroup,
  onActiveGroupChange
}: {
  activeGroup: SettingsDrawerSection
  onActiveGroupChange: (group: SettingsDrawerSection) => void
}) {
  return (
    <BaseTabs.Root
      className="settings-sliding-tabs-root"
      value={activeGroup}
      onValueChange={(value) => {
        onActiveGroupChange(value as SettingsDrawerSection)
      }}
    >
      <BaseTabs.List className="settings-sliding-tabs t-tabs" data-settings-tabs aria-label="新标签页设置分组">
        <span className="settings-sliding-tabs-pill t-tabs-pill" aria-hidden="true"></span>
        {settingsTabs.map(([group, label]) => {
          const selected = activeGroup === group
          return (
            <BaseTabs.Tab
              className="settings-sliding-tab t-tab"
              value={group}
              id={`settings-tab-${group}`}
              data-settings-group-tab={group}
              aria-controls={`settings-panel-${group}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              key={group}
            >
              {label}
            </BaseTabs.Tab>
          )
        })}
      </BaseTabs.List>
    </BaseTabs.Root>
  )
}

function AdvancedSettingsSection() {
  const folderSource = useNewtabFolderSourceView()

  return (
    <section className="settings-section" data-settings-group="advanced" aria-labelledby="settings-general-title">
      <h2 id="settings-general-title">高级</h2>
      <Surface className="settings-list" variant="plain">
        <SwitchRow
          id="general-hide-settings-trigger"
          title="隐藏设置图标"
          description="桌面端移到右上角时显示，触屏设备始终显示。"
          checked={folderSource.general.hideSettingsTrigger}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('hideSettingsTrigger', checked)
          }}
        />
        <SwitchRow
          id="general-open-bookmarks-new-tab"
          title="新标签页打开"
          description="点击书签图标时在新标签页打开，当前新标签页保持不变。"
          checked={folderSource.general.openBookmarksInNewTab}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('openBookmarksInNewTab', checked)
          }}
        />
      </Surface>
    </section>
  )
}

function SourceSettingsSection() {
  const folderSource = useNewtabFolderSourceView()
  const candidatesPanelClassName = folderSource.candidatesExpanded
    ? 'folder-candidates-panel is-expanded'
    : 'folder-candidates-panel is-collapsed'

  return (
    <section className="settings-section" data-settings-group="source" aria-labelledby="settings-folder-title">
      <h2 id="settings-folder-title">书签来源</h2>
      <Surface className="settings-list" variant="plain">
        <div className="folder-source-panel">
          <div className="folder-source-summary">
            <span>已选文件夹</span>
            <strong id="folder-selected-count">{folderSource.selectedCount}</strong>
          </div>
          <div id="folder-selected-list" className="folder-selected-list">
            <SelectedFolderSourceList state={folderSource.selected} />
          </div>
          <Button
            unstyled
            id="folder-candidates-toggle"
            className={folderSource.candidatesExpanded ? 'folder-candidates-toggle expanded' : 'folder-candidates-toggle'}
            type="button"
            aria-expanded={folderSource.candidatesExpanded}
            aria-controls="folder-candidates-panel"
            onClick={dispatchNewtabFolderCandidatesToggle}
          >
            <span data-folder-toggle-label>
              {folderSource.candidatesExpanded ? '收起候选文件夹' : '展开候选文件夹'}
            </span>
          </Button>
          <div
            id="folder-candidates-panel"
            className={candidatesPanelClassName}
            aria-hidden={!folderSource.candidatesExpanded}
            inert={!folderSource.candidatesExpanded}
          >
            <div className="reveal-panel-body">
              <label className="folder-search-field" htmlFor="folder-candidate-search">
                <Input
                  id="folder-candidate-search"
                  className="folder-search-input"
                  type="search"
                  placeholder="搜索文件夹"
                  aria-label="搜索候选文件夹"
                  aria-controls="folder-candidate-list"
                  spellCheck={false}
                  value={folderSource.candidateQuery}
                  onValueChange={dispatchNewtabFolderCandidateQueryChange}
                  onKeyDown={(event) => {
                    if (dispatchNewtabFolderCandidateSearchKeyDown(event.key)) {
                      event.preventDefault()
                    }
                  }}
                  unstyled
                />
              </label>
              <div
                id="folder-candidate-list"
                className="folder-candidate-list"
                aria-label="候选文件夹列表"
              >
                <FolderCandidateList state={folderSource.candidates} />
              </div>
            </div>
          </div>
        </div>
        <SwitchRow
          id="folder-hide-names"
          title="隐藏文件夹名"
          description="只保留图标网格，适合单一来源或极简布局。"
          checked={folderSource.hideFolderNames}
          onCheckedChange={dispatchNewtabFolderHideNamesToggle}
        />
        <SwitchRow
          id="folder-show-source-navigation"
          title="显示来源导航"
          description="在多个来源之间快速跳转，不影响文件夹和书签拖拽排序。"
          checked={folderSource.general.showSourceNavigation}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('showSourceNavigation', checked)
          }}
        />
      </Surface>
    </section>
  )
}

function SelectedFolderSourceList({ state }: { state: NewtabSelectedFolderSourceState }) {
  if (state.type === 'empty') {
    return <p className="folder-source-empty">{state.message}</p>
  }

  return (
    <>
      {state.items.map((item) => (
        <div className="folder-source-selected-item" key={item.folderId}>
          <span className="folder-source-selected-copy">
            <strong>{item.title}</strong>
            <span>{item.path}</span>
            <span>{item.stats}</span>
          </span>
          <Button
            className="folder-source-remove"
            type="button"
            data-folder-remove-id={item.folderId}
            aria-label={getFolderSourceRemoveLabel(item)}
            title={getFolderSourceRemoveLabel(item)}
            onClick={() => {
              dispatchNewtabSelectedFolderRemove(item.folderId)
            }}
            unstyled
          >
            <Icon name="X" size={12} aria-hidden="true" />
          </Button>
        </div>
      ))}
    </>
  )
}

function getFolderSourceRemoveLabel(item: NewtabSelectedFolderSourceItemView): string {
  return `从新标签页移除「${item.title || '文件夹'}」，将隐藏 ${item.affectedCount} 个书签，不会删除书签`
}

function FolderCandidateList({ state }: { state: NewtabFolderCandidateState }) {
  if (state.type === 'empty') {
    return (
      <p className="folder-source-empty" role="status" aria-live="polite">
        {state.message}
      </p>
    )
  }

  return (
    <>
      {state.items.map((item) => (
        <FolderCandidateItem item={item} key={item.folderId} />
      ))}
    </>
  )
}

function FolderCandidateItem({ item }: { item: NewtabFolderCandidateItemView }) {
  return (
    <Button
      className={item.selected ? 'folder-candidate-card selected' : 'folder-candidate-card'}
      type="button"
      data-folder-candidate-id={item.folderId}
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
        if (dispatchNewtabFolderCandidateKeyDown(event.key)) {
          event.preventDefault()
        }
      }}
      unstyled
    >
      <span className="folder-candidate-copy">
        <strong>{item.title || '未命名文件夹'}</strong>
        <span>{item.path || item.title || '未命名文件夹'}</span>
        <span>{item.stats}</span>
      </span>
      <span className="folder-candidate-badge">{item.badge}</span>
    </Button>
  )
}

function ModuleSettingsSection() {
  const moduleSettings = useNewtabModuleSettingsView()
  const folderSource = useNewtabFolderSourceView()

  return (
    <section className="settings-section" data-settings-group="modules" aria-labelledby="settings-speed-dial-title">
      <h2 id="settings-speed-dial-title">模块</h2>
      <Surface className="settings-list" variant="plain">
        <SwitchRow
          id="general-show-quick-access"
          title="显示 Curator 常用和新近添加"
          description="仅基于当前来源内的固定、本页打开记录和添加时间，不读取浏览历史。"
          checked={folderSource.general.showQuickAccess}
          onCheckedChange={(checked) => {
            dispatchNewtabGeneralSettingToggle('showQuickAccess', checked)
          }}
        />
        <div id="newtab-speed-dial-setting" className="newtab-module-settings-list" aria-label="Speed Dial 模块">
          {moduleSettings.rows.map((row) => (
            <ModuleSettingRow row={row} key={row.key} />
          ))}
        </div>
      </Surface>
    </section>
  )
}

function ModuleSettingRow({ row }: { row: NewtabModuleSettingRowView }) {
  return (
    <div className="setting-row newtab-module-setting-row" data-module-setting-row={row.key}>
      <span className="setting-label-stack">
        <span>{row.label}</span>
        <small>{row.description}</small>
      </span>
      <span className="module-setting-controls">
        <Button
          className="module-setting-order-button"
          type="button"
          data-module-setting-move={row.key}
          data-module-setting-direction="up"
          disabled={row.index <= 0}
          aria-label={`上移模块：${row.label}`}
          title={`上移 ${row.label}`}
          onClick={() => {
            dispatchNewtabModuleSettingMove(row.key, -1)
          }}
          unstyled
        >
          {'\u2191'}
        </Button>
        <Button
          className="module-setting-order-button"
          type="button"
          data-module-setting-move={row.key}
          data-module-setting-direction="down"
          disabled={row.index >= row.total - 1}
          aria-label={`下移模块：${row.label}`}
          title={`下移 ${row.label}`}
          onClick={() => {
            dispatchNewtabModuleSettingMove(row.key, 1)
          }}
          unstyled
        >
          {'\u2193'}
        </Button>
        <span className="module-setting-switch-label">
          <SwitchControl
            aria-label={`${row.enabled ? '隐藏' : '显示'}模块：${row.label}`}
            checked={row.enabled}
            className="setting-switch"
            inputAttributes={{ 'data-module-setting-toggle': row.key }}
            inputClassName="setting-switch-input"
            onCheckedChange={(checked) => {
              dispatchNewtabModuleSettingToggle(row.key, checked)
            }}
            syncInputState
            thumbClassName="setting-switch-thumb"
            unstyled
          />
        </span>
      </span>
    </div>
  )
}

function BackgroundSettingsSection({ panelElement }: { panelElement: HTMLElement | null }) {
  const backgroundSettings = useNewtabBackgroundSettingsView()

  return (
    <section className="settings-section" data-settings-group="appearance" aria-labelledby="settings-background-title">
      <h2 id="settings-background-title">背景</h2>
      <Surface className="settings-list" variant="plain">
        <SettingsSelect
          id="background-type"
          label="背景类型"
          description="可选择精选图库、纯色、本地图片/视频或远程图片链接。"
          ariaLabel="背景类型"
          defaultValue="color"
          portalContainer={panelElement}
          options={[
            ['featured', '精选图库'],
            ['image', '图片'],
            ['video', '视频'],
            ['urls', '图片链接'],
            ['color', '纯色']
          ]}
        />
        <div id="background-featured-row" className="setting-row">
          <span className="setting-label-stack">
            <span>精选图库</span>
            <small>主动选择后会访问 NASA 与 Wikimedia Commons 等第三方图片域名并自动缓存。</small>
          </span>
          <Button
            unstyled
            id="background-featured-picker"
            className="setting-picker-button"
            type="button"
            aria-haspopup="dialog"
            aria-controls="background-featured-modal"
            onClick={() => {
              dispatchNewtabSettingsDrawerFeaturedPickerClick()
            }}
          >
            <span id="background-featured-picker-label">选择壁纸</span>
          </Button>
          <Input id="background-featured-id" type="hidden" defaultValue="" unstyled />
        </div>
        <div id="background-featured-credit-row" className="setting-row background-featured-credit-row">
          <span>图片来源</span>
          <a id="background-featured-credit" className="background-featured-credit" href="https://images.nasa.gov/" target="_blank" rel="noreferrer">NASA Image and Video Library</a>
        </div>
        <SliderRow rowId="background-featured-display-size-row" id="background-featured-display-size" label="背景大小" valueId="background-featured-display-size-value" value="100%" min="50" max="180" defaultValue="100" ariaLabel="精选图库背景大小" />
        <SliderRow rowId="background-featured-position-x-row" id="background-featured-position-x" label="水平位置" valueId="background-featured-position-x-value" value="50%" min="0" max="100" defaultValue="50" ariaLabel="精选图库背景水平位置" />
        <SliderRow rowId="background-featured-position-y-row" id="background-featured-position-y" label="垂直位置" valueId="background-featured-position-y-value" value="50%" min="0" max="100" defaultValue="50" ariaLabel="精选图库背景垂直位置" />
        <label id="background-color-row" className="setting-row" htmlFor="background-color">
          <span>背景颜色</span>
          <span id="background-color-control" className="setting-color">
            <span id="background-color-value">#000000</span>
            <Input id="background-color" className="setting-color-input" type="color" defaultValue="#000000" aria-label="背景颜色" unstyled />
          </span>
        </label>
        <div id="background-image-row" className="setting-row" hidden>
          <span>背景图片</span>
          <Button unstyled id="background-image-picker" className="setting-file-button" type="button">选择图片</Button>
          <Input id="background-image-file" className="setting-file-input" type="file" accept="image/*" unstyled />
        </div>
        <div id="background-video-row" className="setting-row" hidden>
          <span>背景视频</span>
          <Button unstyled id="background-video-picker" className="setting-file-button" type="button">选择视频</Button>
          <Input id="background-video-file" className="setting-file-input" type="file" accept="video/*" unstyled />
        </div>
        <div id="background-url-row" className="setting-row" hidden>
          <span>图片链接</span>
          <span className="setting-floating-field">
            <Input id="background-url" className="setting-url-input" type="url" placeholder="图片链接" aria-label="背景图片链接" spellCheck={false} unstyled />
          </span>
        </div>
        <output id="background-status" className="setting-status" aria-live="polite" hidden />
        <SwitchRow
          id="background-mask-enabled"
          title="背景蒙版"
          description="提升复杂背景上的图标和文字可读性。"
          checked={backgroundSettings.maskEnabled}
          onCheckedChange={dispatchNewtabBackgroundMaskToggle}
        />
        <div id="background-mask-style-row" className="setting-row" hidden>
          <span>模糊样式</span>
          <Select
            id="background-mask-style"
            inputAttributes={{ 'aria-label': '背景蒙版样式', id: 'background-mask-style' }}
            inputClassName="setting-select-input"
            itemClassName="custom-select-option"
            options={[
              { value: 'dark', label: '暗色增强' },
              { value: 'frosted', label: '磨砂柔化' },
              { value: 'noise', label: '胶片噪点' },
              { value: 'light', label: '亮色柔化' }
            ]}
            popupClassName="custom-select-setting-list"
            modal={false}
            portalContainer={panelElement}
            positionerClassName="custom-select-setting-positioner"
            syncInputState
            triggerClassName="setting-select custom-select-trigger"
            unstyled
            valueClassName="custom-select-trigger-label"
          />
        </div>
        <SliderRow rowId="background-mask-blur-row" id="background-mask-blur" label="模糊程度" valueId="background-mask-blur-value" value="12px" min="0" max="32" defaultValue="12" ariaLabel="背景蒙版模糊程度" hidden />
      </Surface>
    </section>
  )
}

function IconSettingsSection() {
  const iconPreview = useNewtabIconPreviewView()
  const previewStyle = {
    '--preview-page-width': `${iconPreview.pageWidth}%`,
    '--preview-column-gap': `${iconPreview.previewColumnGap}px`,
    '--preview-grid-max-width': `${iconPreview.previewGridMaxWidth}px`,
    '--preview-row-gap': `${iconPreview.previewRowGap}px`,
    '--preview-shell-size': `${iconPreview.previewShellSize}px`,
    '--preview-tile-width': `${iconPreview.previewTileWidth}px`,
    '--preview-title-lines': String(iconPreview.titleLines)
  } as React.CSSProperties

  return (
    <section className="settings-section" data-settings-group="appearance" aria-labelledby="settings-icon-title">
      <h2 id="settings-icon-title">书签卡片</h2>
      <Surface className="settings-list icon-settings-list" variant="plain">
        <div className="icon-live-preview-panel">
          <div className="icon-live-preview-header">
            <span>实时预览</span>
            <span id="icon-live-preview-summary" className="icon-live-preview-summary">
              {iconPreview.summary}
            </span>
          </div>
          <figure
            id="icon-live-preview"
            className="icon-live-preview"
            aria-label="书签卡片布局预览"
            data-icon-layout-mode={iconPreview.layoutMode}
            data-icon-show-titles={String(iconPreview.showTitles)}
            style={previewStyle}
          >
            <div
              className="icon-live-preview-grid"
              style={{ gridTemplateColumns: `repeat(${iconPreview.columns}, minmax(0, 1fr))` }}
            >
              {iconPreview.tiles.map((item) => (
                <span className="icon-live-preview-tile" key={item.id}>
                  <span className="icon-live-preview-shell">
                    <span className="icon-live-preview-mark">{item.mark}</span>
                  </span>
                  <span className="icon-live-preview-title">{item.title}</span>
                </span>
              ))}
            </div>
          </figure>
        </div>
        <div id="icon-preset-row" className="icon-preset-row">
          {iconPresetCards.map((card) => (
            <Button
              className="icon-preset-card"
              type="button"
              data-preset={card.key}
              aria-pressed="false"
              aria-label={`${card.name}布局，${card.desc}，${card.detail}`}
              key={card.key}
              unstyled
            >
              <span
                className="icon-preset-preview"
                style={{
                  gap: card.previewGap,
                  gridTemplateColumns: `repeat(${card.previewColumnCount}, 1fr)`,
                  padding: card.previewPadding
                }}
              >
                {Array.from({ length: card.previewColumnCount * card.previewRowCount }, (_, index) => (
                  <span
                    className="icon-preset-preview-cell"
                    style={{ height: card.previewCellHeight }}
                    key={`${card.key}:${index}`}
                  />
                ))}
              </span>
              <span className="icon-preset-name">{card.name}</span>
              <span className="icon-preset-desc">{card.desc}</span>
              <span className="icon-preset-detail">{card.detail}</span>
            </Button>
          ))}
        </div>
        <div className="setting-row icon-control-row">
          <span className="setting-label-stack">
            <span>布局方式</span>
            <small>自动适配屏幕宽度；固定列数会在窄屏收缩。</small>
          </span>
          <ToggleGroup
            id="icon-layout-control"
            aria-label="布局方式"
            className="setting-segmented"
            itemClassName="setting-segmented-button"
            items={[
              { value: 'auto', label: '自动适配', attributes: { 'data-icon-layout-mode': 'auto' } },
              { value: 'fixed', label: '固定列数', attributes: { 'data-icon-layout-mode': 'fixed' } }
            ]}
            unstyled
          />
        </div>
        <SwitchRow
          id="icon-vertical-center"
          title="垂直居中"
          description="书签较少时让主内容贴近屏幕中部。"
          checked={iconPreview.verticalCenter}
          onCheckedChange={dispatchNewtabIconVerticalCenterToggle}
        />
        <SwitchRow
          id="icon-show-titles"
          title="显示标题"
          description="关闭后卡片收缩为只显示网站图标。"
          checked={iconPreview.showTitles}
          onCheckedChange={dispatchNewtabIconShowTitlesToggle}
        />
        <div id="icon-title-lines-row" className="setting-row icon-control-row">
          <span>标题行数</span>
          <ToggleGroup
            id="icon-title-lines-control"
            aria-label="标题行数"
            className="setting-segmented"
            itemClassName="setting-segmented-button"
            items={[
              { value: '1', label: '1 行', attributes: { 'data-icon-title-lines': '1' } },
              { value: '2', label: '2 行', attributes: { 'data-icon-title-lines': '2' } }
            ]}
            unstyled
          />
        </div>
        <Button unstyled id="icon-advanced-toggle" className="icon-advanced-toggle" type="button" aria-expanded="false" aria-controls="icon-advanced-panel">
          <span>卡片细节</span>
        </Button>
        <div id="icon-advanced-panel" className="icon-advanced-panel" hidden>
          <div className="reveal-panel-body">
            <Button unstyled id="icon-reset-defaults" className="icon-reset-defaults" type="button">恢复默认布局</Button>
            <SliderRow id="icon-page-width" label="页面宽度" valueId="icon-page-width-value" value="78%" min="16" max="100" defaultValue="78" ariaLabel="书签卡片页面宽度" />
            <SliderRow rowId="icon-tile-width-row" id="icon-tile-width" label="卡片宽度" valueId="icon-tile-width-value" value="184px" min="132" max="260" defaultValue="184" ariaLabel="书签卡片宽度" />
            <SliderRow id="icon-shell-size" label="图标区域" valueId="icon-shell-size-value" value="32px" min="24" max="48" defaultValue="32" ariaLabel="书签图标区域尺寸" />
            <SliderRow id="icon-column-gap" label="横向间距" valueId="icon-column-gap-value" value="24px" min="0" max="100" defaultValue="10" ariaLabel="书签卡片横向间距" />
            <SliderRow id="icon-row-gap" label="行距" valueId="icon-row-gap-value" value="12px" min="0" max="100" defaultValue="10" ariaLabel="书签卡片行距" />
            <SliderRow id="icon-folder-gap" label="文件夹间距" valueId="icon-folder-gap-value" value="20px" min="0" max="120" defaultValue="20" ariaLabel="书签文件夹间距" />
            <SliderRow rowId="icon-columns-row" id="icon-columns" label="固定列数" valueId="icon-columns-value" value="4" min="2" max="8" defaultValue="4" ariaLabel="书签卡片固定列数" />
          </div>
        </div>
      </Surface>
    </section>
  )
}

const iconPresetCards = (Object.entries(ICON_PRESET_META) as Array<[
  IconLayoutPresetKey,
  typeof ICON_PRESET_META[IconLayoutPresetKey]
]>).map(([key, meta]) => ({
  desc: meta.desc,
  detail: meta.detail,
  key,
  name: meta.name,
  previewCellHeight: key === 'compact' ? '8px' : key === 'spacious' ? '12px' : '10px',
  previewColumnCount: meta.cols,
  previewGap: key === 'compact' ? '3px' : key === 'spacious' ? '5px' : '4px',
  previewPadding: '0 4px',
  previewRowCount: meta.rows
}))

function TimeSettingsSection({ panelElement }: { panelElement: HTMLElement | null }) {
  const timeSettings = useNewtabTimeSettingsView()

  return (
    <section className="settings-section" data-settings-group="appearance" aria-labelledby="settings-time-title">
      <h2 id="settings-time-title">时间和日期</h2>
      <Surface className="settings-list" variant="plain">
        <SwitchRow
          id="time-enabled"
          title="显示时间模块"
          description="放在搜索栏上方，关闭后保留原布局间距。"
          checked={timeSettings.enabled}
          onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('enabled', checked)}
        />
        <SettingsSelect
          id="time-display-mode"
          label="显示内容"
          description="保留时间+日期、仅时间、仅日期三种模式。"
          ariaLabel="时间显示内容"
          disabled={timeSettings.settingsDisabled}
          onValueChange={(value) => {
            if (value) dispatchNewtabTimeSettingFieldChange('displayMode', value)
          }}
          portalContainer={panelElement}
          value={timeSettings.displayMode}
          options={[['time-date', '时间和日期'], ['time', '仅时间'], ['date', '仅日期']]}
        />
        <SettingsSelect
          id="time-time-zone"
          label="时区"
          description="自动跟随系统，也可固定为常用城市。"
          ariaLabel="时区"
          disabled={timeSettings.settingsDisabled}
          onValueChange={(value) => {
            if (value) dispatchNewtabTimeSettingFieldChange('timeZone', value)
          }}
          portalContainer={panelElement}
          value={timeSettings.timeZone}
          options={[['auto', '自动跟随系统'], ['UTC', 'UTC'], ['Asia/Shanghai', '北京'], ['Asia/Hong_Kong', '香港'], ['Asia/Tokyo', '东京'], ['Asia/Singapore', '新加坡'], ['Europe/London', '伦敦'], ['Europe/Paris', '巴黎'], ['America/New_York', '纽约'], ['America/Los_Angeles', '洛杉矶']]}
        />
        <SettingsSelect
          id="time-date-format"
          label="日期格式"
          description="仅在显示日期时生效。"
          ariaLabel="日期格式"
          disabled={timeSettings.settingsDisabled || timeSettings.displayMode === 'time'}
          onValueChange={(value) => {
            if (value) dispatchNewtabTimeSettingFieldChange('dateFormat', value)
          }}
          portalContainer={panelElement}
          value={timeSettings.dateFormat}
          options={[['year-month-day-weekday', '2026.05.01 周五'], ['chinese-date-weekday', '2026年5月1日 周五'], ['month-day-weekday', '05.01 周五'], ['weekday-month-day', '周五 05/01'], ['weekday-day-month', '周五 01/05'], ['year-month-day', '2026.05.01']]}
        />
        <SwitchRow
          id="time-show-seconds"
          title="显示秒数"
          description="开启后每秒更新；关闭时按分钟更新以减少渲染。"
          checked={timeSettings.showSeconds}
          disabled={timeSettings.switchesDisabled}
          onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('showSeconds', checked)}
        />
        <SwitchRow
          id="time-hour12"
          title="12 小时制"
          description="显示 AM/PM，24 小时制会隐藏该标记。"
          checked={timeSettings.hour12}
          disabled={timeSettings.switchesDisabled}
          onCheckedChange={(checked) => dispatchNewtabTimeSettingToggle('hour12', checked)}
        />
        <SettingsSelect
          id="time-density"
          label="布局密度"
          description="切换时间模块的排版结构，不改变字号。"
          ariaLabel="时间布局密度"
          disabled={timeSettings.settingsDisabled}
          onValueChange={(value) => {
            if (value) dispatchNewtabTimeSettingFieldChange('density', value)
          }}
          portalContainer={panelElement}
          value={timeSettings.density}
          options={[['compact', '极简单行'], ['balanced', '平衡胶囊'], ['comfortable', '独立卡片']]}
        />
        <SliderRow
          id="time-clock-size"
          label="字号"
          valueId="time-clock-size-value"
          value={`${timeSettings.clockSize}%`}
          min="70"
          max="140"
          defaultValue="100"
          ariaLabel="时间字号"
          description="只影响时间和日期，不改变搜索和书签区域。"
          disabled={timeSettings.settingsDisabled}
          onValueChange={(value) => dispatchNewtabTimeSettingFieldChange('clockSize', value)}
          sliderValue={timeSettings.clockSize}
        />
      </Surface>
    </section>
  )
}

function SearchSettingsSection({ panelElement }: { panelElement: HTMLElement | null }) {
  const searchSettings = useNewtabSearchSettingsView()

  return (
    <section className="settings-section" data-settings-group="search" aria-labelledby="settings-search-title">
      <h2 id="settings-search-title">搜索栏</h2>
      <Surface className="settings-list" variant="plain">
        <p className="setting-trust-note">仅影响 Curator 新标签页内搜索，不会修改 Chrome 默认搜索引擎或启动页；搜索栏可随时关闭。</p>
        <SwitchRow
          id="search-enabled"
          title="启用"
          description="在新标签页顶部搜索本地书签、命令和可选网页搜索。"
          checked={searchSettings.enabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('enabled', checked)}
        />
        <SwitchRow
          id="search-web-enabled"
          title="启用网页搜索"
          description="提交网页搜索时，关键词会发送给所选搜索引擎；关闭后仅保留本地书签搜索。"
          checked={searchSettings.webSearchEnabled}
          disabled={searchSettings.webSearchDisabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('webSearchEnabled', checked)}
        />
        <SwitchRow
          id="search-open-new-tab"
          title="在新标签页打开链接"
          description="保留当前 Curator 新标签页。"
          checked={searchSettings.openInNewTab}
          disabled={searchSettings.openInNewTabDisabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('openInNewTab', checked)}
        />
        <SettingsSelect id="search-engine" label="搜索引擎" description="输入内容不是网址时使用此引擎。" ariaLabel="默认搜索引擎" portalContainer={panelElement} options={searchEngines.map(([value, label]) => [value, label])} />
        <div className="setting-row search-engine-setting-row">
          <span className="setting-label-stack">
            <span>启用引擎</span>
            <small>决定搜索框快捷菜单和 Cmd/Ctrl+Enter 的打开顺序。</small>
          </span>
          <div className="search-engine-toggle-grid" aria-label="启用的搜索引擎">
            {searchEngines.map(([value, label, checked]) => (
              <label className="search-engine-toggle" key={value}>
                <SwitchControl
                  aria-label={label}
                  defaultChecked={checked}
                  inputAttributes={{ 'data-search-engine-toggle': value }}
                  syncInputState
                  unstyled
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span>占位符文本</span>
          <span className="setting-floating-field">
            <Input id="search-placeholder" className="setting-text-input" type="text" placeholder="占位符文本" maxLength={40} aria-label="搜索栏占位符文本" unstyled />
          </span>
        </div>
        <SliderRow id="search-width" label="宽度" valueId="search-width-value" value="44vw" min="16" max="72" defaultValue="44" ariaLabel="搜索栏宽度" />
        <SliderRow id="search-height" label="高度" valueId="search-height-value" value="40px" min="28" max="56" defaultValue="40" ariaLabel="搜索栏高度" />
        <SliderRow id="search-offset-y" label="上下位置" valueId="search-offset-y-value" value="0px" min="-240" max="240" defaultValue="0" ariaLabel="搜索栏上下位置" />
        <SwitchRow
          id="search-auto-vertical-center"
          title="自动垂直居中"
          description="根据上方和下方模块之间的可用空间自动居中搜索栏。"
          checked={searchSettings.autoVerticalCenter}
          disabled={searchSettings.autoVerticalCenterDisabled}
          onCheckedChange={(checked) => dispatchNewtabSearchSettingToggle('autoVerticalCenter', checked)}
        />
        <SliderRow id="search-background" label="背景" valueId="search-background-value" value="30%" min="0" max="92" defaultValue="30" ariaLabel="搜索栏背景透明度" />
      </Surface>
    </section>
  )
}

export function SettingsDrawerHost() {
  const view = useNewtabSettingsDrawerView()

  useEffect(() => {
    dispatchNewtabSettingsDrawerReady()
  }, [])

  return (
    <SettingsDrawer
      open={view.open}
      activeGroup={view.activeGroup}
      onActiveGroupChange={dispatchNewtabSettingsDrawerActiveGroup}
      onOpenChange={dispatchNewtabSettingsDrawerOpenChange}
    />
  )
}

export function SettingsDrawer({ open, activeGroup, onActiveGroupChange, onOpenChange }: SettingsDrawerProps) {
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null)

  return (
    <DrawerOverlay
      id="newtab-settings-drawer"
      className={open ? 'settings-drawer open' : 'settings-drawer'}
      open={open}
      onOpenChange={onOpenChange}
      triggerId="newtab-settings-trigger"
      aria-hidden={open ? 'false' : 'true'}
      inert={!open}
      tabIndex={-1}
      disablePointerDismissal
    >
      <DrawerPanel
        className="settings-drawer-panel"
        ref={setPanelElement}
        aria-labelledby="newtab-settings-title"
        aria-describedby="newtab-settings-summary"
        initialFocus={false}
        finalFocus={false}
        unanimated
      >
        <SettingsDrawerClose />

        <div className="settings-drawer-scroll">
        <SettingsDrawerHeader />
        <SettingsDrawerTabs activeGroup={activeGroup} onActiveGroupChange={onActiveGroupChange} />
        <AdvancedSettingsSection />
        <SourceSettingsSection />
        <ModuleSettingsSection />
        <BackgroundSettingsSection panelElement={panelElement} />
        <IconSettingsSection />
        <TimeSettingsSection panelElement={panelElement} />
        <SearchSettingsSection panelElement={panelElement} />
        </div>
      </DrawerPanel>
    </DrawerOverlay>
  )
}
