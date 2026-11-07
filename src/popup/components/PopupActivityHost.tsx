import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '../../ui/base/Button'
import { Popover } from '../../ui/base/Popover'
import { Icon } from '../../ui/icons/Icon'
import {
  dispatchPopupActivityAction, usePopupAutoAnalyzeStatusView, usePopupChromeView, usePopupModalsView
} from '../popup-controller-store'
import { popupActivities, usePopupActivity } from '../popup-activity-store'
import type { PopupActivity } from '../popup-activity'
import { PopupSmartClassifier, type PopupSmartClassifierActionHandlers } from './PopupSmartClassifier'
import type { PopupSmartClassifierViewModel } from './PopupViewModels'
import { PopupActivityTransition } from './PopupActivityTransition'
import { usePopupActivityMorph } from './usePopupActivityMorph'

const DOT_LIMIT = 3

function focusSearch() {
  document.getElementById('search-input')?.focus({ preventScroll: true })
  // Removing a focused action does not dispatch blur in every browser.
  popupActivities.pause('focus', false)
}

function activityName(item: PopupActivity): string {
  return item.subject && !item.message.includes(item.subject) ? `${item.message} · ${item.subject}` : item.message
}

function ActivityGlyph({ item, size }: { item: PopupActivity; size: number }) {
  return (
    <Icon
      name={item.type === 'pending' ? 'LoaderCircle' : item.type === 'error' ? 'AlertTriangle' : item.type === 'success' ? 'Check' : 'Clock'}
      className={item.type === 'pending' ? 'animate-spin' : ''}
      size={size}
      aria-hidden="true"
    />
  )
}

export function PopupActivityHost({ state, handlers, suspended }: {
  state: PopupSmartClassifierViewModel
  handlers: PopupSmartClassifierActionHandlers
  suspended: boolean
}) {
  const snapshot = usePopupActivity()
  const chromeView = usePopupChromeView()
  const analysis = usePopupAutoAnalyzeStatusView()
  const modals = usePopupModalsView()
  const root = useRef<HTMLElement>(null)
  const previous = useRef<PopupActivity | undefined>(undefined)
  const actionFocusId = useRef<string | null>(null)
  const active = snapshot.items.find(item => item.id === snapshot.activeId)
  const performAction = (item: PopupActivity) => {
    if (!item.action || item.type === 'pending') return
    actionFocusId.current = item.id
    dispatchPopupActivityAction(item.id, item.action)
  }

  useLayoutEffect(() => {
    popupActivities.pause('workflow', suspended)
    popupActivities.pause('modal', modals.open)
    if (suspended || modals.open) {
      // Making the card inert/unmounting it does not reliably emit blur/leave.
      popupActivities.pause('pointer', false)
      popupActivities.pause('focus', false)
    }
  }, [suspended, modals.open])

  useEffect(() => {
    const visibility = () => popupActivities.pause('hidden', document.hidden)
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      for (const reason of ['workflow', 'modal', 'hidden', 'pointer', 'focus']) popupActivities.pause(reason, false)
    }
  }, [])

  useLayoutEffect(() => {
    if (chromeView.loadError) {
      popupActivities.publish({
        id: 'load-error', source: 'load', type: 'error', message: '读取失败',
        detail: chromeView.loadError, action: 'retry-load', actionLabel: '重试'
      })
    } else if (popupActivities.get('load-error')?.type !== 'pending') {
      popupActivities.remove('load-error')
    }
  }, [chromeView.loadError])

  useLayoutEffect(() => {
    const id = `analysis:${analysis.id || 'current'}`
    for (const item of popupActivities.snapshot().items) {
      if (item.source === 'analysis' && (!analysis.status || item.id !== id)) popupActivities.remove(item.id)
    }
    if (!analysis.status) return
    const completed = analysis.status === 'completed'
    const failed = analysis.status === 'failed'
    popupActivities.publish({
      id, source: 'analysis', type: failed ? 'error' : completed ? 'success' : 'pending',
      message: analysis.title, detail: analysis.detail, subject: analysis.subject,
      action: completed ? 'open-bookmark-history' : failed ? 'open-ai-settings' : '',
      actionLabel: completed ? '查看' : failed ? 'AI 设置' : ''
    }, { present: completed || failed })
  }, [analysis.id, analysis.status, analysis.title, analysis.detail, analysis.subject])

  useLayoutEffect(() => {
    const old = previous.current
    previous.current = active
    // A clicked undo owns focus while pending. Once done, give the user back
    // their search and let the acknowledgement expire normally.
    const finished = old && (!active || (old.id === active.id && old.type === 'pending' && active.type === 'success'))
    const ownsFocus = root.current?.contains(document.activeElement) ||
      (document.activeElement === document.body && actionFocusId.current === old?.id)
    if (finished && !modals.open && !suspended && ownsFocus) {
      actionFocusId.current = null
      focusSearch()
    }
  }, [active, modals.open, suspended])

  const others = snapshot.items.filter(item => item.id !== active?.id)
  const recordMorph = usePopupActivityMorph(root, `${active?.id ?? ''}|${others.map(item => item.id).join(',')}`)

  if (suspended) return null
  const dots = others.length ? (
    <PopupActivityDots
      items={others}
      onSelect={id => {
        recordMorph()
        root.current?.focus({ preventScroll: true })
        popupActivities.select(id)
      }}
    />
  ) : null

  return (
    <section
      id="popup-activity"
      ref={root}
      className="popup-activity-slot popup-surface"
      aria-label="当前网页与操作反馈"
      tabIndex={-1}
      onPointerEnter={event => {
        recordMorph()
        if (event.pointerType !== 'touch') popupActivities.pause('pointer', true)
      }}
      onPointerLeave={() => popupActivities.pause('pointer', false)}
      onFocusCapture={() => { recordMorph(); popupActivities.pause('focus', true) }}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) popupActivities.pause('focus', false)
      }}
    >
      <PopupActivityTransition identity={active ? 'activity' : 'page'} onSettle={recordMorph}>
        {active ? (
          <article className="popup-activity-card" data-activity-id={active.id} data-tone={active.type}>
            <span className="popup-activity-icon" aria-hidden="true">
              <ActivityGlyph item={active} size={16} />
            </span>
            <div className="popup-activity-copy">
              <p className="popup-activity-title" title={active.message}>{active.message}</p>
              <div className="popup-activity-meta">
                {active.source === 'analysis' && active.subject ? (
                  <span className="truncate" title={active.detail}>{active.subject}</span>
                ) : active.detail ? <span className="truncate" title={active.detail}>{active.detail}</span> : null}
                {active.detail ? <PopupActivityDetail item={active} /> : null}
              </div>
            </div>
            <div className="popup-activity-actions">
              {dots}
              {active.action ? (
                <Button
                  id="popup-activity-action"
                  className="popup-activity-action"
                  aria-disabled={active.type === 'pending'}
                  type="button"
                  onClick={() => {
                    if (active.type === 'pending') return
                    performAction(active)
                  }}
                  unstyled
                >
                  {active.type === 'pending' ? '处理中' : active.actionLabel || '查看'}
                </Button>
              ) : null}
              <Button
                className="popup-activity-dismiss"
                type="button"
                aria-label="收起提示，显示当前网页"
                title="显示当前网页"
                onClick={() => { actionFocusId.current = null; focusSearch(); popupActivities.park() }}
                unstyled
              >
                <Icon name="X" size={14} aria-hidden="true" />
              </Button>
            </div>
          </article>
        ) : (
          <PopupSmartClassifier state={state} handlers={handlers} pageStatusAccessory={dots} />
        )}
      </PopupActivityTransition>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {modals.open ? '' : active ? `${active.message}${active.detail ? `。${active.detail}` : ''}` : ''}
      </span>
    </section>
  )
}

