import { Button } from '../../ui/primitives/Button.js'
import { ShortcutList } from './ShortcutList.js'
import { dispatchShortcutAction } from './shortcut-events.js'
import type { ShortcutControlsState } from './shortcut-types.js'

export function ShortcutControls({ state }: { state: ShortcutControlsState }) {
  const detailClassName = ['shortcut-status-detail', state.statusTone, state.detail ? '' : 'hidden']
    .filter(Boolean)
    .join(' ')

  return (
    <div className="options-group ai-provider-card">
      <div className="ai-provider-head">
        <div className="ai-provider-copy">
          <h2 className="ai-settings-subtitle">快捷键</h2>
          <p className="ai-provider-notice">为打开搜索、智能分类和切换自动分析设置快捷键。</p>
          <p className="ai-provider-subtitle">Chrome 只允许在扩展快捷键页修改绑定。</p>
        </div>
        <span id="shortcut-status" className={`options-chip ${state.statusTone}`}>
          {state.statusLabel}
        </span>
      </div>
      <p id="shortcut-status-detail" className={detailClassName}>
        {state.detail}
      </p>
      <div id="shortcut-list" className="shortcut-list">
        <ShortcutList state={state.list} />
      </div>
      <div className="shortcut-actions">
        <Button
          id="open-shortcuts-settings"
          className="options-button small"
          size="sm"
          type="button"
          aria-label="打开 Chrome 扩展快捷键设置"
          onClick={() => dispatchShortcutAction('open-settings')}
        >
          打开快捷键设置
        </Button>
        <Button
          id="copy-shortcuts-url"
          className="options-button secondary small"
          size="sm"
          type="button"
          variant="secondary"
          aria-label="复制 Chrome 扩展快捷键设置地址"
          onClick={() => dispatchShortcutAction('copy-url')}
        >
          复制设置地址
        </Button>
        <Button
          id="refresh-shortcuts"
          className="options-button secondary small"
          size="sm"
          type="button"
          variant="secondary"
          aria-label="刷新扩展快捷键绑定状态"
          disabled={state.loading}
          focusableWhenDisabled={state.loading}
          onClick={() => dispatchShortcutAction('refresh')}
        >
          刷新状态
        </Button>
      </div>
    </div>
  )
}
