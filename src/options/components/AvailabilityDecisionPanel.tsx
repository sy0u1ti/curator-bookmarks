import type { ReactNode } from 'react'
import { StatusBusyLoadingLabel } from './LoadingLabel.js'
import {
  SHEEN_PROGRESS_BAR_CLASS,
  SHEEN_PROGRESS_TRACK_CLASS,
  getSheenProgressBarStyle,
  getSheenProgressTrackStyle,
  normalizeSheenProgressPercent
} from '../../ui/base/sheen-progress'
import { useAvailabilityProgress } from './availability-overview-store.js'
import { OPTION_SURFACE_CLASS, OPTION_VALUE_CLASS } from './option-layout-classes.js'
import { StatusMessage } from '../../ui/base/StatusMessage'

const AVAILABILITY_DECISION_PANEL_CLASS =
  `mt-5 ${OPTION_SURFACE_CLASS} p-[20px_22px] max-[760px]:p-4`
const AVAILABILITY_DECISION_HEADER_CLASS =
  'flex min-w-0 items-start justify-between gap-3.5 max-[760px]:flex-col'
const AVAILABILITY_DECISION_HEADER_COPY_CLASS = 'min-w-0'
const AVAILABILITY_DECISION_TITLE_CLASS =
  'block [overflow-wrap:anywhere] text-[15px] font-[650] leading-normal tracking-[0] text-ds-text-primary'
const AVAILABILITY_DECISION_SUBTITLE_CLASS =
  'mt-[5px] mb-0 text-[13px] leading-[1.5] text-ds-text-secondary'
const AVAILABILITY_LABEL_CLASS =
  'block text-xs font-medium leading-4 text-ds-text-secondary'
const AVAILABILITY_PROGRESS_TRACK_CLASS = `mt-[14px] ${SHEEN_PROGRESS_TRACK_CLASS}`
const AVAILABILITY_PROGRESS_BAR_CLASS = SHEEN_PROGRESS_BAR_CLASS
const AVAILABILITY_PROGRESS_ROW_CLASS =
  'mt-3 grid grid-cols-[minmax(128px,0.32fr)_minmax(0,1fr)] items-center gap-[14px] border-t border-t-[rgba(255,255,255,0.07)] pt-[11px] max-[760px]:grid-cols-1 max-[760px]:gap-2'
const AVAILABILITY_PROGRESS_META_TITLE_CLASS =
  'mt-[5px] block text-[15px] font-[650] leading-[1.3] text-ds-text-primary'
const AVAILABILITY_PROGRESS_COPY_CLASS =
  'mt-[7px] mb-0 text-[13px] leading-[1.5] text-ds-text-secondary'

export function AvailabilityDecisionPanel({ children }: { children: ReactNode }) {
  const state = useAvailabilityProgress()
  if (!state.visible) return null

  return (
    <div
      className={AVAILABILITY_DECISION_PANEL_CLASS}
      aria-busy={state.busy}
      aria-label="可用性检测决策概览"
    >
      <div className={AVAILABILITY_DECISION_HEADER_CLASS}>
        <div className={AVAILABILITY_DECISION_HEADER_COPY_CLASS}>
          <strong className={AVAILABILITY_DECISION_TITLE_CLASS}>检测概览</strong>
          <p className={AVAILABILITY_DECISION_SUBTITLE_CLASS}>确认失效后再移动、删除或忽略。</p>
        </div>
        <span className={OPTION_VALUE_CLASS}>{state.durationLabel}</span>
      </div>
      <div className={AVAILABILITY_PROGRESS_ROW_CLASS}>
        <div>
          <span className={AVAILABILITY_LABEL_CLASS}>检测进度</span>
          <strong className={AVAILABILITY_PROGRESS_META_TITLE_CLASS}>
            {state.busy ? (
              <StatusBusyLoadingLabel label={state.progressLabel} />
            ) : (
              state.progressLabel
            )}
          </strong>
        </div>
        <div>
          <div
            className={AVAILABILITY_PROGRESS_TRACK_CLASS}
            style={getSheenProgressTrackStyle(state.progressValue, state.busy)}
            aria-label="可用性检测进度"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={normalizeSheenProgressPercent(state.progressValue)}
            role="progressbar"
          >
            <span
              aria-hidden="true"
              className={AVAILABILITY_PROGRESS_BAR_CLASS}
              style={getSheenProgressBarStyle(state.progressValue)}
            />
          </div>
          <StatusMessage
            className={AVAILABILITY_PROGRESS_COPY_CLASS}
            aria-atomic="true"
            aria-live="polite"
            role="status"
          >
            {state.statusCopy}
          </StatusMessage>
        </div>
      </div>
      {children}
    </div>
  )
}
