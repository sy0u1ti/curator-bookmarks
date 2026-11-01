import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null
const space = option('--space') ? Number(option('--space')) : null
const pageLabel = option('--page') || 'p1'
const durationMs = Number(option('--duration') || 10000)
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
if (!/^p\d+$/.test(pageLabel)) throw new Error('Invalid --page')
if (!Number.isFinite(durationMs) || durationMs < 2000 || durationMs > 60000) throw new Error('Invalid --duration (2000..60000ms)')
const directory = path.resolve(option('--output') || `.tmp/popup-production-navigation-${Date.now()}`)
await mkdir(directory, { recursive: true })
const bundle = await build({
  entryPoints: ['src/popup/popup-production-navigation.fixture.tsx'],
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', outdir: directory,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'compiled-production-css', setup(builder) {
    builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'css' }))
  } }]
})
const files = new Map(bundle.outputFiles.map(file => [`/${path.basename(file.path)}`, [
  file.path.endsWith('.css') ? 'text/css' : 'text/javascript', file.text
]]))
const html = await readFile('dist/src/popup/popup.html', 'utf8')
const critical = html.match(/<style id="popup-critical-size">([\s\S]*?)<\/style>/)?.[1] || ''
for (const surface of ['popup', 'sidepanel']) {
  const entry = await readFile(`dist/src/${surface}/${surface}.html`, 'utf8')
  const links = [...entry.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, link]) => link)
  files.set(`/${surface}.css`, ['text/css', (await Promise.all(links.map(link =>
    readFile(path.join('dist', link.replace(/^\/+/, '')), 'utf8')
  ))).join('\n')])
}
files.set('/io.js', ['text/javascript', await readFile('src/popup/popup-production-navigation-io.mjs', 'utf8')])
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (url.pathname === '/') {
    const surface = url.searchParams.get('surface') === 'sidepanel' ? 'sidepanel' : 'popup'
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(`<!doctype html><html lang="en" data-curator-surface="${surface}"><head>
      <title>Curator production navigation</title><meta name="viewport" content="width=device-width,initial-scale=1">
      <base href="${origin}/?${url.searchParams.toString()}">
      <style>${critical}</style><link rel="stylesheet" href="/${surface}.css">
      <style>html,body,#popup-root{height:100dvh;width:100vw;min-width:0;max-width:none}</style>
      </head><body><div id="popup-root"></div><script>
      window.__errors=[];window.__commits=0;
      addEventListener('error', e => window.__errors.push(e.message));
      addEventListener('unhandledrejection', e => window.__errors.push(String(e.reason)));
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,inject:()=>1,checkDCE(){},onCommitFiberUnmount(){},onCommitFiberRoot(){window.__commits++}};
      </script><script type="module">import '/io.js';import '/popup-production-navigation.fixture.js';</script></body></html>`)
    return
  }
  let found = files.get(url.pathname)
  if (!found && (/^\/(?:src\/)?assets\/icon(?:16|24|32|48|128)\.png$/.test(url.pathname) || url.pathname.startsWith('/_favicon'))) {
    found = ['image/png', await readFile(url.pathname.startsWith('/_favicon')
      ? 'dist/src/assets/icon128.png' : path.join('dist/src/assets', path.posix.basename(url.pathname)))]
  }
  response.writeHead(found ? 200 : 404, { 'content-type': found?.[0] || 'text/plain', 'cache-control': 'no-store' })
  response.end(found?.[1] || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
await writeFile(path.join(directory, 'server.json'), JSON.stringify({ origin, pid: process.pid }))
console.log(JSON.stringify({ origin, directory, pid: process.pid }))
if (!process.argv.includes('--serve')) {
  const frames = process.argv.includes('--frames')
  const scenario = pathToFileURL(path.resolve(frames
    ? 'src/popup/popup-frame-budget-scenarios.mjs' : 'src/popup/popup-production-navigation-scenarios.mjs')).href
  const scriptPath = path.join(directory, 'round-01.mjs')
  await writeFile(scriptPath, `
const task = await taskSpace(${space || JSON.stringify(`Curator production navigation ${Date.now()}`)});
const page = task.page(${JSON.stringify(pageLabel)});
console.log({ spaceId: task.spaceId, page: page.label });
const { ${frames ? 'runPopupFrameBudgetChecks' : 'runProductionNavigationChecks'}: run } = await import(${JSON.stringify(scenario)});
await run(page, ${JSON.stringify(origin)}, ${JSON.stringify(directory.replaceAll('\\', '/'))}, {
  durationMs: ${durationMs}, isolated: ${process.argv.includes('--isolated')},
  capture: ${process.argv.includes('--capture')}, requireZero: ${process.argv.includes('--require-zero')}
});
${space ? '' : 'await task.finish({ keep: [] });'}
`)
  const executable = process.platform === 'win32'
    ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser'
  try {
    await new Promise((resolve, reject) => {
      const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
        timeout: 360000, maxBuffer: 2 ** 20, windowsHide: true
      }, error => error ? reject(error) : resolve())
      child.stdin.end()
      child.stdout.pipe(process.stdout)
      child.stderr.pipe(process.stderr)
    })
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}
