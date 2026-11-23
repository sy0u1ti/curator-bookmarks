import { BookmarkMenusHost } from './BookmarkMenusHost'
import { NewtabDeleteToastHost } from './NewtabDeleteToastHost'
import { NewtabDragLayerHost } from './NewtabDragLayerHost'

export function NewtabDeferredHosts() {
  return (
    <>
      <NewtabDragLayerHost />
      <NewtabDeleteToastHost />
      <BookmarkMenusHost />
    </>
  )
}
