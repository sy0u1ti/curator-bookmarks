# floccus sync engine

Bookmark sync in Curator is the sync engine of [floccus](https://github.com/floccusaddon/floccus)
by Marcel Klehr and contributors, licensed under the Mozilla Public License 2.0 (`LICENSE.txt`).

- Upstream: `https://github.com/floccusaddon/floccus`, branch `develop`
- Base version: 5.13.0, commit `638b3dc7c4e18834c64f2c8dd41ea6dd7b44d626` (2026-11-08)
- Linkwarden adapter: `efa8ec4ae3828ec2f0cbfc30cec9ad9adb57c56a`, verified 2026-11-15.
  Includes optional link/collection ordering for Linkwarden 2.17+. New Curator
  profiles enable it; existing or imported profiles retain their previous setting.

Every file in this directory is covered by the MPL 2.0, including the ones written for Curator.
The rest of Curator stays under its own licence; the MPL applies per file.

## What is here

`src/lib` and `src/errors` retain the upstream implementations at the revisions
listed above, except the browser API and I18n replacements listed below. To update,
copy the applicable upstream files and record their revisions.

Not copied: the Vue interface (`src/ui`), the mobile app (`src/lib/native`, `android`, `ios`),
`Controller.ts`, `browser/BrowserController.js`, `interfaces/Controller.ts`, `on-wake-up.ts`,
`getFavicon.js`, `SharedUrls.js`, the locale files, and floccus' OAuth client credentials.

Written for Curator:

| File | Replaces |
| --- | --- |
| `src/lib/browser-api.ts` | `src/lib/browser-api.js`: reads `chrome` at call time, namespaces storage, reports created bookmarks |
| `src/lib/native/I18n.ts` | `src/lib/native/I18n.ts`: bundled messages instead of `_locales` |
| `curator/SyncController.ts` | `src/lib/browser/BrowserController.js`: upstream trigger rules, serial per-profile requests through completion, no listeners or floccus chrome of its own |
| `curator/engine.ts` | the profile operations of `src/ui/store/actions.js` |
| `curator/messages.ts` | the engine's messages from `_locales` |
| `curator/shims/*` | Capacitor HTTP's web contract (used by Drive/Dropbox), native-only plugins, Node's `util`/`process`/`Buffer`, `package.json`, OAuth credentials |
| `curator/oauth.ts` | Per-attempt OAuth with SHA-256 PKCE and validated redirects; client settings are saved only after success |
| `curator/build.mjs` | the webpack build |

## How it is built

`curator/build.mjs` bundles `curator/engine.ts` with esbuild into one module that evaluates nothing
until it is called. Vite serves it as `virtual:curator-sync-engine`, which only the service worker
imports (declared in `src/shared/sync/sync-engine-module.d.ts`). Curator's pages talk to it through runtime messages (`src/shared/sync`).

The directory is excluded from Curator's TypeScript project: the upstream files are checked
upstream with their own compiler settings, and the engine is built with those settings here.

## Google Drive and Dropbox

floccus' OAuth clients belong to floccus. Curator bundles its own publisher clients so users
can sign in directly. The optional custom-client controls live in advanced settings.
See [publisher configuration and release validation](OAUTH.md).

The publisher supplies the clients at build time; `npm run build:release` refuses a release
without them. A development build without those settings cannot authorize real accounts.
