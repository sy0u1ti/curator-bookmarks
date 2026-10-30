import { useEffect, useRef } from 'react'
import { Button } from '../base/Button'
import { Input, type InputProps } from '../base/Input'
import { cx } from '../base/utils'
import { Icon } from '../icons/Icon'
import './actions.css'

type RevealInputProps = Omit<InputProps, 'type' | 'ref'> & {
  revealed: boolean
  onRevealChange: (revealed: boolean) => void
}

export function RevealInput({ revealed, onRevealChange, className, disabled, id, ...props }: RevealInputProps) {
  const callback = useRef(onRevealChange)
  callback.current = onRevealChange
  useEffect(() => {
    const hide = () => callback.current(false)
    const onVisibilityChange = () => { if (document.hidden) hide() }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      hide()
    }
  }, [])

  return (
    <span
      className="curator-reveal-input"
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          if (revealed) onRevealChange(false)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && revealed) {
          event.preventDefault()
          event.stopPropagation()
          onRevealChange(false)
        }
      }}
    >
      <Input {...props} id={id} className={cx(className, 'curator-reveal-input-field')} disabled={disabled} type={revealed ? 'text' : 'password'} />
      <Button
        id={id ? `${id}-reveal` : undefined}
        className="curator-reveal-input-toggle"
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-label="显示 API Key"
        aria-pressed={revealed}
        aria-controls={id}
        title={revealed ? '隐藏 API Key' : '显示 API Key'}
        onClick={() => onRevealChange(!revealed)}
      >
        <span className="t-icon-swap" data-state={revealed ? 'b' : 'a'} aria-hidden="true">
          <span className="t-icon" data-icon="a"><Icon name="Eye" size={16} /></span>
          <span className="t-icon" data-icon="b"><Icon name="EyeOff" size={16} /></span>
        </span>
      </Button>
    </span>
  )
}
