export type TopKComparator<T> = (left: T, right: T) => number

export interface TopKCollector<T> {
  add: (item: T) => void
  values: () => T[]
  sortedValues: () => T[]
  readonly size: number
}

export function createTopKCollector<T>(
  limit: number,
  compare: TopKComparator<T>
): TopKCollector<T> {
  const maxSize = Math.max(0, Math.floor(Number(limit) || 0))
  const heap: T[] = []

  function isWorse(left: T, right: T): boolean {
    return compare(left, right) > 0
  }

  function swap(leftIndex: number, rightIndex: number): void {
    const value = heap[leftIndex]
    heap[leftIndex] = heap[rightIndex]
    heap[rightIndex] = value
  }

  function bubbleUp(index: number): void {
    let currentIndex = index
    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2)
      if (!isWorse(heap[currentIndex], heap[parentIndex])) {
        return
      }
      swap(currentIndex, parentIndex)
      currentIndex = parentIndex
    }
  }

  function siftDown(index: number): void {
    let currentIndex = index
    while (true) {
      const leftIndex = currentIndex * 2 + 1
      const rightIndex = leftIndex + 1
      let worstIndex = currentIndex

      if (leftIndex < heap.length && isWorse(heap[leftIndex], heap[worstIndex])) {
        worstIndex = leftIndex
      }
      if (rightIndex < heap.length && isWorse(heap[rightIndex], heap[worstIndex])) {
        worstIndex = rightIndex
      }
      if (worstIndex === currentIndex) {
        return
      }

      swap(currentIndex, worstIndex)
      currentIndex = worstIndex
    }
  }

  return {
    add(item: T): void {
      if (!maxSize) {
        return
      }

      if (heap.length < maxSize) {
        heap.push(item)
        bubbleUp(heap.length - 1)
        return
      }

      if (compare(item, heap[0]) >= 0) {
        return
      }

      heap[0] = item
      siftDown(0)
    },
    values(): T[] {
      return heap.slice()
    },
    sortedValues(): T[] {
      return heap.slice().sort(compare)
    },
    get size(): number {
      return heap.length
    }
  }
}
