/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * floccus shares its adapters with a Capacitor mobile app and imports the
 * Capacitor plugins at the top of each of them. Google Drive and Dropbox also
 * use CapacitorHttp on the web, so that bridge must preserve its HTTP contract.
 * The other, native-only plugins remain unavailable.
 */
function unavailable(name: string): never {
  throw new Error(`${name} is only available in the floccus mobile app`)
}

export const Capacitor = {
  getPlatform: (): string => 'web',
}

interface HttpOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  data?: unknown
  responseType?: string
  connectTimeout?: number
  readTimeout?: number
}

async function request(options: HttpOptions) {
  const headers = new Headers(options.headers)
  let body = options.data as BodyInit | undefined
  if (body && typeof body === 'object' && !(body instanceof Blob) && !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) && !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body)) {
    body = JSON.stringify(body)
  }
  const response = await fetch(options.url, {
    method: options.method || 'GET', headers,
    ...(!['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase()) && body !== undefined ? { body } : {}),
    credentials: 'omit', signal: AbortSignal.timeout(options.readTimeout || options.connectTimeout || 30000)
  })
  const text = await response.text()
  // Capacitor parses JSON Content-Type even when callers requested text. The
  // upstream adapters' json() method returns data directly, relying on this.
  const json = options.responseType === 'json' || /application\/(?:[\w.+-]*\+)?json/i.test(response.headers.get('content-type') || '')
  return {
    status: response.status, url: response.url, headers: Object.fromEntries(response.headers),
    data: json && text ? JSON.parse(text) : text
  }
}

export const CapacitorHttp = {
  request,
  get: (options: HttpOptions) => request({ ...options, method: 'GET' }),
  post: (options: HttpOptions) => request({ ...options, method: 'POST' }),
  put: (options: HttpOptions) => request({ ...options, method: 'PUT' }),
  delete: (options: HttpOptions) => request({ ...options, method: 'DELETE' }),
}

export const GenericOAuth2 = {
  authenticate: (): never => unavailable('GenericOAuth2'),
}

export const Share = {
  share: (): never => unavailable('Share'),
}

export const Filesystem = {
  writeFile: (): never => unavailable('Filesystem'),
}

export const Directory = { External: 'EXTERNAL' }

export const Encoding = { UTF8: 'utf8' }
