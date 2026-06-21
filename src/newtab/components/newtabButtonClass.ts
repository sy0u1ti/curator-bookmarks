import { cx } from '../../ui/base/utils'

type NewtabButtonTone = 'primary' | 'secondary'

const NEWTAB_BUTTON_BASE_CLASS = 'newtab-button !inline-flex !min-h-[34px] items-center justify-center gap-2 whitespace-nowrap rounded-[var(--ui-radius-control)] !border px-[18px] text-center !text-sm !font-[750] !leading-none outline-offset-[3px] cursor-pointer [transition:background-color_var(--ui-motion-standard)_var(--ui-ease-standard),border-color_var(--ui-motion-standard)_var(--ui-ease-standard),transform_160ms_ease,opacity_var(--ui-motion-standard)_var(--ui-ease-standard)] focus-visible:outline-2 focus-visible:outline-[rgba(245,245,247,0.34)] active:scale-[var(--ui-press-scale)] disabled:cursor-default disabled:opacity-[0.58]'
const NEWTAB_BUTTON_PRIMARY_CLASS = '!border-[var(--ui-accent-line)] bg-[var(--ui-accent-strong)] text-[var(--ui-text-inverse)] hover:!border-[var(--ui-accent-line)] hover:bg-[color-mix(in_srgb,var(--ui-accent-strong)_90%,var(--ui-text-primary))] hover:text-[var(--ui-text-inverse)] focus-visible:!border-[var(--ui-accent-line)] focus-visible:bg-[color-mix(in_srgb,var(--ui-accent-strong)_90%,var(--ui-text-primary))] focus-visible:text-[var(--ui-text-inverse)]'
const NEWTAB_BUTTON_SECONDARY_CLASS = 'secondary !border-[var(--ui-divider)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-primary)] hover:!border-[var(--ui-divider-strong)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text-primary)] focus-visible:!border-[var(--ui-divider-strong)] focus-visible:bg-[var(--ui-surface-hover)] focus-visible:text-[var(--ui-text-primary)]'

export function getNewtabButtonClass(
  tone: NewtabButtonTone = 'primary',
  className = ''
): string {
  return cx(
    NEWTAB_BUTTON_BASE_CLASS,
    tone === 'secondary' ? NEWTAB_BUTTON_SECONDARY_CLASS : NEWTAB_BUTTON_PRIMARY_CLASS,
    className
  )
}
