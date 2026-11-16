/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * floccus and two of its dependencies read Node's `process`, which webpack
 * polyfills for them. A service worker has none: `process.versions.node` in
 * floccus' yieldToEventLoop would throw on the first folder it hashes. This is
 * the part of the polyfill they read.
 */
export const process = {
  env: {} as Record<string, string | undefined>,
  versions: {} as Record<string, string | undefined>,
  platform: 'browser',
  nextTick(callback: (...args: unknown[]) => void, ...args: unknown[]): void {
    queueMicrotask(() => callback(...args))
  },
}
