/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import type { SyncOAuthAdapterType, SyncOAuthClient } from '../../../shared/sync/sync-contract'

interface BundledOAuthConfiguration {
  extensionId: string
  clients: Partial<Record<SyncOAuthAdapterType, SyncOAuthClient>>
}

declare const __CURATOR_SYNC_OAUTH_CONFIG__: BundledOAuthConfiguration | undefined

export const bundledOAuth: BundledOAuthConfiguration = typeof __CURATOR_SYNC_OAUTH_CONFIG__ === 'object'
  ? __CURATOR_SYNC_OAUTH_CONFIG__
  : { extensionId: '', clients: {} }

export function oauthClientReady(type: SyncOAuthAdapterType, client?: SyncOAuthClient): boolean {
  return Boolean(client?.clientId && (type !== 'google-drive' || client.clientSecret))
}
