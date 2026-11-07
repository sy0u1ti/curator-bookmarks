import { UNDO_WINDOW_MS } from '../shared/constants.js'

export interface PopupActivity {
  id: string
  type: 'success' | 'error' | 'info' | 'pending'
  message: string
  detail?: string
  action?: string
  actionLabel?: string
  recycleId?: string
  subject?: string
  source?: 'operation' | 'analysis' | 'load'
  duration?: number
}

export interface PopupActivitySnapshot {
  items: PopupActivity[]
  activeId: string | null
}

interface Entry {
  value: PopupActivity
  remaining: number | null
  offered: boolean
  autoPresent: boolean
  createdAt: number
}

interface Clock {
  now(): number
  set(callback: () => void, delay: number): unknown
  clear(timer: unknown): void
}

const defaultClock: Clock = {
  now: () => Date.now(),
  set: (callback, delay) => setTimeout(callback, delay),
  clear: timer => clearTimeout(timer as ReturnType<typeof setTimeout>)
}

function duration(item: PopupActivity): number | null {
  if (item.type === 'pending' || item.type === 'error') return null
  return item.duration ?? (item.action === 'undo-delete' ? UNDO_WINDOW_MS : 2500)
}

function retained(item: PopupActivity): boolean {
  return Boolean(item.action || item.type === 'error' || item.type === 'pending')
}

function priority(item: PopupActivity): number {
  if (item.source === 'analysis') return 0
  if (item.type === 'pending') return 4
  if (item.type === 'error') return 3
  return item.action ? 2 : 1
}

/** Presentation time belongs to the visible card, not to a recoverable operation.
 * Offered entries are parked, never automatically rotated through again. */
export class PopupActivityQueue {
  private entries = new Map<string, Entry>()
  private activeId: string | null = null
  private pauses = new Set<string>()
  private timer: unknown = null
  private startedAt: number | null = null

  constructor(
    private onChange: (snapshot: PopupActivitySnapshot) => void,
    private clock: Clock = defaultClock
  ) {}

  snapshot(): PopupActivitySnapshot {
    return {
      items: [...this.entries.values()].map(entry => ({ ...entry.value })),
      activeId: this.activeId
    }
  }

  get(id: string): PopupActivity | undefined {
    return this.entries.get(id)?.value
  }

  publish(value: PopupActivity, { present = true } = {}): void {
    const previous = this.entries.get(value.id)
    if (previous && JSON.stringify(previous.value) === JSON.stringify(value)) return
    this.stopTimer()
    if (previous?.offered && this.activeId !== value.id && !retained(value)) {
      this.entries.delete(value.id)
      this.commit()
      return
    }
    this.entries.set(value.id, {
      value: { ...value },
      remaining: duration(value),
      offered: previous?.offered ?? false,
      autoPresent: present,
      createdAt: this.clock.now()
    })
    // Keep a pending → result chain in the same slot, including while focused.
    if (this.activeId !== value.id) this.offerNext()
    this.commit()
  }

  select(id: string): void {
    if (!this.entries.has(id)) return
    this.stopTimer()
    this.activate(id)
    const entry = this.entries.get(id)!
    entry.remaining = duration(entry.value)
    this.commit()
  }

  park(): void {
    this.stopTimer()
    const entry = this.activeId ? this.entries.get(this.activeId) : null
    if (entry) {
      entry.offered = true
      if (!retained(entry.value)) this.entries.delete(entry.value.id)
    }
    this.activeId = null
    // Explicitly returning to the page acknowledges queued messages as well.
    for (const item of this.entries.values()) item.offered = true
    this.commit()
  }

  remove(id: string): void {
    if (!this.entries.has(id)) return
    this.stopTimer()
    this.entries.delete(id)
    if (this.activeId === id) this.activeId = null
    this.offerNext()
    this.commit()
  }

  pause(reason: string, paused: boolean): void {
    if (this.pauses.has(reason) === paused) return
    this.stopTimer()
    if (paused) this.pauses.add(reason)
    else this.pauses.delete(reason)
    if (!this.pauses.size) this.offerNext()
    this.commit()
  }

  reset(): void {
    this.stopTimer()
    this.entries.clear()
    this.pauses.clear()
    this.activeId = null
    this.commit()
  }

  private activate(id: string): void {
    const previous = this.activeId ? this.entries.get(this.activeId) : null
    if (previous && previous.value.id !== id && !retained(previous.value)) {
      this.entries.delete(previous.value.id)
    }
    this.activeId = id
    this.entries.get(id)!.offered = true
  }

  private offerNext(): void {
    if (this.pauses.size) return
    for (const [id, entry] of this.entries) {
      if (!entry.offered && !retained(entry.value) &&
          this.clock.now() - entry.createdAt > (duration(entry.value) ?? Infinity)) this.entries.delete(id)
    }
    const current = this.activeId ? this.entries.get(this.activeId) : null
    // A foreground operation owns its place until it settles.
    if (current?.value.type === 'pending' && current.value.source !== 'analysis') return
    const candidate = [...this.entries.values()].reverse()
      .filter(entry => entry.autoPresent && !entry.offered)
      .sort((left, right) => priority(right.value) - priority(left.value))[0]
    if (candidate && (!current || priority(candidate.value) >= priority(current.value))) {
      this.activate(candidate.value.id)
    }
  }

  private stopTimer(): void {
    if (this.timer !== null) this.clock.clear(this.timer)
    this.timer = null
    const entry = this.activeId ? this.entries.get(this.activeId) : null
    if (entry?.remaining != null && this.startedAt !== null) {
      entry.remaining = Math.max(0, entry.remaining - (this.clock.now() - this.startedAt))
    }
    this.startedAt = null
  }

  private commit(): void {
    const entry = this.activeId ? this.entries.get(this.activeId) : null
    if (!this.pauses.size && entry && entry.remaining !== null) {
      this.startedAt = this.clock.now()
      this.timer = this.clock.set(() => {
        this.stopTimer()
        if (!retained(entry.value)) this.entries.delete(entry.value.id)
        this.activeId = null
        // Only previously unseen actionable work can follow; stale confirmations
        // must not keep the current-page card occupied.
        for (const [id, queued] of this.entries) {
          if (!retained(queued.value)) this.entries.delete(id)
        }
        this.offerNext()
        this.commit()
      }, entry.remaining)
    }
    // Subscribers may release a focus pause synchronously. Install the timer
    // first so such a nested update can replace it rather than leave two clocks.
    this.onChange(this.snapshot())
  }
}
