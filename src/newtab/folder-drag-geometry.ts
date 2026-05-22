export interface FolderDragSectionRectInput {
  id: string
  top: number
  height: number
}

export interface FolderDragSectionElementLike {
  dataset: {
    folderSectionId?: string
  }
  getBoundingClientRect: () => {
    top: number
    height: number
  }
}

export interface FolderDragSectionRectSnapshot {
  orderIds: string[]
  rects: Map<string, FolderDragSectionRectInput>
}

export interface FolderDragFlipDelta {
  folderId: string
  deltaY: number
}

export function createFolderDragSectionRectSnapshot(
  sections: Iterable<FolderDragSectionRectInput>
): FolderDragSectionRectSnapshot {
  const orderIds: string[] = []
  const rects = new Map<string, FolderDragSectionRectInput>()

  for (const section of sections) {
    const folderId = String(section.id || '').trim()
    if (!folderId) {
      continue
    }

    const rect: FolderDragSectionRectInput = {
      id: folderId,
      top: Number(section.top) || 0,
      height: Math.max(0, Number(section.height) || 0)
    }
    orderIds.push(folderId)
    rects.set(folderId, rect)
  }

  return {
    orderIds,
    rects
  }
}

export function createFolderDragSectionRectSnapshotFromElements(
  sections: Iterable<FolderDragSectionElementLike>
): FolderDragSectionRectSnapshot {
  const rects: FolderDragSectionRectInput[] = []

  for (const section of sections) {
    const folderId = String(section.dataset.folderSectionId || '').trim()
    if (!folderId) {
      continue
    }

    const rect = section.getBoundingClientRect()
    rects.push({
      id: folderId,
      top: Number(rect.top) || 0,
      height: Math.max(0, Number(rect.height) || 0)
    })
  }

  return createFolderDragSectionRectSnapshot(rects)
}

export function getFolderInsertIndexFromSnapshot(
  clientY: number,
  snapshot: FolderDragSectionRectSnapshot
): number {
  if (!snapshot.orderIds.length) {
    return -1
  }

  let closestFolderId = ''
  let closestIndex = -1
  let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < snapshot.orderIds.length; index += 1) {
    const folderId = snapshot.orderIds[index]
    const rect = snapshot.rects.get(folderId)
    if (!rect) {
      continue
    }

    const centerY = rect.top + rect.height / 2
    const distance = Math.abs(clientY - centerY)
    if (distance < closestDistance) {
      closestDistance = distance
      closestFolderId = folderId
      closestIndex = index
    }
  }

  if (!closestFolderId || closestIndex < 0) {
    return -1
  }

  const rect = snapshot.rects.get(closestFolderId)
  if (!rect) {
    return -1
  }

  return closestIndex + (clientY > rect.top + rect.height / 2 ? 1 : 0)
}

export function projectFolderDragSectionRectSnapshot(
  previousSnapshot: FolderDragSectionRectSnapshot,
  orderIds: string[]
): FolderDragSectionRectSnapshot {
  const rects = new Map<string, FolderDragSectionRectInput>()
  const normalizedOrderIds = orderIds
    .map((folderId) => String(folderId || '').trim())
    .filter(Boolean)
  const gap = getFolderDragSectionGap(previousSnapshot)
  const baseTop = previousSnapshot.rects.get(previousSnapshot.orderIds[0] || '')?.top ?? 0
  let top = baseTop

  for (let index = 0; index < normalizedOrderIds.length; index += 1) {
    const folderId = normalizedOrderIds[index]
    const previousRect = previousSnapshot.rects.get(folderId)
    const height = previousRect?.height ?? 0
    rects.set(folderId, {
      id: folderId,
      top,
      height
    })
    top += height + gap
  }

  return {
    orderIds: normalizedOrderIds,
    rects
  }
}

export function getFolderFlipDeltasFromSnapshots(
  previousSnapshot: FolderDragSectionRectSnapshot,
  currentSnapshot: FolderDragSectionRectSnapshot,
  excludedFolderId = ''
): FolderDragFlipDelta[] {
  const deltas: FolderDragFlipDelta[] = []

  for (const folderId of currentSnapshot.orderIds) {
    if (!folderId || folderId === excludedFolderId) {
      continue
    }

    const previousRect = previousSnapshot.rects.get(folderId)
    const currentRect = currentSnapshot.rects.get(folderId)
    if (!previousRect || !currentRect) {
      continue
    }

    const deltaY = previousRect.top - currentRect.top
    if (Math.abs(deltaY) < 0.5) {
      continue
    }

    deltas.push({
      folderId,
      deltaY
    })
  }

  return deltas
}

function getFolderDragSectionGap(snapshot: FolderDragSectionRectSnapshot): number {
  for (let index = 1; index < snapshot.orderIds.length; index += 1) {
    const previousFolderId = snapshot.orderIds[index - 1]
    const currentFolderId = snapshot.orderIds[index]
    const previousRect = snapshot.rects.get(previousFolderId)
    const currentRect = snapshot.rects.get(currentFolderId)
    if (!previousRect || !currentRect) {
      continue
    }

    const gap = currentRect.top - (previousRect.top + previousRect.height)
    if (Number.isFinite(gap)) {
      return Math.max(0, gap)
    }
  }

  return 0
}
