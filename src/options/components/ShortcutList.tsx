import type { ShortcutListState } from './shortcut-types.js'

export function ShortcutList({ state }: { state: ShortcutListState }) {
  if (state.kind === 'loading') {
    return <div className="detect-empty">正在读取当前快捷键绑定...</div>
  }

  if (state.kind === 'empty') {
    return <div className="detect-empty">暂未读取到扩展快捷键命令。</div>
  }

  return (
    <>
      {state.commands.map((command) => {
        const shortcut = String(command.shortcut || '').trim()
        const shortcutLabel = shortcut || '未配置'
        return (
          <div className="shortcut-row" key={command.name}>
            <div className="shortcut-copy">
              <strong>{command.title}</strong>
              <span>{command.detail}</span>
            </div>
            <span className={['shortcut-key', shortcut ? '' : 'unassigned'].filter(Boolean).join(' ')}>
              {shortcutLabel}
            </span>
          </div>
        )
      })}
    </>
  )
}
