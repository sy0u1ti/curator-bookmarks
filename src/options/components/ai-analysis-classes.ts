export const AI_ANALYSIS_RESULTS_GROUP_CLASS =
  'mt-5 rounded-[var(--ui-radius-group)] border border-[rgba(255,255,255,0.055)] bg-[rgba(28,28,30,0.86)] p-[18px_20px_20px] max-[760px]:p-4'

export const AI_ANALYSIS_SELECTION_GROUP_CLASS =
  'mt-7 rounded-[var(--ui-radius-group)] border border-[rgba(255,255,255,0.055)] bg-[rgba(28,28,30,0.86)] p-[18px_20px_20px] max-[760px]:mt-5 max-[760px]:p-4'

export const AI_ANALYSIS_PRIMARY_BUTTON_CLASS =
  '!h-[42px] !min-h-[42px] !px-[18px] !text-sm !font-bold active:scale-[0.985]'

export const AI_ANALYSIS_SMALL_BUTTON_CLASS =
  '!h-[34px] !min-h-[34px] !px-3 !text-[13px]'

export const AI_ANALYSIS_CONFIRM_BUTTON_ACTIVE_CLASS =
  '!border-[rgba(156,232,177,0.46)] !bg-[rgba(156,232,177,0.14)] !text-[#e2ffe9] hover:!border-[rgba(156,232,177,0.68)] hover:!bg-[rgba(156,232,177,0.2)] focus-visible:!border-[rgba(156,232,177,0.68)] focus-visible:!bg-[rgba(156,232,177,0.2)]'

export const AI_ANALYSIS_CONFIRM_ICON_CLASS =
  'mr-1 inline-block font-extrabold tracking-[0] text-[#9ce8b1]'

export const AI_ANALYSIS_METRIC_LABEL_CLASS =
  'block text-[11px] font-semibold uppercase tracking-[0] text-[var(--ui-text-disabled)]'

export const AI_ANALYSIS_STATUS_BADGE_CLASS =
  'inline-flex min-h-7 flex-none items-center justify-center whitespace-nowrap rounded-full border px-[11px] text-[11px] font-semibold leading-none tracking-[0]'

export const AI_ANALYSIS_STATUS_TONE_CLASS: Record<string, string> = {
  danger: 'border-[rgba(255,138,130,0.22)] bg-[rgba(255,138,130,0.12)] text-[#ffb7b0]',
  muted: 'border-[var(--ui-surface-hover)] bg-[var(--ui-surface-raised)] text-[var(--ui-text-tertiary)]',
  ready: 'border-[rgba(170,237,189,0.32)] bg-[rgba(170,237,189,0.16)] text-[#e2ffe9]',
  success: 'border-[rgba(170,237,189,0.32)] bg-[rgba(170,237,189,0.16)] text-[#e2ffe9]',
  warning: 'border-[rgba(255,206,141,0.2)] bg-[rgba(255,206,141,0.12)] text-[#ffdca5]'
}

export const AI_ANALYSIS_CHECKBOX_CLASS =
  'inline-grid size-[15px] cursor-pointer place-items-center rounded-[3px] border border-[rgba(245,245,247,0.7)] bg-[rgba(245,245,247,0.05)] text-[#050506] outline-none data-[checked]:border-[#f5f5f7] data-[checked]:bg-[#f5f5f7] data-[disabled]:cursor-default data-[disabled]:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(59,130,246,0.7)]'

export function aiAnalysisToneClass(tone: string | undefined) {
  return AI_ANALYSIS_STATUS_TONE_CLASS[tone || 'muted'] || AI_ANALYSIS_STATUS_TONE_CLASS.muted
}
