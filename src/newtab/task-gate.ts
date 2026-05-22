export interface TaskGate {
  run: <T>(task: () => Promise<T>) => Promise<T>
}

export function createTaskGate(limit: number): TaskGate {
  const maxActive = Math.max(1, Math.floor(Number(limit) || 0))
  let active = 0
  const queue: Array<() => void> = []

  function launch<T>(task: () => Promise<T>, resolve: (value: T) => void, reject: (error: unknown) => void): void {
    active += 1
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        active = Math.max(0, active - 1)
        const next = queue.shift()
        if (next) {
          next()
        }
      })
  }

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = () => launch(task, resolve, reject)
        if (active < maxActive) {
          start()
          return
        }
        queue.push(start)
      })
    }
  }
}
