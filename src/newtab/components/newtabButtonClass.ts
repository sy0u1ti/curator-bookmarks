import { cva, type VariantProps } from 'class-variance-authority'

const NEWTAB_BUTTON_BASE_CLASS = 'newtab-button inline-flex min-h-[34px] items-center justify-center gap-2 whitespace-nowrap rounded-ds-sm border px-[18px] text-center text-sm font-bold leading-none outline-offset-[3px] cursor-pointer transition-[background-color,border-color,color,opacity,transform] duration-ds-standard ease-ds-standard focus-visible:outline-2 focus-visible:outline-ds-focus active:scale-[var(--ds-press-scale)] active:duration-[var(--ds-motion-feedback)] disabled:cursor-default disabled:opacity-60 motion-reduce:transition-colors motion-reduce:duration-[80ms] motion-reduce:active:scale-100'
const NEWTAB_BUTTON_PRIMARY_CLASS = 'border-ds-accent-line bg-ds-accent text-ds-accent-contrast hover:border-ds-accent-line hover:bg-ds-accent-hover hover:text-ds-accent-contrast focus-visible:border-ds-accent-line focus-visible:bg-ds-accent-hover focus-visible:text-ds-accent-contrast'
const NEWTAB_BUTTON_SECONDARY_CLASS = 'secondary border-ds-border bg-ds-surface-2 text-ds-text-primary hover:border-ds-border-hover hover:bg-ds-hover hover:text-ds-text-primary focus-visible:border-ds-border-hover focus-visible:bg-ds-hover focus-visible:text-ds-text-primary'

const newtabButtonVariants = cva(NEWTAB_BUTTON_BASE_CLASS, {
  variants: {
    tone: {
      primary: NEWTAB_BUTTON_PRIMARY_CLASS,
      secondary: NEWTAB_BUTTON_SECONDARY_CLASS
    }
  },
  defaultVariants: {
    tone: 'primary'
  }
})

type NewtabButtonTone = NonNullable<VariantProps<typeof newtabButtonVariants>['tone']>

export function getNewtabButtonClass(
  tone: NewtabButtonTone = 'primary',
  className = ''
): string {
  return newtabButtonVariants({ tone, className })
}
