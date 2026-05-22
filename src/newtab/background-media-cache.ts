export interface BackgroundObjectUrlCacheOptions {
  createObjectUrl?: (blob: Blob) => string
  revokeObjectUrl?: (objectUrl: string) => void
}

export interface BackgroundObjectUrlCache {
  get: (key: string) => string
  resolve: (
    key: string,
    loadBlob: () => Promise<Blob | null | undefined>,
    options?: { fallbackUrl?: string }
  ) => Promise<string>
  clear: () => void
}

export function createBackgroundObjectUrlCache({
  createObjectUrl = (blob) => URL.createObjectURL(blob),
  revokeObjectUrl = (objectUrl) => URL.revokeObjectURL(objectUrl)
}: BackgroundObjectUrlCacheOptions = {}): BackgroundObjectUrlCache {
  const objectUrlByKey = new Map<string, string>()
  const taskByKey = new Map<string, Promise<string>>()
  let generation = 0

  return {
    get(key: string): string {
      return objectUrlByKey.get(normalizeBackgroundObjectUrlKey(key)) || ''
    },

    resolve(
      key: string,
      loadBlob: () => Promise<Blob | null | undefined>,
      { fallbackUrl = '' }: { fallbackUrl?: string } = {}
    ): Promise<string> {
      const cacheKey = normalizeBackgroundObjectUrlKey(key)
      if (!cacheKey) {
        return Promise.resolve('')
      }

      const cachedObjectUrl = objectUrlByKey.get(cacheKey)
      if (cachedObjectUrl) {
        return Promise.resolve(cachedObjectUrl)
      }

      const existingTask = taskByKey.get(cacheKey)
      if (existingTask) {
        return existingTask
      }

      const taskGeneration = generation
      const task = Promise.resolve()
        .then(loadBlob)
        .then((blob) => {
          if (!blob || taskGeneration !== generation) {
            return fallbackUrl
          }

          const objectUrl = createObjectUrl(blob)
          objectUrlByKey.set(cacheKey, objectUrl)
          return objectUrl
        })
        .catch(() => fallbackUrl)
        .finally(() => {
          if (taskByKey.get(cacheKey) === task) {
            taskByKey.delete(cacheKey)
          }
        })

      taskByKey.set(cacheKey, task)
      return task
    },

    clear(): void {
      generation += 1
      for (const objectUrl of objectUrlByKey.values()) {
        revokeObjectUrl(objectUrl)
      }
      objectUrlByKey.clear()
      taskByKey.clear()
    }
  }
}

function normalizeBackgroundObjectUrlKey(value: unknown): string {
  return String(value || '').trim()
}
