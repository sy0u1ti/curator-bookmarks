import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { Popover } from '../../ui/base/Popover'

const searchHelpPopoverClass =
  '[z-index:90] w-[min(260px,calc(100vw-28px))] max-w-[260px] gap-2 rounded-ds-lg border-ds-border bg-ds-surface-2 p-3 text-[11px] leading-snug text-ds-text-secondary shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.38)] focus-visible:outline-offset-2'
const searchHelpTitleClass = 'text-xs font-semibold text-ds-text-primary'
const searchHelpListClass = 'm-0 grid list-none gap-1.5 p-0'
const searchHelpItemClass = 'grid grid-cols-[52px_minmax(0,1fr)] items-baseline gap-2'
const searchHelpTagClass =
  'inline-flex min-h-5 items-center justify-center rounded-full border border-ds-border bg-ds-surface-1 px-1.5 text-[10px] font-semibold text-ds-text-secondary'
const searchHelpExampleClass =
  'flex min-w-0 flex-wrap items-center gap-1 text-ds-text-primary'
const searchHelpCodeClass =
  'rounded-[5px] border border-ds-border bg-ds-app px-1 py-0.5 font-mono text-[10px] text-ds-text-primary'
const searchHelpHintClass = 'text-[10px] text-ds-text-muted'
const searchHelpToggleClass = [
  'relative inline-flex h-[18px] min-h-[18px] w-[18px] min-w-[18px] flex-none cursor-help items-center justify-center rounded-ds-sm border border-ds-border-hover bg-ds-surface-2 p-0 text-ds-text-secondary shadow-none',
  'transition-[background-color,border-color,color,transform] duration-[var(--duration-quick)] ease-ds-standard',
  'hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary',
  'focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.38)] focus-visible:outline-offset-2',
  'active:scale-[0.96]'
].join(' ')

export function PopupSearchHelpPopover({
  onOpenChange,
  open
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  return (
    <Popover
      id="search-help-popover"
      className={searchHelpPopoverClass}
      open={open}
      onOpenChange={onOpenChange}
      positionMethod="fixed"
      triggerId="search-help-toggle"
      align="start"
      side="bottom"
      sideOffset={8}
      collisionPadding={10}
      collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
      trigger={
        <Button
          id="search-help-toggle"
          className={searchHelpToggleClass}
          type="button"
          aria-label="查看高级搜索语法"
          title="查看高级搜索语法（site / folder / type / -排除）"
          aria-controls="search-help-popover"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              onOpenChange(true)
            }
          }}
          unstyled
        >
          <Icon name="CircleHelp" size={13} aria-hidden="true" />
        </Button>
      }
    >
      <strong className={searchHelpTitleClass}>高级搜索语法</strong>
      <ul className={searchHelpListClass}>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>站点</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>site:github.com</code></span>
        </li>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>文件夹</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>folder:"前端资料"</code></span>
        </li>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>类型</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>type:文档</code></span>
        </li>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>排除</span>
          <span className={searchHelpExampleClass}>
            <code className={searchHelpCodeClass}>-youtube</code>
            <span>或</span>
            <code className={searchHelpCodeClass}>-"短视频"</code>
          </span>
        </li>
      </ul>
      <span className={searchHelpHintClass}>Esc 关闭 · 点击外部收起</span>
    </Popover>
  )
}
