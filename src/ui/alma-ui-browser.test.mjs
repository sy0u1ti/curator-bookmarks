import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null
const scenario = option('--scenario') || 'alma'
if (!['alma', 'sliders'].includes(scenario)) throw new Error('Invalid --scenario')
const scenarioFile = scenario === 'sliders' ? 'src/ui/base/slider-weight-scenarios.mjs' : 'src/ui/alma-ui-scenarios.mjs'
const scenarioFunction = scenario === 'sliders' ? 'runSliderWeightChecks' : 'runAlmaUiChecks'
const space = option('--space') === null ? null : Number(option('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const directory = path.resolve(option('--output') || `.tmp/alma-ui-${Date.now()}`)
await mkdir(directory, { recursive: true })
const source = await readFile('src/options/options-controller.ts', 'utf8')
const stubs = [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(([, name]) =>
  `export function ${name}(...args) { ${name.startsWith('handle') && name !== 'handleOptionsWindowSectionChange' ? `
    const hideSecret=${JSON.stringify(name)}==='handleAiProviderSettingsAction' && args[0]?.action==='toggle-api-key' && args[0]?.value===false;
    if(!hideSecret){window.__almaUi.mutations++;window.__almaUi.actions.push({name:${JSON.stringify(name)},action:args[0]?.action});}
  ` : ''} }`
).join('\n')
const result = await build({
  entryPoints: { fixture: 'src/ui/alma-ui.fixture.tsx' }, bundle: true, write: false, format: 'esm',
  splitting: true, platform: 'browser', jsx: 'automatic', outdir: directory,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'isolated-options-io', setup(builder) {
    builder.onResolve({ filter: /(^|\/)options-controller(\.js)?$/ }, () => ({ path: 'controller', namespace: 'stub' }))
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stubs }))
  } }]
})
const files = new Map(result.outputFiles.map(file => [`/${path.basename(file.path)}`, file.contents]))
const html = await readFile('dist/src/options/options.html', 'utf8')
const sheets = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
files.set('/production.css', (await Promise.all(sheets.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))).join('\n'))
files.set('/assets/icon128.png', await readFile('src/assets/icon128.png'))
const newtabIo = await readFile('src/newtab/glass-browser-fixture.mjs', 'utf8')
files.set('/src/newtab/newtab.html', (await readFile('dist/src/newtab/newtab.html', 'utf8'))
  .replace('<head>', `<head><script>${newtabIo}</script>`))
files.set('/wallpaper.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><rect width="1440" height="1000" fill="#20232a"/></svg>')
const distRoot = path.resolve('dist')
const bootstrap = `
window.__fixtureErrors=[];
addEventListener('error',event=>window.__fixtureErrors.push(event.message));
addEventListener('unhandledrejection',event=>window.__fixtureErrors.push(String(event.reason)));
const event=()=>({addListener(){},removeListener(){}});
const result=(value,cb)=>{if(cb)queueMicrotask(()=>cb(value));return Promise.resolve(value)};
window.chrome={
runtime:{id:'curator-alma-fixture',getURL:value=>'/'+value,onMessage:event(),sendMessage:async()=>({ok:true})},
storage:{onChanged:event(),local:{get:(_,cb)=>result({},cb),set:(_,cb)=>result(undefined,cb),getBytesInUse:(_,cb)=>result(0,cb)}},
permissions:{contains:async()=>false,request:async()=>false},
bookmarks:{getTree:cb=>result([],cb),onCreated:event(),onRemoved:event(),onChanged:event(),onMoved:event(),onChildrenReordered:event(),onImportEnded:event()},
commands:{getAll:cb=>result([],cb)},tabs:{query:(_,cb)=>result([],cb)}
};`
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  response.setHeader('cache-control', 'no-store')
  if (url.pathname === '/') {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end(`<!doctype html><html lang="zh-CN" data-curator-surface="options"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Curator UI regression</title><link rel="stylesheet" href="/production.css"><link rel="stylesheet" href="/fixture.css"><style>html,body,#options-root{min-height:100%;margin:0}html[data-fixture="controls"],html[data-fixture="controls"] body{overflow:auto}</style></head><body><div id="options-root"></div><script>${bootstrap}document.documentElement.dataset.fixture=new URLSearchParams(location.search).get('surface')||'options';</script><script type="module" src="/fixture.js"></script></body></html>`)
    return
  }
  let file = files.get(url.pathname)
  if (!file && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/src/assets/') ||
    ['/newtab-bookmark-preboot.js', '/instant-wallpaper-boot.js'].includes(url.pathname))) {
    const filename = path.resolve(distRoot, url.pathname.replace(/^\/+/, ''))
    if (filename.startsWith(distRoot + path.sep)) {
      try { file = await readFile(filename) } catch {}
    }
  }
  if (url.pathname.startsWith('/_favicon/')) file = files.get('/assets/icon128.png')
  const type = url.pathname.endsWith('.html') ? 'text/html; charset=utf-8' : url.pathname.endsWith('.svg') ? 'image/svg+xml' :
    url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.png') || url.pathname.startsWith('/_favicon/') ? 'image/png' : 'text/javascript'
  response.writeHead(file ? 200 : 404, { 'content-type': type })
  response.end(file || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
console.log(JSON.stringify({ origin, directory, pid: process.pid }))
await writeFile(path.join(directory, 'server.json'), JSON.stringify({ origin, pid: process.pid }))
if (!process.argv.includes('--serve')) {
  const script = path.join(directory, 'round-01.mjs')
  await writeFile(script, `
const task=await taskSpace(${space ?? JSON.stringify(`Curator Alma UI ${Date.now()}`)});
const page=task.page('p1');
console.log({spaceId:task.spaceId,page:page.label});
await page.info();
const ownerWindow=await task.cdp('Browser.getWindowForTarget',{targetId:page.targetId});
if(ownerWindow.bounds.windowState==='minimized')await task.cdp('Browser.setWindowBounds',{windowId:ownerWindow.windowId,bounds:{windowState:'normal'}});
const {${scenarioFunction}:runChecks}=await import(${JSON.stringify(pathToFileURL(path.resolve(scenarioFile)).href)});
const report=await runChecks(page,${JSON.stringify(origin)},${JSON.stringify(directory.replaceAll('\\', '/'))});
await (await import('node:fs/promises')).writeFile(${JSON.stringify(path.join(directory, 'report.json'))},JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:report.checks.length,failures:report.failures,screenshots:report.screenshots}));
if(report.failures.length)throw new Error('Alma UI regression(s); see report.json');
${space === null ? "await task.finish({keep:[]});" : ''}
`, 'utf8')
  const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
  try {
    await new Promise((resolve, reject) => {
      const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(script).href}')`], {
        windowsHide: true, timeout: 480000, maxBuffer: 2 ** 20
      }, error => error ? reject(error) : resolve())
      child.stdin.end()
      child.stdout.pipe(process.stdout)
      child.stderr.pipe(process.stderr)
    })
  } catch (error) {
    console.error(`Alma UI checks failed: ${error.code || error.message}; see ${path.join(directory, 'report.json')}`)
    process.exitCode = 1
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}
