import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createSyncProtocolServer } from './sync-protocol-fixtures.mjs'

// Read `ego-browser skill` before running. Every destructive check operates on
// copied extensions with their bookmark APIs replaced before production boots.
const value = flag => {
  const index = process.argv.indexOf(flag)
  return index < 0 ? null : process.argv[index + 1]
}
const space = value('--space') === null ? null : Number(value('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const root = path.resolve('.tmp', `sync-modes-${Date.now()}`)
await mkdir(root, { recursive: true })
const server = await createSyncProtocolServer(root, { controls: true })
const source = path.resolve('dist')
const sourceManifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'))
const { buildId } = JSON.parse(await readFile(path.join(source, 'build-info.json'), 'utf8'))
const extensions = {}
for (const device of ['a', 'b']) {
  const directory = path.join(root, `device-${device}`)
  extensions[device] = directory.replaceAll('\\', '/')
  await cp(source, directory, { recursive: true })
  const manifest = { ...sourceManifest, name: `Curator QA sync modes ${device}` }
  delete manifest.key
  delete manifest.commands
  delete manifest.chrome_url_overrides
  manifest.permissions = [...new Set([...manifest.permissions, 'identity', 'tabs', 'tabGroups', 'history'])]
  manifest.optional_permissions = manifest.optional_permissions.filter(permission => !manifest.permissions.includes(permission))
  manifest.host_permissions = ['http://127.0.0.1/*', 'https://*.googleapis.com/*', 'https://*.dropbox.com/*', 'https://*.dropboxapi.com/*']
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest))
  await cp('src/testing/isolated-extension-bookmarks.js', path.join(directory, 'qa-bookmarks.js'))
  await cp('src/testing/isolated-extension-tabs.js', path.join(directory, 'qa-tabs.js'))
  await writeFile(path.join(directory, 'qa-worker.js'),
    (await readFile('src/testing/sync-mode-worker.fixture.js', 'utf8')).replaceAll('__QA_BASE__', JSON.stringify(server.base)))
  await writeFile(path.join(directory, 'qa-page.js'), `
    if (!chrome.runtime.getManifest().name.startsWith('Curator QA sync modes ')) throw new Error('QA only');
    window.__syncModeErrors = [];
    addEventListener('error', event => window.__syncModeErrors.push(event.message));
    addEventListener('unhandledrejection', event => window.__syncModeErrors.push(String(event.reason)));
    chrome.permissions.request = async permissions => {
      if (!await chrome.permissions.contains(permissions)) throw new Error('QA requested permissions outside its fixture');
      return true;
    };
  `)
  for (const entry of ['options', 'popup', 'sidepanel', 'newtab']) {
    const file = path.join(directory, 'src', entry, `${entry}.html`)
    await writeFile(file, (await readFile(file, 'utf8')).replace('<head>',
      '<head><script src="/qa-bookmarks.js"></script><script src="/qa-tabs.js"></script><script src="/qa-page.js"></script>'))
  }
  const loader = path.join(directory, manifest.background.service_worker)
  await writeFile(loader, `import './qa-bookmarks.js';\nimport './qa-tabs.js';\nimport './qa-worker.js';\n${await readFile(loader, 'utf8')}`)
}
const config = {
  root: root.replaceAll('\\', '/'), extensions, base: server.base, buildId, controlToken: server.controlToken,
  adapters: value('--adapters')?.split(',') || null,
  sections: value('--sections')?.split(',') || ['matrix', 'guards', 'triggers', 'tabs'],
}
await writeFile(path.join(root, 'config.json'), JSON.stringify(config, null, 2))
console.log(`Sync mode evidence: ${root}`)
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
const execute = file => new Promise((resolve, reject) => {
  const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(file).href}')`], {
    windowsHide: true, timeout: 1800000, maxBuffer: 2 ** 22,
  }, error => error ? reject(error) : resolve())
  child.stdin.end()
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
})
const script = path.join(root, 'round-01.mjs')
await writeFile(script, `
  const task = await taskSpace(${space ?? JSON.stringify(`Curator sync mode QA ${Date.now()}`)});
  const fs = await import('node:fs/promises');
  await fs.writeFile(${JSON.stringify(path.join(root, 'space.json'))}, JSON.stringify({spaceId:task.spaceId}));
  const {runSyncModeChecks} = await import(${JSON.stringify(pathToFileURL(path.resolve('src/testing/sync-mode-scenarios.mjs')).href)});
  await runSyncModeChecks(task, ${JSON.stringify(config)});
`)
try {
  await execute(script)
  if (server.unexpected.length) throw new Error(JSON.stringify(server.unexpected))
  if (space === null) {
    const { spaceId } = JSON.parse(await readFile(path.join(root, 'space.json'), 'utf8'))
    const finish = path.join(root, 'finish.mjs')
    await writeFile(finish, `const task = await taskSpace(${spaceId}); await task.finish({keep:[]});`)
    await execute(finish)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await writeFile(path.join(root, 'requests.json'), JSON.stringify({
    requests: server.requests.map(({ method, route }) => ({ method, route })),
    unexpected: server.unexpected,
  }, null, 2))
  await server.close()
}
