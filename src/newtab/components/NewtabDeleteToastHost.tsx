import { Button } from '../../ui/base/Button'
import { ToastList } from '../../ui/base/Toast'
import {
  dispatchNewtabDeleteToastOpenRecycle,
  dispatchNewtabDeleteToastUndo,
  useNewtabDeleteToastView
} from '../newtab-delete-toast-store'

export function NewtabDeleteToastHost() {
  const toast = useNewtabDeleteToastView()

  if (!toast) {
    return null
  }

  return (
    <section className="newtab-delete-toast" data-newtab-bookmark-menu-surface="">
      <ToastList
        contentClassName="newtab-delete-toast-copy"
        descriptionClassName="newtab-delete-toast-description"
        items={[{
          actions: (
            <div className="newtab-delete-toast-actions">
              <Button
                type="button"
                disabled={toast.busy}
                aria-label={`撤销删除：${toast.bookmarkLabel}`}
                onClick={dispatchNewtabDeleteToastUndo}
                unstyled
              >
                {toast.busy ? '恢复中' : '撤销'}
              </Button>
              <Button
                type="button"
                aria-label={`打开回收站查看：${toast.bookmarkLabel}`}
                onClick={dispatchNewtabDeleteToastOpenRecycle}
                unstyled
              >
                回收站
              </Button>
            </div>
          ),
          description: toast.detail,
          id: 'newtab-delete-toast',
          title: '已删除书签',
          type: 'success'
        }]}
        rootClassName="newtab-delete-toast-panel"
        titleClassName="newtab-delete-toast-title"
        timeout={0}
        unstyled
      />
    </section>
  )
}
