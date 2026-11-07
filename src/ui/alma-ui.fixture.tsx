import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { OptionsApp } from '../options/OptionsApp'
import { FEATURE_SWITCH_CONTENT } from '../options/components/feature-settings-types'
import { createUiViewStoreSlice } from '../shared/ui-view-store'
import { observeMotionPreferences } from '../shared/motion-preferences'
import { navigateToOptionsSectionHash } from '../options/options-section-store'
import { SETTINGS_SEARCH_ITEMS } from '../options/settings-search'
import { useSettingsSearchTarget } from '../options/useSettingsSearchTarget'
import { Button } from './base/Button'
import { CloseButton } from './base/CloseButton'
import { CollapsiblePanel, CollapsibleRoot, CollapsibleTrigger } from './base/Collapsible'
import { Popover } from './base/Popover'
import { SliderControl } from './base/Slider'
import { StatusMessage } from './base/StatusMessage'
import { Icon } from './icons/Icon'
import { ThemeProvider } from './theme/ThemeProvider'
import { SliderWeightFixture } from './base/slider-weight.fixture'

const store = (key: string) => createUiViewStoreSlice<any>('options', key, {})
store('feature-settings-controls').setState({
  loading: false,
  switches: FEATURE_SWITCH_CONTENT.map(item => ({ ...item, checked: true, disabled: false, status: '' })),
  inboxWorkflow: { value: 'keep', disabled: false, status: '' }
})
store('content-snapshot-controls').setState({
  loading: false, enabled: true, saveFullText: true, fullTextDisabled: false, statusCopy: '已保存 21 条索引，17 条全文。'
})
store('shortcut-controls').setState({
  loading: false, statusLabel: '已同步', statusTone: 'success', detail: '',
  list: { kind: 'commands', commands: [{ name: 'save-to-inbox', title: '收藏到待整理', detail: '', shortcut: 'Alt+Shift+S' }] }
})
store('inbox-review').setState({ loading: false, data: null })

const probe = (window as any).__almaUi = {
  mutations: 0,
  actions: [] as string[],
  disposeMotion: () => {},
  installMotion: () => {},
  updateStatus: (_text: string) => {},
  addShimmer: () => {},
  remount: () => {},
  toggle: () => {},
  queueFocus: () => {},
  releaseFocus: () => {},
  navigate: navigateToOptionsSectionHash,
  settings: SETTINGS_SEARCH_ITEMS
}
let disposeMotion: (() => void) | null = null
probe.installMotion = () => { disposeMotion ??= observeMotionPreferences() }
probe.disposeMotion = () => { disposeMotion?.(); disposeMotion = null }

function Controls() {
  const [labels, setLabels] = useState(['正在分析资料'])
  const [text, setText] = useState('正在读取本地内容')
  const [open, setOpen] = useState(true)
  const [generation, setGeneration] = useState(0)
  probe.addShimmer = () => setLabels(labels => [...labels, `正在整理建议 ${labels.length}`])
  probe.updateStatus = setText
  probe.remount = () => { setOpen(true); setGeneration(value => value + 1) }
  probe.toggle = () => setOpen(value => !value)
  return (
    <main className="grid gap-5 p-6" style={{ maxWidth: 760, margin: 'auto' }}>
      <h1 className="m-0 text-lg">交互回归</h1>
      <div id="shimmers" className="grid gap-2">
        {labels.map(label => <span className="t-shimmer w-fit" data-text={label} key={label}>{label}</span>)}
      </div>
      <div id="icon-controls" className="flex items-center gap-2">
        <Button size="icon-xs" aria-label="紧凑设置"><Icon name="Settings" size={14} /></Button>
        <Button size="icon-sm" aria-label="小号设置"><Icon name="Settings" size={16} /></Button>
        <Button size="icon" aria-label="设置"><Icon name="Settings" size={16} /></Button>
        <Button size="icon-lg" aria-label="大号设置"><Icon name="Settings" size={18} /></Button>
        <CloseButton label="关闭" variant="ghost" />
      </div>
      <CollapsibleRoot key={generation} open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger id="disclosure-trigger">已有的展开内容</CollapsibleTrigger>
        <CollapsiblePanel id="disclosure-panel" inert={!open}>
          <label>已保存的输入<input aria-label="已保存的输入" defaultValue="保留这个草稿" /></label>
          <p>恢复页面时保留位置，主动切换才播放展开反馈。</p>
        </CollapsiblePanel>
      </CollapsibleRoot>
      <div id="popover-triggers" className="flex flex-wrap justify-between gap-2">
        {(['top', 'bottom', 'left', 'right'] as const).map(side => (
          <Popover
            key={side} id={`popover-${side}`} side={side} showArrow={false}
            trigger={<Button id={`trigger-${side}`} size="sm">{side}</Button>}
          >
            <label>菜单内输入<input aria-label={`${side} 菜单内输入`} defaultValue="保留焦点" /></label>
            <Popover side="right" showArrow={false} trigger={<Button size="sm">子菜单 {side}</Button>}>
              <Button size="sm">子菜单操作 {side}</Button>
            </Popover>
          </Popover>
        ))}
      </div>
      <SliderControl id="direct-slider" ariaLabel="直接调整" defaultValue={30} />
      <section>
        <StatusMessage id="bounded-status" lines={2} tone={text.startsWith('失败') ? 'error' : 'neutral'}>{text}</StatusMessage>
        <Button id="stable-action" size="sm">保留结果</Button>
      </section>
      <DelayedFocus />
    </main>
  )
}

function DelayedFocus() {
  const main = useRef<HTMLElement>(null)
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  probe.queueFocus = () => { setReady(false); setRevision(value => value + 1) }
  probe.releaseFocus = () => setReady(true)
  useSettingsSearchTarget('backup', revision ? 'full-backup' : '', revision, main)
  return <section ref={main}>
    <label>继续输入<input id="newer-interaction" aria-label="继续输入" /></label>
    {ready && <div id="settings-full-backup">延迟载入的设置</div>}
  </section>
}

const surface = new URLSearchParams(location.search).get('surface') || 'options'
createRoot(document.getElementById('options-root')!).render(
  surface === 'options' ? <OptionsApp /> : <ThemeProvider>{surface === 'sliders' ? <SliderWeightFixture /> : <Controls />}</ThemeProvider>
)
