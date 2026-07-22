import { cva } from 'class-variance-authority'
import { usePopupSearchChips } from '../popup-controller-store'

const CHIPS_CLASS = 'flex flex-wrap gap-1.5'
const searchChipVariants = cva(
  'inline-flex min-h-6 items-center rounded-full border border-ds-border bg-ds-surface-1 px-2 text-[11px] font-semibold text-ds-text-secondary',
  {
    variants: {
      excluded: {
        false: null,
        true: 'text-ds-danger-text'
      }
    },
    defaultVariants: {
      excluded: false
    }
  }
)

export function PopupSearchChips() {
  const chips = usePopupSearchChips()

  return (
    <div
      id="search-chips"
      className={CHIPS_CLASS}
      hidden={!chips.length}
      aria-label="当前搜索条件"
    >
      {chips.map((chip) => (
        <span className={getSearchChipClassName(chip.kind)} key={`${chip.kind}:${chip.label}`}>
          {chip.label}
        </span>
      ))}
    </div>
  )
}

function getSearchChipClassName(kind: string) {
  return searchChipVariants({ excluded: kind === 'exclude' })
}
