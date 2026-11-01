import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// Uses the real Options shell with isolated I/O, never the user's extension data.
const arg = name => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const space = arg('--space') === null ? null : Number(arg('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const output = path.resolve('.tmp', `sidebar-motion-${Date.now()}`)
await mkdir(output, { recursive: true })
const controller = await readFile('src/options/options-controller.ts', 'utf8')
const stubs = [...controller.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)]
  .map(([, name]) => `export function ${name}() {}`).join('\n')
const bundle = await build({
  stdin: {
    contents: 'import {createRoot} from "react-dom/client"; import {OptionsApp} from "./src/options/OptionsApp"; createRoot(document.getElementById("options-root")).render(<OptionsApp/>);',
    resolveDir: process.cwd(), loader: 'tsx'
  },
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
  outfile: path.join(output, 'fixture.js'),
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'isolated-options-io',
    setup(builder) {
      builder.onResolve({ filter: /(^|\/)options-controller(\.js)?$/ }, () => ({ path: 'options', namespace: 'stub' }))
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stubs }))
    }
  }]
})
const assets = new Map(bundle.outputFiles.map(file => [`/${path.basename(file.path)}`, file.contents]))
const html = await readFile('dist/src/options/options.html', 'utf8')
const sheets = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
if (!sheets.length) throw new Error('Build the extension first')
assets.set('/production.css', (await Promise.all(sheets.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))).join('\n'))
assets.set('/assets/icon128.png', await readFile('src/assets/icon128.png'))
const bootstrap = `
window.__fixtureErrors = [];
addEventListener("error", event => window.__fixtureErrors.push(event.message));
addEventListener("unhandledrejection", event => window.__fixtureErrors.push(String(event.reason)));
const event = () => ({addListener(){},removeListener(){}});
const result = (value, callback) => { if (callback) queueMicrotask(() => callback(value)); return Promise.resolve(value); };
window.chrome = {
  runtime:{id:"isolated-motion-fixture",getURL:path=>"/"+path,onMessage:event(),sendMessage:async()=>({ok:true})},
  storage:{onChanged:event(),local:{get:(_,cb)=>result({},cb),set:(_,cb)=>result(undefined,cb)}},
  bookmarks:{onCreated:event(),onRemoved:event(),onChanged:event(),onMoved:event(),onChildrenReordered:event(),onImportEnded:event()}
};`
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  response.setHeader('cache-control', 'no-store')
  if (url.pathname === '/') {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end(`<!doctype html><html data-curator-surface="options"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/production.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="options-root"></div><script>${bootstrap}</script><script type="module" src="/fixture.js"></script></body></html>`)
    return
  }
  const asset = assets.get(url.pathname)
  response.statusCode = asset ? 200 : 404
  response.setHeader('content-type', url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.png') ? 'image/png' : 'text/javascript')
  response.end(asset || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}/`
const scriptPath = path.join(output, 'round-01.mjs')
await writeFile(scriptPath, `
const { runSidebarMotionScenarios } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/options/options-sidebar-motion-scenarios.mjs')).href)});
const task = await taskSpace(${space ?? JSON.stringify(`Curator sidebar motion ${Date.now()}`)});
const page = task.page("p1");
console.log({ spaceId: task.spaceId, page: page.label });
await page.info();
const windowInfo = await task.cdp("Browser.getWindowForTarget", { targetId: page.targetId });
if (windowInfo.bounds.windowState === "minimized") {
  await task.cdp("Browser.setWindowBounds", { windowId: windowInfo.windowId, bounds: { windowState: "normal" } });
}
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await page.goto(${JSON.stringify(base)});
await page.cdp("Page.bringToFront");
await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
await page.waitForSelector(".options-nav-link");
console.log(await page.snapshot());
const report = await runSidebarMotionScenarios(page, ${JSON.stringify(output.replaceAll('\\', '/'))});
await (await import("node:fs/promises")).writeFile(${JSON.stringify(path.join(output, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, screenshots: report.screenshots, traceFrames: Object.fromEntries(Object.entries(report.traces).map(([name, frames]) => [name, frames.length])) }));
${space ? '' : 'await task.finish({keep:[]});'}
`, 'utf8')
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
      maxBuffer: 2 ** 20, timeout: 300000, windowsHide: true
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
  console.log(`Sidebar motion report: ${path.join(output, 'report.json')}`)
}
