/** Yield a task, not a display frame; foreground search must not be FPS-bound. */
export function yieldSearchTask(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  return scheduler?.yield ? scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0))
}
