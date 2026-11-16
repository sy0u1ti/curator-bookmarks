import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createSyncProtocolServer } from '../sync-protocol-fixtures.mjs'

// Production entrypoints and worker in a copied extension. Bookmark mutation
// is isolated before either entrypoint executes; no user's data is touched.
const root = path.resolve('.tmp', `popup-sync-${Date.now()}`)
const spaceIndex = process.argv.indexOf('--space')
const space = spaceIndex < 0 ? null : Number(process.argv[spaceIndex + 1])
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const extension = path.join(root, 'extension')
await mkdir(root, { recursive: true })
await cp(path.resolve('dist'), extension, { recursive: true })
const server = await createSyncProtocolServer(root)
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'))
manifest.name = 'Curator QA popup sync'
delete manifest.key
delete manifest.commands
delete manifest.chrome_url_overrides
manifest.host_permissions = ['http://127.0.0.1/*']
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest))
await writeFile(path.join(extension, 'qa-bookmarks.js'), await readFile('src/testing/isolated-extension-bookmarks.js', 'utf8'))
await writeFile(path.join(extension, 'qa-page.js'), `
if (!chrome.runtime.getManifest().name.startsWith('Curator QA ')) throw new Error('QA only');
window.__syncQa = { errors: [], requests: [], createdTabs: [], closed: false };
window.close = () => { window.__syncQa.closed = true; };
addEventListener('error', event => window.__syncQa.errors.push(event.message));
addEventListener('unhandledrejection', event => window.__syncQa.errors.push(String(event.reason)));
const send = chrome.runtime.sendMessage.bind(chrome.runtime);
chrome.runtime.sendMessage = (...args) => { window.__syncQa.requests.push(args[0]?.type); return send(...args); };
// Chromium can refresh API bindings even for an already granted permission
// request. This fixture must never replace its isolated bookmark API with the
// real profile's. All tested servers are granted in the QA manifest.
chrome.permissions.request = async permissions => {
  if (!await chrome.permissions.contains(permissions)) throw new Error('QA requested a permission outside its manifest');
  return true;
};
const query = chrome.tabs.query.bind(chrome.tabs);
const createTab = chrome.tabs.create.bind(chrome.tabs);
chrome.tabs.create = (details, callback) => {
  if (!details?.url?.includes('syncEditor=')) return callback ? createTab(details, callback) : createTab(details);
  window.__syncQa.createdTabs.push(details.url);
  if (callback) { queueMicrotask(() => callback({ id: -1, ...details })); return; }
  return Promise.resolve({ id: -1, ...details });
};
chrome.tabs.query = (details, callback) => {
  if (!details?.active) return callback ? query(details, callback) : query(details);
  const result = [{ id: -1, active: true, windowId: -1, title: 'Curator QA current page', url: 'https://curator-qa.invalid/current' }];
  if (callback) { queueMicrotask(() => callback(result)); return; }
  return Promise.resolve(result);
};
`)
for (const name of ['options', 'popup', 'sidepanel']) {
  const html = path.join(extension, 'src', name, `${name}.html`)
  await writeFile(html, (await readFile(html, 'utf8')).replace('<head>', '<head><script src="/qa-bookmarks.js"></script><script src="/qa-page.js"></script>'))
}
const loader = path.join(extension, manifest.background.service_worker)
await writeFile(loader, `import './qa-bookmarks.js';\n` + await readFile(loader, 'utf8'))
const config = { root: root.replaceAll('\\', '/'), extension: extension.replaceAll('\\', '/'), base: server.base }
await writeFile(path.join(root, 'config.json'), JSON.stringify(config, null, 2))
console.log(JSON.stringify(config))
if (!process.argv.includes('--serve')) {
  const script = path.join(root, 'round-01.mjs')
  const finish = path.join(root, 'finish.mjs')
  await writeFile(script, `
const task=await taskSpace(${space ?? JSON.stringify(`Curator popup sync QA ${Date.now()}`)});
const fs=await import('node:fs/promises');
await fs.writeFile(${JSON.stringify(path.join(root, 'space.json'))},JSON.stringify({spaceId:task.spaceId}));
const {runPopupSyncChecks}=await import(${JSON.stringify(pathToFileURL(path.resolve('src/testing/popup-sync-scenarios.mjs')).href)});
const report=await runPopupSyncChecks(task,${JSON.stringify(config)});
await fs.writeFile(${JSON.stringify(path.join(root, 'report.json'))},JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
`, 'utf8')
  const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
  const execute = file => new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(file).href}')`], {
      maxBuffer: 2 ** 20, timeout: 600000, windowsHide: true
    }, error => error ? reject(error) : resolve())
    child.stdin.end()
    child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr)
  })
  try {
    await execute(script)
    if (space === null) {
      const { spaceId } = JSON.parse(await readFile(path.join(root, 'space.json'), 'utf8'))
      await writeFile(finish, `const task=await taskSpace(${spaceId}); await task.finish({keep:[]});`)
      await execute(finish)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    await server.close()
    console.log(`Popup sync evidence: ${root}`)
  }
}
