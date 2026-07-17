import { BookmarkMenusHost } from './BookmarkMenusHost'
import { FeaturedBackgroundModalHost } from './FeaturedBackgroundModal'
import { NewtabDeleteToastHost } from './NewtabDeleteToastHost'
import { NewtabDragLayerHost } from './NewtabDragLayerHost'

export function NewtabDeferredHosts() {
  return (
    <>
      <NewtabDragLayerHost />
      <FeaturedBackgroundModalHost />
      <NewtabDeleteToastHost />
      <BookmarkMenusHost />
    </>
  )
}
