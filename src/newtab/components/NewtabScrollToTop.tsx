import { useMemo, useRef, type RefObject } from 'react'
import {
  DEFAULT_SCROLL_TOP_THRESHOLD,
  useScrollToTop,
  useScrollToTopFocusGuard
} from '../../ui/base/ScrollToTopButton'
import { Icon } from '../../ui/icons/Icon'
import { useNewtabDeleteToastView } from '../newtab-delete-toast-store'
import { NewtabGlassSurface } from './NewtabGlassSurface'

const NEWTAB_SCROLL_TOP_BUTTON_CLASS = [
  'curator-scroll-top-button newtab-scroll-to-top',
  'inline-flex h-10 min-h-[34px] w-10 min-w-10 items-center justify-center',
  'rounded-[var(--ui-radius-control)] border border-[var(--newtab-glass-stroke)] [border-width:var(--newtab-glass-stroke-width)]',
  'bg-[var(--newtab-glass-bg-fill)] p-0 text-center leading-none text-[var(--ui-text-secondary)] shadow-none outline-none',
  '[filter:var(--newtab-glass-drop)] [-webkit-backdrop-filter:var(--newtab-glass-backdrop-filter)] [backdrop-filter:var(--newtab-glass-backdrop-filter)]'
].join(' ')

export function NewtabScrollToTop({
  shellRef,
  suppressed = false
}: {
  shellRef: RefObject<HTMLDivElement | null>
  suppressed?: boolean
}) {
  const deleteToast = useNewtabDeleteToastView()
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const targets = useMemo(() => [shellRef], [shellRef])
  const { visible, scrollToTop } = useScrollToTop({
    targets,
    threshold: DEFAULT_SCROLL_TOP_THRESHOLD,
    suppressed: suppressed || Boolean(deleteToast)
  })

  useScrollToTopFocusGuard(visible, buttonRef, shellRef)

  return (
    <div className="curator-scroll-top-slot fixed right-[18px] bottom-[18px] z-30">
      <NewtabGlassSurface
        as="button"
        ref={buttonRef}
        id="newtab-scroll-to-top"
        className={NEWTAB_SCROLL_TOP_BUTTON_CLASS}
        type="button"
        aria-label="回到顶部"
        aria-controls="newtab-root"
        aria-hidden={!visible || undefined}
        title="回到顶部"
        tabIndex={visible ? 0 : -1}
        inert={!visible || undefined}
        data-visible={visible ? 'true' : 'false'}
        onClick={scrollToTop}
      >
        <Icon name="ArrowUp" size={18} className="curator-scroll-top-icon" aria-hidden="true" />
      </NewtabGlassSurface>
    </div>
  )
}
