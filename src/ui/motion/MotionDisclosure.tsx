import { Collapsible } from '@base-ui/react/collapsible'
import type { ReactNode } from 'react'
import { cx } from '../base/utils'

/** Base UI retains the closing content until its grid transition finishes. */
export function MotionDisclosure({ open, children, className }: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <Collapsible.Root open={open} className="contents">
      <Collapsible.Panel
        className={cx('t-acc-panel', className)}
        inert={!open}
        aria-hidden={!open || undefined}
      >
        <div className="t-acc-panel-inner">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
