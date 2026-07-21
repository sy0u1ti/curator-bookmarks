import type { ShortcutListState } from './shortcut-types.js'

const SHORTCUT_ROW_CLASS =
  'grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 border-t border-ds-border-subtle py-2.5 first:border-t-0 max-[760px]:grid-cols-1 max-[760px]:items-stretch'
const SHORTCUT_COPY_CLASS = 'min-w-0'
const SHORTCUT_TITLE_CLASS =
  'block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-ds-text-primary'
const SHORTCUT_DETAIL_CLASS =
  'mt-1 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ds-text-disabled'
const SHORTCUT_KEY_CLASS =
  'inline-flex min-h-7 min-w-[72px] items-center justify-center whitespace-nowrap rounded-ds-sm border border-ds-border bg-ds-surface-2 px-2.5 text-xs font-bold text-ds-text-primary max-[760px]:w-fit max-[760px]:max-w-full'
const SHORTCUT_KEY_UNASSIGNED_CLASS = 'text-ds-text-disabled'
const SHORTCUT_EMPTY_CLASS =
  'rounded-ds-sm border border-ds-border-subtle bg-ds-surface-1 p-[18px_16px] text-[13px] leading-[1.7] text-ds-text-secondary'
const SHORTCUT_LOADING_COPY_CLASS = 'grid min-h-10 content-center gap-2'
const SHORTCUT_LOADING_TITLE_CLASS =
  'block h-2.5 w-[min(62%,260px)] rounded-full bg-ds-text-primary/[0.075]'
const SHORTCUT_LOADING_DETAIL_CLASS =
  'block h-2 w-[min(82%,420px)] rounded-full bg-ds-text-primary/[0.045]'
const SHORTCUT_LOADING_KEY_CLASS =
  'inline-flex min-h-7 min-w-[88px] rounded-ds-sm border border-ds-border-subtle bg-ds-surface-2'
const SHORTCUT_LOADING_ROWS = Array.from({ length: 4 }, (_, index) => index)

export function ShortcutList({ state }: { state: ShortcutListState }) {
  if (state.kind === 'loading') {
    return (
      <>
        {SHORTCUT_LOADING_ROWS.map((row) => (
          <div className={SHORTCUT_ROW_CLASS} key={`shortcut-loading:${row}`} aria-hidden="true">
            <span className={SHORTCUT_LOADING_COPY_CLASS}>
              <span className={SHORTCUT_LOADING_TITLE_CLASS} />
              <span className={SHORTCUT_LOADING_DETAIL_CLASS} />
            </span>
            <span className={SHORTCUT_LOADING_KEY_CLASS} />
          </div>
        ))}
      </>
    )
  }

  if (state.kind === 'empty') {
    return <div className={SHORTCUT_EMPTY_CLASS}>暂未读取到扩展快捷键命令。</div>
  }

  return (
    <>
      {state.commands.map((command) => {
        const shortcut = String(command.shortcut || '').trim()
        const shortcutLabel = shortcut || '未配置'
        return (
          <div className={SHORTCUT_ROW_CLASS} key={command.name}>
            <div className={SHORTCUT_COPY_CLASS}>
              <strong className={SHORTCUT_TITLE_CLASS}>{command.title}</strong>
              <span className={SHORTCUT_DETAIL_CLASS}>{command.detail}</span>
            </div>
            <span className={[SHORTCUT_KEY_CLASS, shortcut ? '' : SHORTCUT_KEY_UNASSIGNED_CLASS].filter(Boolean).join(' ')}>
              {shortcutLabel}
            </span>
          </div>
        )
      })}
    </>
  )
}
