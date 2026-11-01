import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// Read the Ego skill first. Existing spaces are reused, never finished by this runner.
const argument = name => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const space = argument('--space') === null ? null : Number(argument('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const directory = path.resolve('.tmp', `layout-stability-${Date.now()}`)
await mkdir(directory, { recursive: true })
const responses = new Map()
for (const surface of ['options', 'popup', 'sidepanel', 'newtab', 'archive']) {
  const html = await readFile(`dist/src/${surface}/${surface}.html`, 'utf8')
  const styles = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
  if (!styles.length) throw new Error('Build the extension before running layout checks')
  const css = await Promise.all(styles.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))
  responses.set(`/production-${surface}.css`, ['text/css', css.join('\n')])
}
const controllerStubs = new Map()
for (const name of ['options', 'popup']) {
  const source = await readFile(`src/${name}/${name}-controller.ts`, 'utf8')
  const names = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(match => match[1])
  controllerStubs.set(`${name}-controller`, names.map(name =>
    `export function ${name}(...args) { ${name.startsWith('handle') ? `return window.__stability?.dispatch(${JSON.stringify(name)}, args)` : ''} }`
  ).join('\n'))
}
const bundles = await build({
  entryPoints: { fixture: 'src/ui/layout-stability.fixture.tsx', archive: 'src/archive/main.tsx' },
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', outdir: directory,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'isolated-io',
    setup(builder) {
      // The production bundle supplies global styles, including compiled Tailwind.
      builder.onLoad({ filter: /[\\/]styles[\\/]globals\.css$/ }, () => ({ contents: '', loader: 'css' }))
      builder.onResolve({ filter: /(^|\/)(options|popup)-controller(\.js)?$/ }, args => ({
        path: path.basename(args.path).replace(/\.js$/, ''), namespace: 'stability-io'
      }))
      builder.onLoad({ filter: /.*/, namespace: 'stability-io' }, args => ({ contents: controllerStubs.get(args.path) }))
    }
  }]
})
for (const file of bundles.outputFiles) responses.set(`/${path.basename(file.path)}`, [file.path.endsWith('.css') ? 'text/css' : 'text/javascript', file.text])
const bootstrap = `
window.__fixtureErrors = [];
addEventListener('error', event => window.__fixtureErrors.push(event.message));
addEventListener('unhandledrejection', event => window.__fixtureErrors.push(String(event.reason)));
const event = () => ({ addListener() {}, removeListener() {} });
const values = {};
const result = (value, callback) => { if (callback) queueMicrotask(() => callback(value)); return Promise.resolve(value); };
window.__archiveIO = { denied: false, failed: false, downloads: 0, release: null, hold: false };
window.chrome = {
  runtime: { id: 'curator-isolated-stability', getURL: value => '/' + value, onMessage: event(), sendMessage: async () => ({ ok: true }) },
  storage: { onChanged: event(), local: {
    get: (keys, callback) => result(keys === null ? values : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, values[key]])), callback),
    set: (data, callback) => { Object.assign(values, data); return result(undefined, callback); },
    getBytesInUse: (_, callback) => result(0, callback)
  } },
  permissions: { contains: async () => true, request: (_, callback) => result(!window.__archiveIO.denied, callback) },
  tabs: {
    get: (id, callback) => result({ id, windowId: 1, title: '排版与交互参考', url: 'https://example.test/design' }, callback),
    update: async () => {}, onActivated: event(), onUpdated: event()
  },
  windows: { update: async () => {}, getCurrent: callback => result({ id: 1 }, callback), onFocusChanged: event() },
  bookmarks: { onCreated: event(), onRemoved: event(), onChanged: event(), onMoved: event(), onChildrenReordered: event(), onImportEnded: event() },
  pageCapture: { saveAsMHTML: (_, callback) => {
    const finish = () => callback(window.__archiveIO.failed ? null : new Blob(['Isolated archive'], { type: 'multipart/related' }));
    if (window.__archiveIO.hold) window.__archiveIO.release = finish; else queueMicrotask(finish);
  } }
};
HTMLAnchorElement.prototype.click = function () { window.__archiveIO.downloads++; };
`
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  const surface = url.searchParams.get('surface') || 'general'
  if (url.pathname === '/') {
    const kind = surface === 'archive' ? 'archive' : surface.startsWith('newtab') ? 'newtab' : surface === 'sidepanel' ? 'sidepanel' : surface.startsWith('popup') ? 'popup' : 'options'
    const entry = kind === 'archive' ? 'archive' : 'fixture'
    const rootId = kind === 'archive' ? 'archive-root' : kind === 'popup' || kind === 'sidepanel' ? 'popup-root' : 'root'
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(`<!doctype html><html><head><title>Curator interaction stability</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/production-${kind}.css"><link rel="stylesheet" href="/${entry}.css"><style>html,body,#root,#popup-root{height:100%;min-height:0;margin:0}body{min-width:0}#root,#popup-root{isolation:isolate}</style></head><body><div id="${rootId}" data-popup-ready="true"></div><script>${bootstrap}</script><script type="module" src="/${entry}.js"></script></body></html>`)
    return
  }
  const value = responses.get(url.pathname)
  response.writeHead(value ? 200 : 404, { 'content-type': `${value?.[0] || 'text/plain'}; charset=utf-8`, 'cache-control': 'no-store' })
  response.end(value?.[1] || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const options = { surfaces: argument('--surfaces')?.split(','), widths: argument('--widths')?.split(',').map(Number) }
const script = `
const { runLayoutStabilityChecks } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/ui/layout-stability-scenarios.mjs')).href)});
const task = await taskSpace(${space ?? JSON.stringify(`Curator layout stability ${Date.now()}`)});
const page = task.page("p1");
console.log({ spaceId: task.spaceId, page: page.label });
await page.info();
const windowInfo = await task.cdp("Browser.getWindowForTarget", { targetId: page.targetId });
if (windowInfo.bounds.windowState === "minimized") {
  await task.cdp("Browser.setWindowBounds", { windowId: windowInfo.windowId, bounds: { windowState: "normal" } });
}
const report = await runLayoutStabilityChecks(page, "http://127.0.0.1:${server.address().port}", ${JSON.stringify(directory.replaceAll('\\', '/'))}, ${JSON.stringify(options)});
await (await import("node:fs/promises")).writeFile(${JSON.stringify(path.join(directory, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures, screenshots: report.screenshots.length, frames: report.frames }));
if (report.failures.length) throw new Error("Interaction layout regression(s); see report.json");
${space ? '' : 'await task.finish({ keep: [] });'}
`
const scriptPath = path.join(directory, 'round-01.mjs')
await writeFile(scriptPath, script, 'utf8')
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
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  console.log(`Layout stability report: ${path.join(directory, 'report.json')}`)
}
