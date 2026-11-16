/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Bundles the sync engine into one module that does nothing until it is asked
 * for. A Manifest V3 service worker can neither `import()` nor `importScripts()`
 * a module on demand, and floccus loads its adapters and strategies that way;
 * esbuild keeps those imports lazy inside a single file. The whole bundle sits
 * in a function, so a worker that never syncs doesn't evaluate any of it.
 */
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const shim = name => path.join(directory, 'shims', name)

export const SYNC_ENGINE_ENTRY = path.join(directory, 'engine.ts')

const hostPlugin = {
  name: 'curator-sync-engine-host',
  setup(builder) {
    // The mobile app's plugins and its half of the code base
    builder.onResolve({ filter: /^@capacitor(-community)?\// }, () => ({ path: shim('capacitor.ts') }))
    builder.onResolve({ filter: /^\.{1,2}\/(.*\/)?native\/[^/]+$/ }, args =>
      args.path.endsWith('/I18n') ? undefined : { path: args.path, namespace: 'floccus-native' })
    builder.onLoad({ filter: /.*/, namespace: 'floccus-native' }, args => ({
      contents: `export default new Proxy({}, { get() { throw new Error(${JSON.stringify(
        `${args.path} belongs to the floccus mobile app`
      )}) } })`,
    }))
    // Node's util, floccus' package.json and floccus' own OAuth clients
    builder.onResolve({ filter: /^util$/ }, () => ({ path: shim('util.ts') }))
    builder.onResolve({ filter: /^\.\.\/\.\.\/package\.json$/ }, () => ({ path: shim('package.ts') }))
    builder.onResolve({ filter: /google-api\.credentials\.json$/ }, () => ({ path: shim('google-credentials.ts') }))
    builder.onResolve({ filter: /dropbox-api\.credentials\.json$/ }, () => ({ path: shim('dropbox-credentials.ts') }))
  },
}

/**
 * @param {{ minify?: boolean, metafile?: boolean, buildId?: string, oauth?: { extensionId: string, clients: Record<string, { clientId: string, clientSecret?: string }> } }} [options]
 * @returns {Promise<{ code: string, metafile?: import('esbuild').Metafile }>} an ES module whose default
 *   export is a function that evaluates the engine on its first call and returns it
 */
export async function buildSyncEngine({ minify = true, metafile = false, buildId = 'development', oauth = { extensionId: '', clients: {} } } = {}) {
  const result = await build({
    entryPoints: [SYNC_ENGINE_ENTRY],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    write: false,
    minify,
    metafile,
    logLevel: 'silent',
    // floccus' webpack build defines these and provides Buffer to isomorphic-git
    define: {
      IS_BROWSER: 'true', DEBUG: 'false',
      __CURATOR_BUILD_ID__: JSON.stringify(buildId),
      __CURATOR_SYNC_OAUTH_CONFIG__: JSON.stringify(oauth),
    },
    inject: [shim('buffer.ts'), shim('process.ts')],
    // floccus compiles for ES6, where a class field without a value declares
    // nothing. Curator's own tsconfig would turn each into `field = undefined`,
    // which clears what a base constructor has just set.
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
    plugins: [hostPlugin],
  })
  const bundle = result.outputFiles[0].text
  const code = [
    'let engine',
    'export default function loadSyncEngine() {',
    '  if (!engine) {',
    '    const module = { exports: {} }',
    '    ;(function (module, exports) {',
    bundle,
    '    })(module, module.exports)',
    '    engine = module.exports.default',
    '  }',
    '  return engine',
    '}',
    '',
  ].join('\n')
  return { code, metafile: result.metafile }
}
