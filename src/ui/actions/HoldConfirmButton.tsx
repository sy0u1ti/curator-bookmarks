import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Button, type ButtonProps } from '../base/Button'
import { cx } from '../base/utils'
import { ActionFeedbackLabel } from './ActionFeedback'
import { createHoldConfirmation, HOLD_CONFIRM_DURATION_MS, type HoldPhase } from './hold-confirmation'

type HoldConfirmButtonProps = Omit<ButtonProps,
  'children' | 'onClick' | 'onKeyDown' | 'onKeyUp' | 'onPointerDown' | 'onPointerUp' |
  'onPointerMove' | 'onPointerLeave' | 'onPointerCancel' | 'onLostPointerCapture' | 'onBlur' | 'onContextMenu'> & {
  label: string
  onConfirm: () => void
}

export function HoldConfirmButton({ label, onConfirm, disabled, className, style, ...props }: HoldConfirmButtonProps) {
  const [phase, setPhase] = useState<HoldPhase>('idle')
  const [assistive, setAssistive] = useState(false)
  const descriptionId = useId()
  const callback = useRef(onConfirm)
  const blocked = useRef(disabled)
  callback.current = onConfirm
  blocked.current = disabled
  const pointer = useRef<number | null>(null)
  const key = useRef<string | null>(null)
  const [intent] = useState(() => createHoldConfirmation({
    onChange: setPhase,
    onConfirm: () => { if (!blocked.current) callback.current() }
  }))
  const cancel = () => {
    pointer.current = null
    key.current = null
    setAssistive(false)
    intent.cancel()
  }
  useEffect(() => {
    const abort = () => { pointer.current = null; key.current = null; setAssistive(false); intent.cancel() }
    const onVisibilityChange = () => { if (document.hidden) abort() }
    window.addEventListener('blur', abort)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', abort)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      intent.dispose()
    }
  }, [intent])
  useEffect(() => { if (disabled) cancel() }, [disabled])

  const visibleLabel = phase === 'ready' ? (assistive ? '再次确认' : '松开确认') : phase === 'holding' ? '继续按住' : `按住${label}`
  return (
    <>
      <Button
        {...props}
        className={cx('curator-hold-button', className)}
        style={{ ...style, '--hold-duration': `${HOLD_CONFIRM_DURATION_MS}ms` } as CSSProperties}
        disabled={disabled || phase === 'confirmed'}
        aria-label={visibleLabel}
        aria-describedby={[props['aria-describedby'], descriptionId].filter(Boolean).join(' ')}
        data-hold-phase={phase}
        onPointerDown={(event) => {
          if (disabled || !event.isPrimary || event.button !== 0 || key.current) return
          setAssistive(false)
          pointer.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          intent.start()
        }}
        onPointerUp={(event) => {
          if (pointer.current !== event.pointerId) return
          pointer.current = null
          intent.release()
        }}
        onPointerMove={(event) => {
          if (pointer.current !== event.pointerId) return
          const rect = event.currentTarget.getBoundingClientRect()
          if (event.clientX < rect.left || event.clientX > rect.right ||
              event.clientY < rect.top || event.clientY > rect.bottom) cancel()
        }}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onLostPointerCapture={() => { if (pointer.current !== null) cancel() }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { cancel(); return }
          if (![' ', 'Enter'].includes(event.key)) return
          event.preventDefault()
          event.preventBaseUIHandler()
          if (disabled || event.repeat || key.current || pointer.current !== null) return
          setAssistive(false)
          key.current = event.key
          intent.start()
        }}
        onKeyUp={(event) => {
          if (![' ', 'Enter'].includes(event.key)) return
          event.preventDefault()
          event.preventBaseUIHandler()
          if (key.current !== event.key) return
          key.current = null
          intent.release()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.preventBaseUIHandler()
          if (!disabled && event.detail === 0 && key.current === null && pointer.current === null) {
            setAssistive(true)
            intent.activate()
          }
        }}
        onBlur={cancel}
        onContextMenu={(event) => { event.preventDefault(); cancel() }}
      >
        <span className="curator-hold-fill" aria-hidden="true" />
        <ActionFeedbackLabel status="idle" labels={{
          idle: visibleLabel, pending: `按住${label}`, success: '松开确认', error: '再次确认'
        }} />
      </Button>
      <span id={descriptionId} className="sr-only">
        按住鼠标、空格或回车，出现“松开确认”后松开执行。提前松开或移开可取消；辅助技术可激活两次确认。
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {phase === 'ready' ? visibleLabel : ''}
      </span>
    </>
  )
}
