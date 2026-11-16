import type { ReactNode } from 'react'

export const BACKUP_ROW_CLASS =
  'grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 max-[560px]:grid-cols-1 max-[560px]:gap-2.5'
export const BACKUP_ROW_TITLE_CLASS =
  'block text-sm font-semibold leading-[1.4] text-ds-text-primary [overflow-wrap:anywhere]'
export const BACKUP_ROW_DETAIL_CLASS = 'm-0 mt-0.5 text-[13px] leading-[1.55] text-ds-text-secondary'
export const BACKUP_ROW_ACTIONS_CLASS =
  'flex min-w-0 flex-wrap items-center justify-end gap-2 max-[560px]:justify-start'
/** The card copy fills its header row, so a status slot wraps at the card width instead of its own. */
export const BACKUP_CARD_COPY_CLASS = 'min-w-0 flex-1 max-[760px]:w-full'

/** One data item in a backup card: what it is on the left, its actions on the right. */
export function BackupRow({ id, title, detail, children }: {
  id?: string
  title: ReactNode
  detail?: ReactNode
  children?: ReactNode
}) {
  return (
    <div id={id} className={BACKUP_ROW_CLASS}>
      <div className="min-w-0">
        <strong className={BACKUP_ROW_TITLE_CLASS}>{title}</strong>
        {detail}
      </div>
      {children ? <div className={BACKUP_ROW_ACTIONS_CLASS}>{children}</div> : null}
    </div>
  )
}