function PopupActivityDots({ items, onSelect }: {
  items: PopupActivity[]
  onSelect: (id: string) => void
}) {
  const newest = [...items].reverse()
  const shown = newest.slice(0, newest.length > DOT_LIMIT ? DOT_LIMIT - 1 : DOT_LIMIT)
  const next = newest[shown.length]
  return (
    <div className="popup-activity-dots">
      {shown.map(item => (
        <Button
          key={item.id}
          className="popup-activity-dot"
          type="button"
          data-activity-entry={item.id}
          data-tone={item.type}
          aria-label={activityName(item)}
          title={activityName(item)}
          onClick={() => onSelect(item.id)}
          unstyled
        >
          <ActivityGlyph item={item} size={12} />
        </Button>
      ))}
      {next ? (
        <Button
          key="more"
          className="popup-activity-dot popup-activity-dot-more"
          type="button"
          data-activity-entry={next.id}
          aria-label={`还有 ${newest.length - shown.length} 项：${activityName(next)}`}
          title={activityName(next)}
          onClick={() => onSelect(next.id)}
          unstyled
        >
          +{newest.length - shown.length}
        </Button>
      ) : null}
    </div>
  )
}

function PopupActivityDetail({ item }: { item: PopupActivity }) {
  const [open, setOpen] = useState(false)
  const changeOpen = (next: boolean) => {
    popupActivities.pause('detail', next)
    setOpen(next)
  }
  useEffect(() => () => popupActivities.pause('detail', false), [])

  return (
    <Popover
      open={open}
      onOpenChange={changeOpen}
      align="start"
      side="bottom"
      showArrow={false}
      keepMounted={false}
      title={item.message}
      popupClassName="popup-activity-detail"
      trigger={<Button className="popup-activity-detail-trigger" type="button" aria-label="查看完整说明" unstyled>详情</Button>}
    >
      <p className="popup-activity-detail-text">{item.detail}</p>
    </Popover>
  )
}
