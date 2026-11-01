import { build } from 'esbuild'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Read the Ego skill before running. --serve leaves an isolated fixture up for
// profiling; normal runs exercise production CSS without touching Chrome I/O.
const option = name => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const space = option('--space') ? Number(option('--space')) : null
if (space !== null && (!Number.isSafeInteger(space) || space <= 0)) throw new Error('Invalid --space')
const directory = path.resolve(option('--output') || `.tmp/popup-repeat-${Date.now()}`)
await mkdir(directory, { recursive: true })
const before = option('--before')
const responses = new Map()
for (const variant of before ? ['before', 'after'] : ['after']) {
  const result = await build({
    entryPoints: ['src/popup/popup-repeat-navigation.fixture.tsx'],
    bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
    outdir: directory, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: variant === 'before' ? [{
      name: 'saved-popup-baseline',
      setup(builder) {
        builder.onLoad({ filter: /(?:PopupContentHost\.tsx|PopupContent\.tsx|popup-active-result-scroll\.ts)$/ }, async args => ({
          contents: await readFile(path.join(before, path.relative(process.cwd(), args.path)), 'utf8'),
          resolveDir: path.dirname(args.path), loader: args.path.endsWith('tsx') ? 'tsx' : 'ts'
        }))
      }
    }] : []
  })
  for (const file of result.outputFiles) {
    responses.set(`/${variant}/${path.extname(file.path).slice(1)}`, [
      file.path.endsWith('.css') ? 'text/css' : 'text/javascript', file.text
    ])
  }
}
for (const surface of ['popup', 'sidepanel']) {
  const html = await readFile(`dist/src/${surface}/${surface}.html`, 'utf8')
  const links = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, link]) => link)
  const css = (await Promise.all(links.map(link => readFile(path.join('dist', link.replace(/^\/+/, '')), 'utf8')))).join('\n')
  responses.set(`/${surface}.css`, ['text/css', css])
}
const bootstrap = `
window.__errors = []; window.__commits = 0;
addEventListener("error", e => window.__errors.push(e.message));
addEventListener("unhandledrejection", e => window.__errors.push(String(e.reason)));
window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  supportsFiber: true, inject: () => 1, checkDCE() {}, onCommitFiberUnmount() {},
  onCommitFiberRoot() { window.__commits++; }
};
`;
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (url.pathname === '/') {
    const surface = url.searchParams.get('surface') === 'sidepanel' ? 'sidepanel' : 'popup'
    const variant = before && url.searchParams.has('before') ? 'before' : 'after'
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(`<!doctype html><html><head><title>Curator held-key scrolling</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="/${surface}.css"><link rel="stylesheet" href="/${variant}/css">
      <style>html,body,#popup-root,#popup-root>.curator-react-root{height:100%;min-height:0;margin:0;overflow:hidden}
      body{min-width:0}#popup-root{isolation:isolate}</style>
      </head><body><div id="popup-root" data-popup-ready="true"></div>
      <script>${bootstrap}</script><script type="module" src="/${variant}/js"></script></body></html>`)
    return
  }
  const found = responses.get(url.pathname)
  response.writeHead(found ? 200 : 404, { 'content-type': found?.[0] || 'text/plain' })
  response.end(found?.[1] || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
await writeFile(path.join(directory, 'server.json'), JSON.stringify({ origin, pid: process.pid }))
console.log(JSON.stringify({ origin, directory, pid: process.pid }))
if (!process.argv.includes('--serve')) {
  const scenario = pathToFileURL(path.resolve('src/popup/popup-repeat-navigation-scenarios.mjs')).href
  const script = `
const task = await taskSpace(${space || JSON.stringify(`Curator held-key checks ${Date.now()}`)});
const page = task.page("p1");
console.log({ spaceId: task.spaceId, page: page.label });
const { runPopupRepeatChecks } = await import(${JSON.stringify(scenario)});
const report = await runPopupRepeatChecks(page, ${JSON.stringify(origin)}, ${JSON.stringify(directory.replaceAll('\\', '/'))});
console.log(JSON.stringify(report));
${space ? '' : 'await task.finish({ keep: [] });'}
`
  const scriptPath = path.join(directory, 'round-01.mjs')
  await writeFile(scriptPath, script)
  const executable = process.platform === 'win32'
    ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser'
  try {
    await new Promise((resolve, reject) => {
      const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
        timeout: 300000, maxBuffer: 2 ** 20, windowsHide: true
      }, error => error ? reject(error) : resolve())
      child.stdin.end(); child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr)
    })
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}
