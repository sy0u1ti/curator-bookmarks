import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../../shared/constants.js'
import {
  DEFAULT_POPUP_PREFERENCES,
  normalizePopupPreferences
} from '../../shared/popup-preferences.js'
import {
  getLocalStorage,
  setLocalStorage,
  withLocalStorageTransaction
} from '../../shared/storage.js'
import { AiProviderCard } from '../../ui/ai/AiProviderCard'
import { SwitchControl } from '../../ui/base/Switch'
import {
  AI_SETTINGS_BODY_CLASS,
  AI_SETTINGS_COPY_CLASS,
  AI_SETTINGS_HEADER_CLASS,
  AI_SETTINGS_LOADING_SWITCH_CLASS,
  AI_SETTINGS_NARROW_CARD_CLASS,
  AI_SETTINGS_READY_BODY_CLASS,
  AI_SETTINGS_ROW_CLASS,
  AI_SETTINGS_ROW_TITLE_CLASS,
  AI_SETTINGS_SECONDARY_CLASS,
  AI_SETTINGS_TITLE_CLASS,
  AI_SETTINGS_SWITCH_CONTROL_CLASS,
  AI_SETTINGS_SWITCH_THUMB_CLASS,
  AI_SETTINGS_SWITCH_WRAP_CLASS
} from './ai-settings-card-classes.js'

interface InputCaretSettingsState {
  animatedCaret: boolean
  error: string
  loading: boolean
  saving: boolean
}

const INITIAL_STATE: InputCaretSettingsState = {
  animatedCaret: DEFAULT_POPUP_PREFERENCES.animatedCaret,
  error: '',
  loading: true,
  saving: false
}

const title = <h2 className={AI_SETTINGS_TITLE_CLASS}>输入框</h2>
const descriptionId = 'animated-input-caret-description'

export function InputCaretSettings() {
  const [state, setState] = useState<InputCaretSettingsState>(INITIAL_STATE)

  useEffect(() => {
    let active = true
    const applyStoredPreferences = (value: unknown) => {
      const preferences = normalizePopupPreferences(value)
      if (!active) return
      setState((previous) => ({
        ...previous,
        animatedCaret: preferences.animatedCaret,
        loading: false
      }))
    }
    const hydrate = async () => {
      try {
        const stored = await getLocalStorage([STORAGE_KEYS.popupPreferences])
        applyStoredPreferences(stored[STORAGE_KEYS.popupPreferences])
      } catch {
        if (!active) return
        setState((previous) => ({
          ...previous,
          error: '光标设置读取失败。',
          loading: false
        }))
      }
    }
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== 'local' || !changes[STORAGE_KEYS.popupPreferences]) return
      applyStoredPreferences(changes[STORAGE_KEYS.popupPreferences].newValue)
    }

    void hydrate()
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => {
      active = false
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const updateAnimatedCaret = async (checked: boolean) => {
    if (state.loading || state.saving || checked === state.animatedCaret) return
    const previous = state.animatedCaret
    setState((current) => ({
      ...current,
      animatedCaret: checked,
      error: '',
      saving: true
    }))

    try {
      await withLocalStorageTransaction(async (transaction) => {
        const stored = await getLocalStorage([STORAGE_KEYS.popupPreferences])
        const preferences = normalizePopupPreferences(stored[STORAGE_KEYS.popupPreferences])
        await setLocalStorage({
          [STORAGE_KEYS.popupPreferences]: {
            ...preferences,
            animatedCaret: checked
          }
        }, { transaction })
      })
      setState((current) => ({ ...current, error: '', saving: false }))
    } catch {
      setState((current) => ({
        ...current,
        animatedCaret: previous,
        error: '光标设置保存失败。',
        saving: false
      }))
    }
  }

  return (
    <AiProviderCard
      className={AI_SETTINGS_NARROW_CARD_CLASS}
      title={title}
      headerClassName={AI_SETTINGS_HEADER_CLASS}
      iconName="MousePointer2"
      bodyClassName={`${AI_SETTINGS_BODY_CLASS} ${state.loading ? '' : AI_SETTINGS_READY_BODY_CLASS}`}
      aria-busy={state.loading ? 'true' : undefined}
    >
      <div className={AI_SETTINGS_ROW_CLASS}>
        <span className={AI_SETTINGS_COPY_CLASS}>
          <strong className={AI_SETTINGS_ROW_TITLE_CLASS}>动态输入光标</strong>
          <span id={descriptionId} className={AI_SETTINGS_SECONDARY_CLASS}>
            所有输入框；关闭后使用系统光标。
          </span>
        </span>
        <span className={AI_SETTINGS_SWITCH_WRAP_CLASS}>
          {state.loading ? (
            <span className={AI_SETTINGS_LOADING_SWITCH_CLASS} aria-hidden="true" />
          ) : (
            <SwitchControl
              aria-describedby={descriptionId}
              aria-label="动态输入光标"
              checked={state.animatedCaret}
              className={AI_SETTINGS_SWITCH_CONTROL_CLASS}
              disabled={state.saving}
              thumbClassName={AI_SETTINGS_SWITCH_THUMB_CLASS}
              onCheckedChange={(checked) => void updateAnimatedCaret(checked)}
              unstyled
            />
          )}
        </span>
      </div>
      {state.error ? (
        <p className="mb-0 px-4 pb-3 text-xs leading-relaxed text-ds-danger-text" role="status">
          {state.error}
        </p>
      ) : null}
    </AiProviderCard>
  )
}
