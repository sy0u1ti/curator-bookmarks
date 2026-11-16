import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createSyncProtocolServer } from './sync-protocol-fixtures.mjs'

// Read the Ego skill first. All extension storage belongs to these copied QA
// extensions; their bookmark API is isolated before any production code runs.
const spaceIndex = process.argv.indexOf('--space')
const space = spaceIndex < 0 ? null : Number(process.argv[spaceIndex + 1])
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const root = path.resolve('.tmp', `sync-background-${Date.now()}`)
await mkdir(root, { recursive: true })
const { buildId } = JSON.parse(await readFile('dist/build-info.json', 'utf8'))
const server = await createSyncProtocolServer(root)
const sourceManifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'))
const bookmarks = await readFile('src/testing/isolated-extension-bookmarks.js', 'utf8')
const extensions = {}
for (const kind of ['legacy', 'current']) {
  const directory = path.join(root, kind)
  extensions[kind] = directory.replaceAll('\\', '/')
  await cp(path.resolve('dist'), directory, { recursive: true })
  const manifest = { ...sourceManifest, name: `Curator QA ${kind}` }
  delete manifest.key
  delete manifest.commands
  delete manifest.chrome_url_overrides
  manifest.permissions = [...new Set([...manifest.permissions, 'identity', 'tabs', 'tabGroups', 'history'])]
  manifest.optional_permissions = manifest.optional_permissions.filter(value => !manifest.permissions.includes(value))
  manifest.host_permissions = ['http://127.0.0.1/*', 'https://*.googleapis.com/*', 'https://*.dropbox.com/*', 'https://*.dropboxapi.com/*']
  await writeFile(path.join(directory, 'qa-bookmarks.js'), bookmarks)
  const htmlPath = path.join(directory, 'src/options/options.html')
  await writeFile(htmlPath, (await readFile(htmlPath, 'utf8')).replace('<head>', '<head><script src="/qa-bookmarks.js"></script>'))
  if (kind === 'legacy') {
    manifest.background = { service_worker: 'qa-legacy.js', type: 'module' }
    await writeFile(path.join(directory, 'qa-legacy.js'), `
      const requests = [];
      chrome.runtime.onMessage.addListener((message, sender, reply) => {
        if (message.type === 'qa:requests') { reply(requests); return; }
        requests.push(message.type);
        if (message.type === 'curator:background-info') reply({ ok: true, result: { buildId: 'previous-installation' } });
      });
    `)
  } else {
    const loaderPath = path.join(directory, manifest.background.service_worker)
    await writeFile(loaderPath, `import './qa-bookmarks.js';\nimport './qa-network.js';\n` + await readFile(loaderPath, 'utf8'))
    await writeFile(path.join(directory, 'qa-network.js'), `
      if (!chrome.runtime.getManifest().name.startsWith('Curator QA ')) throw new Error('QA only');
      const originalFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input.url || String(input));
        if (/(googleapis|dropbox|dropboxapi)\\.com$/.test(url.hostname)) {
          return originalFetch(${JSON.stringify(server.base)} + '/oauth/' + url.hostname + url.pathname + url.search, init);
        }
        return originalFetch(input, init);
      };
      chrome.identity.launchWebAuthFlow = async ({ url }) => {
        const auth = new URL(url);
        if (auth.searchParams.get('code_challenge_method') !== 'S256') throw new Error('Missing S256 PKCE');
        return chrome.identity.getRedirectURL() + '?code=fixture-code&state=' + encodeURIComponent(auth.searchParams.get('state'));
      };
    `)
  }
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest))
  await build({
    stdin: {
      contents: `export { requestBackupRestore } from './src/shared/messages.ts';
        export { createCuratorBackupFile, listAutoBackupPoints, createAutoBackupBeforeDangerousOperation } from './src/shared/backup.ts';
        export { saveManualBookmarkTags, loadBookmarkTagIndex } from './src/shared/bookmark-tags.ts';`,
      resolveDir: process.cwd()
    },
    bundle: true, platform: 'browser', format: 'esm', outfile: path.join(directory, 'qa-api.js'),
    define: { __CURATOR_BUILD_ID__: JSON.stringify(buildId) }, logLevel: 'silent'
  })
}
const scriptPath = path.join(root, 'round-01.mjs')
await writeFile(scriptPath, `
  const { runBackgroundChecks } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/testing/sync-background-scenarios.mjs')).href)});
  const task = await taskSpace(${space ?? JSON.stringify(`Curator background QA ${Date.now()}`)});
  const report = await runBackgroundChecks(task, ${JSON.stringify({ root: root.replaceAll('\\', '/'), extensions, base: server.base, buildId })});
  await (await import('node:fs/promises')).writeFile(${JSON.stringify(path.join(root, 'report.json'))}, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  ${space ? '' : 'await task.finish({ keep: [] });'}
`)
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
      maxBuffer: 2 ** 20, timeout: 600000, windowsHide: true
    }, error => error ? reject(error) : resolve())
    child.stdin.end()
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  })
  if (server.unexpected.length) throw new Error(JSON.stringify(server.unexpected))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await writeFile(path.join(root, 'requests.json'), JSON.stringify({
    requests: server.requests.map(({ method, route }) => ({ method, route })),
    unexpected: server.unexpected
  }, null, 2))
  await server.close()
  console.log(`Background QA evidence: ${root}`)
}
