import { useEffect, useState } from 'react'
import '../../popup/popup.css'
import { PopupEmbeddedBookmarkManager } from '../../popup/PopupApp'
import { applyPopupBookmarkManagerTarget } from '../../popup/popup-controller'
import { parseBookmarkManagerAnchor } from '../../shared/extension-surfaces'

export function BookmarksManagerPanel({
  sectionAnchor,
  sectionRevision
}: {
  sectionAnchor: string
  sectionRevision: number
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const target = parseBookmarkManagerAnchor(sectionAnchor)
    if (target.bookmarkId || target.folderId || target.query) {
      applyPopupBookmarkManagerTarget(target)
    }
  }, [sectionAnchor, sectionRevision])

  return (
    <section
      id="bookmarks"
      className="options-bookmarks-section"
      aria-labelledby="bookmarks-title"
    >
      <h1 id="bookmarks-title" className="sr-only">全部书签</h1>
      <div
        id="popup-root"
        data-popup-ready="true"
        data-popup-embedded="options"
        ref={setPortalContainer}
      >
        <div className="curator-react-root dark">
          <PopupEmbeddedBookmarkManager portalContainer={portalContainer} />
        </div>
      </div>
    </section>
  )
}
