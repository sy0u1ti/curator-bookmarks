/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * floccus reads the OAuth clients of its Google Drive and Dropbox adapters from
 * google-api.credentials.json and dropbox-api.credentials.json. Those clients
 * belong to floccus and only accept floccus' own extension ids as redirect
 * targets, so they are not part of this copy. The two imports resolve to the
 * objects below. engine.ts supplies Curator's bundled publisher clients, or an
 * explicitly selected custom client, before the adapters are used.
 */
export interface OAuthClientCredentials {
  web: { client_id: string; client_secret: string }
  // Read while the adapter modules load; never used in a browser
  android: { client_id: string }
  ios: { client_id: string }
}

function emptyCredentials(): OAuthClientCredentials {
  return {
    web: { client_id: '', client_secret: '' },
    android: { client_id: '' },
    ios: { client_id: '' },
  }
}

export const googleCredentials = emptyCredentials()
export const dropboxCredentials = emptyCredentials()
