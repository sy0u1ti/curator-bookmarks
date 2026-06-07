import { usePopupSearchChips } from '../popup-events'

export function PopupSearchChips() {
  const chips = usePopupSearchChips()

  return (
    <div
      id="search-chips"
      className={['search-chips', chips.length ? '' : 'hidden'].filter(Boolean).join(' ')}
      aria-label="当前搜索条件"
    >
      {chips.map((chip) => (
        <span className={['search-filter-chip', chip.kind].filter(Boolean).join(' ')} key={`${chip.kind}:${chip.label}`}>
          {chip.label}
        </span>
      ))}
    </div>
  )
}
