import { usePopupSearchChips } from '../popup-controller-store'

const CHIPS_CLASS = 'flex flex-wrap gap-1.5'
const CHIP_BASE_CLASS = [
  'inline-flex min-h-6 items-center rounded-full border px-2 text-[11px] font-semibold',
  'border-ds-border bg-ds-surface-1 text-ds-text-secondary'
].join(' ')

const CHIP_KIND_CLASSES: Record<string, string> = {
  exclude: 'text-ds-danger-text'
}

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
  return [CHIP_BASE_CLASS, CHIP_KIND_CLASSES[kind] || ''].filter(Boolean).join(' ')
}
