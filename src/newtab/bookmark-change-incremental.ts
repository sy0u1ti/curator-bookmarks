export interface BookmarkRemovalIncrementalResult {
  handled: boolean
  shouldRefresh: boolean
}

export interface BookmarkCreationIncrementalResult {
  handled: boolean
  shouldRefresh: boolean
}

export interface BookmarkMoveIncrementalResult {
  handled: boolean
  shouldRefresh: boolean
}

export function getBookmarkCreationIncrementalResult({
  createdBookmark,
  parentRelevant,
  insertedLocally
}: {
  createdBookmark: boolean
  parentRelevant: boolean
  insertedLocally: boolean
}): BookmarkCreationIncrementalResult {
  if (!parentRelevant) {
    return {
      handled: false,
      shouldRefresh: false
    }
  }

  if (!createdBookmark) {
    return {
      handled: false,
      shouldRefresh: true
    }
  }

  if (!insertedLocally) {
    return {
      handled: false,
      shouldRefresh: true
    }
  }

  return {
    handled: true,
    shouldRefresh: false
  }
}

export function getBookmarkMoveIncrementalResult({
  movedBookmark,
  oldParentRelevant,
  newParentRelevant,
  movedLocally
}: {
  movedBookmark: boolean
  oldParentRelevant: boolean
  newParentRelevant: boolean
  movedLocally: boolean
}): BookmarkMoveIncrementalResult {
  if (!oldParentRelevant && !newParentRelevant) {
    return {
      handled: false,
      shouldRefresh: false
    }
  }

  if (!movedBookmark) {
    return {
      handled: false,
      shouldRefresh: true
    }
  }

  if (!movedLocally) {
    return {
      handled: false,
      shouldRefresh: true
    }
  }

  return {
    handled: true,
    shouldRefresh: false
  }
}

export function getBookmarkRemovalIncrementalResult({
  removedBookmark,
  removedLocally
}: {
  removedBookmark: boolean
  removedLocally: boolean
}): BookmarkRemovalIncrementalResult {
  if (!removedBookmark) {
    return {
      handled: false,
      shouldRefresh: true
    }
  }

  if (!removedLocally) {
    return {
      handled: false,
      shouldRefresh: true
    }
  }

  return {
    handled: true,
    shouldRefresh: false
  }
}
