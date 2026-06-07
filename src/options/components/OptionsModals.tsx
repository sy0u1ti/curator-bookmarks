import { useEffect, useState, type ReactNode } from 'react'
import { Button, DialogOverlay, DialogPanel, Input } from '../../ui'

const modalKeyByBackdropId: Record<string, string> = {
  'delete-modal-backdrop': 'delete',
  'confirm-modal-backdrop': 'confirm',
  'move-modal-backdrop': 'move',
  'scope-modal-backdrop': 'scope'
}

function ModalBackdrop({
  id,
  labelledBy,
  describedBy,
  className = 'options-modal',
  children
}: {
  id: string
  labelledBy: string
  describedBy?: string
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const modalKey = modalKeyByBackdropId[id]

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; open?: boolean }>).detail
      if (!detail || detail.key !== modalKey) {
        return
      }
      setOpen(Boolean(detail.open))
    }

    window.addEventListener('options:managed-modal-state', handleState)
    return () => {
      window.removeEventListener('options:managed-modal-state', handleState)
    }
  }, [modalKey])

  return (
    <DialogOverlay
      id={id}
      className={open ? 'options-modal-backdrop' : 'options-modal-backdrop hidden'}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) {
          window.dispatchEvent(new CustomEvent('options:managed-modal-close', { detail: { key: modalKey } }))
          return
        }
        setOpen(nextOpen)
      }}
      aria-hidden={open ? 'false' : 'true'}
      disablePointerDismissal
    >
      <DialogPanel
        className={className}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        initialFocus={false}
        finalFocus={false}
        unanimated
      >
        {children}
      </DialogPanel>
    </DialogOverlay>
  )
}

export function OptionsModals() {
  return (
    <>
      <ModalBackdrop id="delete-modal-backdrop" labelledBy="delete-modal-title" describedBy="delete-modal-copy">
        <>
          <p className="options-section-label danger">删除</p>
          <h2 id="delete-modal-title">批量删除高置信异常书签？</h2>
          <p id="delete-modal-copy" className="options-modal-copy">
            这些书签会从 Chrome 书签中移除，并直接从当前高置信异常列表里消失；低置信异常结果会保留。
          </p>
          <div className="options-modal-actions">
            <Button
              id="cancel-delete-modal"
              className="options-button secondary"
              type="button"
              variant="secondary"
              aria-label="取消批量删除高置信异常书签"
            >
              取消
            </Button>
            <Button
              id="confirm-delete-modal"
              className="options-button danger"
              type="button"
              variant="danger"
              aria-label="确认批量删除高置信异常书签"
            >
              确认删除
            </Button>
          </div>
        </>
      </ModalBackdrop>

      <ModalBackdrop id="confirm-modal-backdrop" labelledBy="confirm-modal-title" describedBy="confirm-modal-copy">
        <>
          <p id="confirm-modal-label" className="options-section-label danger">确认</p>
          <h2 id="confirm-modal-title">确认操作？</h2>
          <p id="confirm-modal-copy" className="options-modal-copy">请确认是否继续。</p>
          <div className="options-modal-actions">
            <Button
              id="cancel-confirm-modal"
              className="options-button secondary"
              type="button"
              variant="secondary"
              aria-label="取消当前确认操作"
            >
              取消
            </Button>
            <Button
              id="confirm-modal-confirm"
              className="options-button danger"
              type="button"
              variant="danger"
              aria-label="确认当前操作"
            >
              确认
            </Button>
          </div>
        </>
      </ModalBackdrop>

      <ModalBackdrop id="move-modal-backdrop" labelledBy="move-modal-title" describedBy="move-modal-copy" className="options-modal options-modal-wide">
        <>
          <p className="options-section-label">Move</p>
          <h2 id="move-modal-title">批量移动书签</h2>
          <p id="move-modal-copy" className="options-modal-copy">
            请选择一个目标文件夹，所选书签会被一起移动到该位置。
          </p>
          <label className="options-search">
            <span className="options-search-label">搜索目标文件夹</span>
            <Input
              id="move-search-input"
              className="options-search-input"
              type="search"
              placeholder="搜索文件夹名称或路径"
              aria-label="搜索移动目标文件夹"
              aria-controls="move-folder-results"
            />
          </label>
          <div id="move-folder-results" className="detect-results modal-results" role="listbox" aria-label="移动目标文件夹">
            <div className="detect-empty">正在加载文件夹列表。</div>
          </div>
          <div className="options-modal-actions">
            <Button
              id="cancel-move-modal"
              className="options-button secondary"
              type="button"
              variant="secondary"
              aria-label="取消批量移动书签"
            >
              取消
            </Button>
          </div>
        </>
      </ModalBackdrop>

      <ModalBackdrop id="scope-modal-backdrop" labelledBy="scope-modal-title" describedBy="scope-modal-copy" className="options-modal options-modal-wide">
        <>
          <p className="options-section-label">Folder Filter</p>
          <h2 id="scope-modal-title">选择筛选文件夹</h2>
          <p id="scope-modal-copy" className="options-modal-copy">
            请选择一个文件夹作为当前筛选范围，可直接搜索文件夹名称或路径。
          </p>
          <label className="options-search">
            <span className="options-search-label">搜索文件夹</span>
            <Input
              id="scope-search-input"
              className="options-search-input"
              type="search"
              placeholder="搜索文件夹名称或路径"
              aria-label="搜索筛选文件夹"
              aria-controls="scope-folder-results"
            />
          </label>
          <div id="scope-folder-results" className="detect-results modal-results" role="listbox" aria-label="筛选文件夹">
            <div className="detect-empty">正在加载文件夹列表。</div>
          </div>
          <div className="options-modal-actions">
            <Button
              id="cancel-scope-modal"
              className="options-button secondary"
              type="button"
              variant="secondary"
              aria-label="关闭筛选文件夹弹窗"
            >
              关闭
            </Button>
          </div>
        </>
      </ModalBackdrop>

    </>
  )
}
