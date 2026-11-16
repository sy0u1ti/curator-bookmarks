import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// Read the Ego skill first. Runs the production sync card with an in-page sync service
// in an agent-owned Ego workspace; `-- --space <id>` reuses one and leaves it open.
const spaceIndex = process.argv.indexOf('--space')
const spaceValue = spaceIndex < 0 ? process.env.CURATOR_EGO_SPACE ?? null : process.argv[spaceIndex + 1]
const space = spaceValue === null ? null : Number(spaceValue)
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const directory = path.resolve('.tmp', `sync-ui-${Date.now()}`)
await mkdir(directory, { recursive: true })

const html = await readFile('dist/src/options/options.html', 'utf8')
const styles = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
if (!styles.length) throw new Error('Build the extension before running the sync interface checks')
const css = (await Promise.all(styles.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))).join('\n')
const bundle = await build({
  entryPoints: { fixture: 'src/options/sync-ui.fixture.tsx' },
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', outdir: directory,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'production-styles',
    // The production bundle supplies global styles, including compiled Tailwind.
    setup: builder => builder.onLoad({ filter: /[\\/]styles[\\/]globals\.css$/ }, () => ({ contents: '', loader: 'css' }))
  }]
})
const responses = new Map([['/production.css', ['text/css', css]]])
for (const file of bundle.outputFiles) {
  responses.set(`/${path.basename(file.path)}`, [file.path.endsWith('.css') ? 'text/css' : 'text/javascript', file.text])
}
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(`<!doctype html><html lang="zh-CN" data-curator-surface="options"><head><title>Curator sync interface</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/production.css">${responses.has('/fixture.css') ? '<link rel="stylesheet" href="/fixture.css">' : ''}<style>body{margin:0;min-width:0}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`)
    return
  }
  const value = responses.get(url.pathname)
  response.writeHead(value ? 200 : 404, { 'content-type': `${value?.[0] || 'text/plain'}; charset=utf-8`, 'cache-control': 'no-store' })
  response.end(value?.[1] || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

const script = `
const { runSyncInterfaceChecks } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/options/sync-ui-scenarios.mjs')).href)});
const task = await taskSpace(${space ?? JSON.stringify(`Curator sync interface ${Date.now()}`)});
const page = (await task.pages())[0] ?? await task.newPage();
console.log({ spaceId: task.spaceId, page: page.label });
await page.info();
const windowInfo = await task.cdp("Browser.getWindowForTarget", { targetId: page.targetId });
if (windowInfo.bounds.windowState === "minimized") {
  await task.cdp("Browser.setWindowBounds", { windowId: windowInfo.windowId, bounds: { windowState: "normal" } });
}
const report = await runSyncInterfaceChecks(page, "http://127.0.0.1:${server.address().port}/", ${JSON.stringify(directory.replaceAll('\\', '/'))});
await (await import("node:fs/promises")).writeFile(${JSON.stringify(path.join(directory, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks, failures: report.failures, screenshots: report.screenshots.length }));
if (report.failures.length) throw new Error("Sync interface regression(s); see report.json");
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
  console.log(`Sync interface report: ${path.join(directory, 'report.json')}`)
}
