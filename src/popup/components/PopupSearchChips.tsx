import { useEffect, useState } from 'react'
import {
  POPUP_SEARCH_CHIPS_CHANGE_EVENT,
  type PopupSearchChipView,
  type PopupSearchChipsChangeDetail
} from '../popup-events'

export function PopupSearchChips() {
  const [chips, setChips] = useState<PopupSearchChipView[]>([])

  useEffect(() => {
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<PopupSearchChipsChangeDetail>).detail
      setChips(detail?.chips ?? [])
    }

    window.addEventListener(POPUP_SEARCH_CHIPS_CHANGE_EVENT, handleChange)
    return () => window.removeEventListener(POPUP_SEARCH_CHIPS_CHANGE_EVENT, handleChange)
  }, [])

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
