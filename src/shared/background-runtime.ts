/**
 * An unpacked extension keeps its installed worker until Chrome reloads it,
 * even if a build has replaced the files its pages load. Check the peer before
 * sending a request; retrying a failed mutation could apply it twice.
 */
declare const __CURATOR_BUILD_ID__: string | undefined

export const CURATOR_BUILD_ID = typeof __CURATOR_BUILD_ID__ === 'string' ? __CURATOR_BUILD_ID__ : 'development'
export const BACKGROUND_INFO_MESSAGE = 'curator:background-info'
export interface BackgroundInfoMessage { type: typeof BACKGROUND_INFO_MESSAGE }

export class BackgroundRuntimeError extends Error {
  constructor(public readonly code: 'background-outdated' | 'background-unavailable') {
    super(code === 'background-outdated'
      ? '扩展已更新，后台仍是旧版本。请在扩展管理中重新加载 Curator，再刷新本页。'
      : '后台未能响应。请在扩展管理中重新加载 Curator，再刷新本页。')
    this.name = 'BackgroundRuntimeError'
  }
}

type Transport = (message: BackgroundInfoMessage) => Promise<unknown>

/** A failed check is never cached, so the user's retry can recover. */
export function createBackgroundReadyCheck(buildId: string, send: Transport, timeoutMs = 5000): () => Promise<void> {
  let ready: Promise<void> | null = null
  return () => {
    ready ??= new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new BackgroundRuntimeError('background-unavailable')), timeoutMs)
      Promise.resolve().then(() => send({ type: BACKGROUND_INFO_MESSAGE })).then(reply => {
        if (!reply || typeof reply !== 'object' || !('ok' in reply) || reply.ok !== true ||
          !('result' in reply) || !reply.result || typeof reply.result !== 'object' ||
          !('buildId' in reply.result) || typeof reply.result.buildId !== 'string') {
          throw new BackgroundRuntimeError('background-unavailable')
        }
        if (reply.result.buildId !== buildId) throw new BackgroundRuntimeError('background-outdated')
        resolve()
      }).catch(error => reject(error instanceof BackgroundRuntimeError ? error : new BackgroundRuntimeError('background-unavailable')))
        .finally(() => clearTimeout(timeout))
    }).catch(error => {
      ready = null
      throw error
    })
    return ready
  }
}

const check = createBackgroundReadyCheck(CURATOR_BUILD_ID, message => chrome.runtime.sendMessage(message))

export function ensureBackgroundReady(): Promise<void> {
  // Standalone component fixtures have no installed background. Production and
  // the Vite dev server both supply a build id.
  return CURATOR_BUILD_ID === 'development' ? Promise.resolve() : check()
}

export function isBackgroundRuntimeError(error: unknown): error is BackgroundRuntimeError {
  return error instanceof BackgroundRuntimeError
}

export function openExtensionManager(): Promise<chrome.tabs.Tab> {
  return chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` })
}
