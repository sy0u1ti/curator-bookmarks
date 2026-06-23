import { usePopupSearchChips } from '../popup-controller-store'

const CHIPS_CLASS = 'flex flex-wrap gap-1.5'
const CHIP_BASE_CLASS = [
  'inline-flex min-h-6 items-center rounded-full border px-2 text-[11px] font-semibold',
  'border-[rgba(245,245,247,0.18)] bg-[rgba(255,255,255,0.045)] [color:var(--ds-text-secondary)]'
].join(' ')

const CHIP_KIND_CLASSES: Record<string, string> = {
  exclude: 'border-[rgba(248,113,113,0.34)] bg-[rgba(248,113,113,0.1)] text-ds-danger-text',
  folder: 'border-[rgba(167,139,250,0.34)] bg-[rgba(167,139,250,0.1)] text-ds-accent-text',
  site: 'border-[rgba(125,211,252,0.34)] bg-[rgba(125,211,252,0.1)] text-ds-accent-text',
  time: 'border-[rgba(251,191,36,0.34)] bg-[rgba(251,191,36,0.11)] text-ds-warning',
  type: 'border-[rgba(134,239,172,0.34)] bg-[rgba(134,239,172,0.1)] text-ds-success-text'
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
