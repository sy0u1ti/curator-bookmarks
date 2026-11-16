declare module 'virtual:curator-sync-engine' {
  import type { SyncEngine } from './sync-contract'

  /** Evaluates the bundled sync engine (src/vendor/floccus) on its first call and returns it. */
  export default function loadSyncEngine(): SyncEngine
}
