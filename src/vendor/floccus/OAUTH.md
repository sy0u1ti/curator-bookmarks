# Publisher setup for Google Drive and Dropbox

Curator uses its own OAuth applications. The normal interface offers **使用 Google 登录**
and **使用 Dropbox 登录**. Users do not create developer accounts or enter OAuth client IDs.
An existing custom client remains available through the editor's advanced settings.

## Configure the publisher build

Copy the repository's `oauth.env.example` to `.env.local`, which is already git-ignored.
Fill these environment variables, or supply them through the release environment:

| Variable | Value |
| --- | --- |
| `CURATOR_EXTENSION_PUBLIC_KEY` | The Base64 DER public key of the Curator Chrome Web Store item |
| `CURATOR_DEVELOPMENT_EXTENSION_ID` | Optional ID of an existing unpacked development installation; ignored by `build:release` |
| `CURATOR_GOOGLE_CLIENT_ID` | Curator's Google **Web application** OAuth client ID |
| `CURATOR_GOOGLE_CLIENT_SECRET` | That Google client's secret |
| `CURATOR_DROPBOX_CLIENT_ID` | Curator's Dropbox app key |

The public key fixes the extension ID. Register this exact URI with both providers:

```text
https://<Curator extension ID>.chromiumapp.org/
```

Use the existing Curator store item's key when there is one. Giving an existing installation a
different extension ID creates another extension with separate storage; it does not migrate
bookmarks settings or credentials. For a local unpacked development installation, clients can
instead be registered for that installation's ID; it is shown under advanced OAuth settings.
Set `CURATOR_DEVELOPMENT_EXTENSION_ID` to retain that installation's ID during ordinary builds
while keeping the publisher public key ready for release builds. Register both callback URLs
with each provider. `build:release` always selects the publisher public key and its derived ID.
For a project not yet on the Chrome Web Store, generate a dedicated signing key once, retain
the private key outside the repository, and use its Base64 DER public key for releases.

The build computes the ID from the public key and the runtime checks it before opening a
bundled login. The secret is bundled only into the worker, never sent in OAuth settings
responses, and is removed from diagnostic logs. Installed extension code can be inspected:
the client secret is not a substitute for PKCE or user consent.

## Google

1. Create or select the publisher's Google Cloud project and enable the Google Drive API.
2. Configure the OAuth consent screen for **Curator**, with the publisher's support and privacy
   information. Select the `https://www.googleapis.com/auth/drive.file` scope.
3. Create a **Web application** client and add the exact redirect URI above. This integration
   uses `launchWebAuthFlow` with a refresh token, including on browsers without Chrome account
   sign-in; a Chrome Extension client for `getAuthToken` is a different flow.
4. For development, add the intended test accounts. Before distribution, complete the provider's
   publishing requirements and leave testing mode. External Google apps in testing mode may
   receive refresh tokens that expire after seven days.
5. Put the client ID and secret in the publisher environment.

## Dropbox

1. Create the publisher's scoped Dropbox app and choose its permitted content access.
2. Enable `files.content.write`, `files.content.read`, `files.metadata.write`, and
   `account_info.read`.
3. Register the exact redirect URI and put the app key in the publisher environment.
4. Check Dropbox's current development-user limit and production-review requirements
   before distribution. Development status supports real account authorization and
   synchronization; production approval removes the linked-user limit. Keep these
   separate when reporting release readiness, and claim production approval only
   after the developer console confirms it.

No Dropbox app secret is needed; Curator uses S256 PKCE and offline access.

## Validate and distribute

```text
npm run build:release
```

Release builds write to `release/dist/`, keeping the installed development build in `dist/`
and its existing extension ID intact. They fail before replacing the release output if either
provider or the extension key is absent. `npm run build` remains available for local development without publisher configuration. Such
a build explicitly reports that its login providers are unconfigured; it must not be described
as a completed one-click-login release.

For an unpacked extension, reload **Curator** once in `chrome://extensions` after replacing
the build, then refresh the options page. Merely building files or reopening options does not
replace the worker cached by Chrome. The options page checks the worker's build ID before sync,
storage cleanup or restoration, and offers the extension-management page when they differ.
It never reloads the user's extension automatically.

Finally verify consent, cancellation, a new login, a sync, and token refresh with publisher-owned
test accounts on both services. Mock token responses prove the protocol implementation, not the
provider registration or the consent screen.
