import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/base/Button'
import { Popover } from '../../ui/base/Popover'

const searchHelpPopoverClass =
  '[z-index:90] w-[min(276px,calc(100cqi-24px))] max-w-[276px] gap-2.5 rounded-ds-md border border-ds-border bg-ds-surface-2 p-3.5 text-xs leading-snug text-ds-text-secondary shadow-ds-popover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ds-focus focus-visible:outline-offset-2'
const searchHelpTitleClass = 'text-[13px] font-semibold tracking-[-0.01em] text-ds-text-primary'
const searchHelpListClass = 'm-0 grid list-none gap-2 p-0'
const searchHelpItemClass = 'grid grid-cols-[46px_minmax(0,1fr)] items-center gap-2.5'
const searchHelpTagClass =
  'text-right text-xs font-medium text-ds-text-muted'
const searchHelpExampleClass =
  'flex min-w-0 flex-wrap items-center gap-1.5 text-ds-text-primary'
const searchHelpCodeClass =
  'rounded-ds-xs border border-ds-border-subtle bg-ds-bg-page px-1.5 py-0.5 font-mono text-xs text-ds-text-primary'
const searchHelpHintClass = 'border-t border-ds-border-subtle pt-2 text-xs leading-normal text-ds-text-muted'
const searchHelpToggleClass = 'w-8 min-w-8 !p-0'

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
      title={<span className={searchHelpTitleClass}>高级搜索语法</span>}
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
          size="sm"
          variant="ghost"
          type="button"
          aria-label="查看高级搜索语法"
          title="查看高级搜索语法"
          aria-controls="search-help-popover"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              onOpenChange(true)
            }
          }}
        >
          <Icon name="CircleHelp" size={16} aria-hidden="true" />
        </Button>
      }
    >
      <ul className={searchHelpListClass}>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>原文</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>"not found"</code></span>
        </li>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>站点</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>site:github.com</code></span>
        </li>
        <li className={searchHelpItemClass}>
          <span className={searchHelpTagClass}>网址</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>url:/issues</code></span>
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
          <span className={searchHelpTagClass}>时间</span>
          <span className={searchHelpExampleClass}><code className={searchHelpCodeClass}>最近2周</code></span>
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
      <span className={searchHelpHintClass}>条件可组合；引号内按原文查找。</span>
    </Popover>
  )
}
