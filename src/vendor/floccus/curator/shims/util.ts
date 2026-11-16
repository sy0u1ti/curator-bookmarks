/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * floccus' Logger formats its lines with Node's util.format, which webpack
 * polyfills for it. The logger only ever joins a timestamp, strings and the
 * occasional error or object, so this covers what it uses without bringing
 * Node's `util` and `process` into a service worker.
 */
function describe(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (e) {
      return Object.prototype.toString.call(value)
    }
  }
  return String(value)
}

export function format(...values: unknown[]): string {
  return values.map(describe).join(' ')
}

export default { format }
