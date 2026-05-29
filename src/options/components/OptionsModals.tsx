import { useEffect, useState, type ReactNode } from 'react'
import { Button, CloseButton, DialogOverlay, DialogPanel, Input, Textarea } from '../../ui'

const modalKeyByBackdropId: Record<string, string> = {
  'delete-modal-backdrop': 'delete',
  'confirm-modal-backdrop': 'confirm',
  'move-modal-backdrop': 'move',
  'scope-modal-backdrop': 'scope',
  'ai-model-modal-backdrop': 'ai-model',
  'ai-model-picker-modal-backdrop': 'ai-model-picker'
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

      <ModalBackdrop id="ai-model-modal-backdrop" labelledBy="ai-model-modal-title" describedBy="ai-model-modal-copy" className="options-modal ai-model-modal">
        <>
          <CloseButton
            id="close-ai-model-modal"
            className="options-modal-close"
            type="button"
            label="关闭自定义模型弹窗"
            variant="ghost"
          />
          <p className="options-section-label">Custom Models</p>
          <h2 id="ai-model-modal-title">自定义模型列表</h2>
          <p id="ai-model-modal-copy" className="options-modal-copy">
            输入自定义模型名称，多个模型可用换行、英文逗号或分号分隔。保存后会出现在模型下拉列表里。
          </p>
          <label className="ai-settings-field" htmlFor="ai-custom-models-input">
            <span>模型列表</span>
            <Textarea
              id="ai-custom-models-input"
              className="ai-model-list-textarea"
              spellCheck={false}
              placeholder={'gpt-5.5\nmy-provider/model-alpha'}
            />
          </label>
          <p className="ai-model-modal-hint">这里只保存模型 ID，不解析别名、加减号或批量隐藏语法。</p>
          <div className="options-modal-actions ai-model-modal-actions">
            <Button
              id="cancel-ai-model-modal"
              className="options-button secondary"
              type="button"
              variant="secondary"
              aria-label="取消编辑自定义模型列表"
            >
              取消
            </Button>
            <Button id="save-ai-model-modal" className="options-button" type="button" aria-label="保存自定义模型列表">
              保存
            </Button>
          </div>
        </>
      </ModalBackdrop>

      <ModalBackdrop id="ai-model-picker-modal-backdrop" labelledBy="ai-model-picker-modal-title" describedBy="ai-model-picker-modal-copy" className="options-modal options-modal-wide">
        <>
          <CloseButton
            id="close-ai-model-picker-modal"
            className="options-modal-close"
            type="button"
            label="关闭 AI 模型弹窗"
            variant="ghost"
          />
          <p className="options-section-label">AI Models</p>
          <h2 id="ai-model-picker-modal-title">选择 AI 模型</h2>
          <p id="ai-model-picker-modal-copy" className="options-modal-copy">
            输入关键字筛选，点击卡片即可选中。可点击「获取模型」从 API 拉取最新列表。
          </p>
          <label className="options-search">
            <span className="options-search-label">搜索模型</span>
            <Input
              id="ai-model-picker-search-input"
              className="options-search-input"
              type="search"
              placeholder="搜索模型 ID"
              aria-label="搜索 AI 模型"
              aria-controls="ai-model-picker-results"
            />
          </label>
          <div id="ai-model-picker-results" className="detect-results modal-results" role="listbox" aria-label="AI 模型候选列表">
            <div className="detect-empty">尚未获取模型列表，可点击下方「获取模型」从 API 拉取。</div>
          </div>
          <div className="options-modal-actions ai-model-picker-actions">
            <div className="ai-model-picker-footer-start">
              <Button
                id="ai-model-picker-fetch"
                className="options-button secondary"
                type="button"
                variant="secondary"
                aria-label="从 API 获取 AI 模型列表"
              >
                获取模型
              </Button>
              <Button
                id="ai-model-picker-manage"
                className="options-button secondary"
                type="button"
                variant="secondary"
                aria-label="打开自定义模型列表设置"
              >
                设置更多模型
              </Button>
            </div>
            <Button
              id="cancel-ai-model-picker-modal"
              className="options-button secondary"
              type="button"
              variant="secondary"
              aria-label="关闭 AI 模型选择弹窗"
            >
              关闭
            </Button>
          </div>
        </>
      </ModalBackdrop>
    </>
  )
}
