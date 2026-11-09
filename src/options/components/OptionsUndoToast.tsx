import { Toast as BaseToast } from '@base-ui/react/toast'
import { createPortal } from 'react-dom'
import { UNDO_WINDOW_MS } from '../../shared/constants.js'
import { Button } from '../../ui/base/Button'
import { ToastList } from '../../ui/base/Toast'
import { dispatchOptionsUndo, useOptionsUndoToastView } from './options-undo-toast-store.js'

export function OptionsUndoToast() {
  const view = useOptionsUndoToastView()

  return createPortal(
    <ToastList
      className="pointer-events-none fixed bottom-4 right-4 z-50 grid w-[min(400px,calc(100vw-32px))] gap-2"
      rootClassName="pointer-events-auto"
      contentClassName="min-w-0 flex-1"
      titleClassName="m-0 text-[13px] font-semibold"
      descriptionClassName="m-0 text-xs leading-relaxed text-ds-text-secondary [overflow-wrap:anywhere] empty:hidden"
      timeout={UNDO_WINDOW_MS}
      items={view ? [{
        actions: (
          <div className="flex shrink-0 items-center gap-2">
            {view.undoable ? (
              <Button size="sm" type="button" variant="secondary" disabled={view.busy} onClick={() => void dispatchOptionsUndo()}>
                {view.busy ? '恢复中…' : '撤销'}
              </Button>
            ) : null}
            <BaseToast.Close render={<Button size="sm" type="button" variant="ghost" />} aria-label="关闭通知">
              关闭
            </BaseToast.Close>
          </div>
        ),
        description: view.detail,
        id: view.id,
        title: view.title,
        type: 'success'
      }] : []}
    />,
    document.body
  )
}
