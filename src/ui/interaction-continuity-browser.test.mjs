import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const arg = name => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const space = arg('--space') === null ? null : Number(arg('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const reportOnly = process.argv.includes('--report-only')
const directory = path.resolve('.tmp', `interaction-continuity-${Date.now()}`)
await mkdir(directory, { recursive: true })
const source = await readFile('src/options/options-controller.ts', 'utf8')
const stubs = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(([, name]) =>
  `export function ${name}(...args) { ${name.startsWith('handle') ? `return window.__continuity?.dispatch(${JSON.stringify(name)}, args)` : ''} }`
).join('\n')
const bundle = await build({
  entryPoints: ['src/ui/interaction-continuity.fixture.tsx'],
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
  outfile: path.join(directory, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'isolated-continuity-io',
    setup(builder) {
      builder.onResolve({ filter: /(^|\/)options-controller(\.js)?$/ }, () => ({ path: 'controller', namespace: 'stub' }))
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stubs }))
    }
  }]
})
const html = await readFile('dist/src/options/options.html', 'utf8')
const sheets = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
if (!sheets.length) throw new Error('Build the extension before running this test')
const assets = new Map(bundle.outputFiles.map(file => [`/${path.basename(file.path)}`, file.contents]))
assets.set('/production.css', (await Promise.all(sheets.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))).join('\n'))
assets.set('/assets/icon128.png', await readFile('src/assets/icon128.png'))
const bootstrap = `
window.__fixtureErrors = [];
addEventListener("error", event => window.__fixtureErrors.push(event.message));
addEventListener("unhandledrejection", event => window.__fixtureErrors.push(String(event.reason)));
const event = () => ({addListener(){},removeListener(){}});
const result = (value, callback) => { if (callback) queueMicrotask(() => callback(value)); return Promise.resolve(value); };
window.chrome = {
  runtime:{id:"isolated-continuity",getURL:path=>"/"+path,onMessage:event(),sendMessage:async()=>({ok:true})},
  storage:{onChanged:event(),local:{get:(_,cb)=>result({},cb),set:(_,cb)=>result(undefined,cb),getBytesInUse:(_,cb)=>result(0,cb)}},
  permissions:{contains:async()=>false,request:async()=>false},
  bookmarks:{getTree:cb=>result([],cb),onCreated:event(),onRemoved:event(),onChanged:event(),onMoved:event(),onChildrenReordered:event(),onImportEnded:event()}
};`
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  response.setHeader('cache-control', 'no-store')
  if (url.pathname === '/') {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end(`<!doctype html><html data-curator-surface="options"><head><title>Curator continuity</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/production.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="options-root"></div><script>${bootstrap}</script><script type="module" src="/fixture.js"></script></body></html>`)
    return
  }
  const asset = assets.get(url.pathname)
  response.statusCode = asset ? 200 : 404
  response.setHeader('content-type', url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.png') ? 'image/png' : 'text/javascript')
  response.end(asset || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const scriptPath = path.join(directory, 'round-01.mjs')
await writeFile(scriptPath, `
const { runContinuityScenarios } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/ui/interaction-continuity-scenarios.mjs')).href)});
const task = await taskSpace(${space ?? JSON.stringify(`Curator continuity ${Date.now()}`)});
const page = task.page("p1");
console.log({ spaceId: task.spaceId, page: page.label });
await page.info();
const browserWindow = await task.cdp("Browser.getWindowForTarget", {targetId:page.targetId});
if (browserWindow.bounds.windowState === "minimized") await task.cdp("Browser.setWindowBounds",{windowId:browserWindow.windowId,bounds:{windowState:"normal"}});
const report = await runContinuityScenarios(page, "http://127.0.0.1:${server.address().port}", ${JSON.stringify(directory.replaceAll('\\', '/'))});
await (await import("node:fs/promises")).writeFile(${JSON.stringify(path.join(directory, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (report.failures.length && ${!reportOnly}) throw new Error("Interaction continuity regression; see report.json");
${space ? '' : 'await task.finish({keep:[]});'}
`, 'utf8')
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
      maxBuffer: 2 ** 20, timeout: 480000, windowsHide: true
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
  console.log(`Continuity report: ${path.join(directory, 'report.json')}`)
}
