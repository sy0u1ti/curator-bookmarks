import { useState } from 'react'
import { Button } from '../../ui/base/Button'
import { DialogBackdrop, DialogOverlay, DialogPanel, DialogTitle } from '../../ui/base/Dialog'
import { Icon } from '../../ui/icons/Icon'
import { closeTransientPopup, isSidePanelSurface, openBookmarkSidePanel, openExtensionManagement, openPageArchiveWorkspace } from '../../shared/extension-surfaces'
import { setPopupKeyboardHelpOpen, usePopupKeyboardHelpOpen } from '../popup-workspace-state'

const shortcutGroups = [
  {
    title: '主搜索',
    rows: [
      ['↓', '进入书签结果'],
      ['←（空输入）', '进入文件夹筛选'],
      ['Ctrl / ⌘ K', '聚焦主搜索']
    ]
  },
  {
    title: '文件夹筛选',
    rows: [
      ['↑（空输入）', '回到主搜索'],
      ['↓（空输入）', '进入文件夹树'],
      ['↑ / ↓（有输入）', '移动匹配高亮，保留输入焦点'],
      ['Enter', '应用高亮文件夹'],
      ['Ctrl / ⌘ F', '聚焦文件夹筛选']
    ]
  },
  {
    title: '文件夹树与书签',
    rows: [
      ['↑ / ↓', '在当前列表中移动'],
      ['← / →', '返回文件夹 / 进入书签列表'],
      ['Enter', '打开选中的书签'],
      ['Ctrl / ⌘ Enter', '后台打开'],
      ['Alt Enter', '在当前标签页打开'],
      ['F2', '编辑选中的书签']
    ]
  },
  {
    title: '随时可用',
    rows: [
      ['Esc', '逐层返回；输入框内先清空'],
      ['? / Ctrl / ⌘ /', '显示键盘帮助（? 用于输入框外）']
    ]
  }
]

export function PopupWorkspaceTools() {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<{ message: string; manageExtension?: boolean } | null>(null)
  const open = usePopupKeyboardHelpOpen()
  async function openPanel() {
    if (opening) return
    setError(null)
    setOpening(true)
    try {
      await openBookmarkSidePanel()
      closeTransientPopup()
    } catch (reason) {
      setError({ message: reason instanceof Error ? reason.message : '侧栏打开失败，请重新加载扩展后重试。', manageExtension: true })
    } finally {
      setOpening(false)
    }
  }
  async function manageExtension() {
    try { await openExtensionManagement() }
    catch { setError({ message: '无法打开扩展管理。请在地址栏输入 chrome://extensions，找到 Curator 并点击“重新加载”。' }) }
  }

  return <>
    <div className="relative flex items-center gap-1">
      <Button id="popup-keyboard-help" size="sm" variant="ghost" aria-label="查看键盘帮助" title="键盘帮助" onClick={() => setPopupKeyboardHelpOpen(true)}><Icon name="Keyboard" size={16} /></Button>
      <Button id="open-page-archive" size="sm" variant="ghost" aria-label="存档当前页面" title="存档当前页面" onClick={() => { setError(null); void openPageArchiveWorkspace().catch(reason => setError({ message: reason.message })) }}><Icon name="Save" size={16} /></Button>
      {!isSidePanelSurface() && <Button id="open-side-panel" size="sm" variant="ghost" aria-label="打开常驻书签侧栏" title="打开常驻书签侧栏" disabled={opening} onClick={() => void openPanel()}><Icon name="PanelRight" size={16} /></Button>}
      {error && <div className="absolute right-0 top-full z-[120] mt-2 w-[280px] max-w-[calc(100vw-28px)] rounded-ds-sm border border-ds-border bg-ds-surface-2 p-3 text-xs text-ds-text-primary" role="alert">
        <p className="m-0 leading-relaxed">{error.message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {error.manageExtension && <Button size="sm" variant="secondary" onClick={() => void manageExtension()}>打开扩展管理</Button>}
          <Button size="sm" variant="ghost" onClick={() => setError(null)}>关闭</Button>
        </div>
      </div>}
    </div>
    <DialogOverlay open={open} onOpenChange={setPopupKeyboardHelpOpen} keepMounted={false} className="fixed inset-0 z-[200] grid place-items-center p-3">
      <DialogBackdrop className="absolute inset-0 bg-black/70" />
      <DialogPanel id="popup-keyboard-help-dialog" className="relative max-h-[calc(100dvh-24px)] w-full max-w-lg overflow-y-auto rounded-ds-md border border-ds-border bg-ds-surface-2 p-5 text-ds-text-primary" initialFocus={() => document.getElementById('popup-keyboard-help-title')}>
        <DialogTitle id="popup-keyboard-help-title" tabIndex={-1} className="text-lg font-semibold outline-none">键盘操作</DialogTitle>
        <div className="my-4 grid gap-4">
          {shortcutGroups.map((group) => (
            <section className="grid gap-2" key={group.title} aria-label={group.title}>
              <h3 className="m-0 text-sm font-semibold text-ds-text-secondary">{group.title}</h3>
              <dl className="m-0 grid gap-2 text-sm">
                {group.rows.map(([key, label]) => <div key={key} className="grid grid-cols-[minmax(110px,0.7fr)_minmax(0,1fr)] gap-3 border-b border-ds-border-subtle py-2"><dt><kbd className="font-mono text-xs">{key}</kbd></dt><dd className="text-ds-text-secondary">{label}</dd></div>)}
              </dl>
            </section>
          ))}
        </div>
        <p className="mb-4 text-xs text-ds-text-secondary">浏览器全局快捷键可在设置页的“快捷键”中查看和调整。</p>
        <Button variant="secondary" onClick={() => setPopupKeyboardHelpOpen(false)}>关闭帮助</Button>
      </DialogPanel>
    </DialogOverlay>
  </>
}
