import { createUiViewStoreSlice, useUiViewStoreSlice } from '../../shared/ui-view-store.js'
import type { OptionsModalsState } from './options-modals-types.js'

const defaultOptionsModalsState: OptionsModalsState = {
  confirm: {
    requestId: 0,
    holdToConfirm: false,
    cancelLabel: '取消',
    confirmLabel: '确认',
    copy: '请确认是否继续。',
    label: '确认',
    open: false,
    tone: 'danger',
    title: '确认操作？'
  },
  delete: {
    confirmDisabled: false,
    confirmLabel: '确认删除',
    copy: '将从浏览器书签中移除，可在回收站恢复。',
    open: false
  },
  move: {
    copy: '请选择一个目标文件夹，所选书签会被一起移动到该位置。',
    finalFocusId: '',
    open: false,
    query: ''
  },
  scope: {
    copy: '请选择一个文件夹作为当前筛选范围，可直接搜索文件夹名称或路径。',
    finalFocusId: '',
    open: false,
    query: ''
  }
}

const optionsModalsStore = createUiViewStoreSlice(
  'options',
  'modals',
  defaultOptionsModalsState
)

export function publishOptionsModals(patch: Partial<OptionsModalsState>): void {
  optionsModalsStore.setState((state) => ({
    ...state,
    ...patch
  }))
}

export function useOptionsModalsState(): OptionsModalsState {
  return useUiViewStoreSlice(optionsModalsStore)
}
