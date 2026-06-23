export const themeTokens = {
  colorScheme: 'dark',
  color: {
    background: {
      page: 'var(--ds-bg-page)',
      app: 'var(--ds-bg-app)'
    },
    surface: {
      base: 'var(--ds-surface-1)',
      raised: 'var(--ds-surface-2)',
      selected: 'var(--ds-selected)'
    },
    border: {
      subtle: 'var(--ds-border-subtle)',
      default: 'var(--ds-border)',
      hover: 'var(--ds-border-hover)'
    },
    text: {
      primary: 'var(--ds-text-primary)',
      secondary: 'var(--ds-text-secondary)',
      muted: 'var(--ds-text-muted)',
      inverse: 'var(--ds-text-inverse)'
    },
    accent: {
      default: 'var(--ds-accent)',
      hover: 'var(--ds-accent-hover)',
      text: 'var(--ds-accent-text)',
      focus: 'var(--ds-focus)'
    },
    status: {
      danger: 'var(--ds-danger)',
      warning: 'var(--ds-warning)',
      success: 'var(--ds-success)'
    }
  },
  radius: {
    sm: 'var(--ds-radius-sm)',
    md: 'var(--ds-radius-md)',
    lg: 'var(--ds-radius-lg)',
    full: 'var(--ds-radius-full)'
  },
  shadow: {
    card: 'var(--ds-shadow-card)',
    popover: 'var(--ds-shadow-popover)',
    dialog: 'var(--ds-shadow-dialog)',
    focus: 'var(--ds-shadow-focus)'
  },
  motion: {
    fast: 'var(--ds-motion-fast)',
    standard: 'var(--ds-motion-standard)',
    surface: 'var(--ds-motion-surface)',
    ease: 'var(--ds-ease-standard)'
  }
} as const

export type ThemeTokens = typeof themeTokens
