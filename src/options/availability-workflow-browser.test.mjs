import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const arg = name => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const space = arg('--space') === null ? null : Number(arg('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw Error('Invalid --space')
const pageLabel = arg('--page') || 'p1'
const output = path.resolve('.tmp', 'availability-workflow-' + Date.now())
await mkdir(output, { recursive: true })
const bundle = await build({
  entryPoints: ['src/options/availability-workflow.fixture.tsx'], bundle: true, write: false,
  platform: 'browser', format: 'esm', jsx: 'automatic', outfile: path.join(output, 'fixture.js'),
  define: { 'process.env.NODE_ENV': '"production"' }
})
const assets = new Map(bundle.outputFiles.map(file => ['/' + path.basename(file.path), file.contents]))
const html = await readFile('dist/src/options/options.html', 'utf8')
const styles = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
assets.set('/production.css', (await Promise.all(styles.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))).join('\n'))
assets.set('/io.js', await readFile('src/options/availability-workflow-io.fixture.mjs'))
assets.set('/src/assets/icon128.png', await readFile('src/assets/icon128.png'))
assets.set('/assets/icon128.png', await readFile('src/assets/icon128.png'))
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  response.setHeader('cache-control', 'no-store')
  if (url.pathname === '/') {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html data-curator-surface="options"><head><meta charset="utf-8"><title>Curator availability workflow QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/production.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="options-root"></div><script src="/io.js"></script><script type="module" src="/fixture.js"></script></body></html>')
    return
  }
  const asset = assets.get(url.pathname)
  response.statusCode = asset ? 200 : 404
  response.setHeader('content-type', url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.png') ? 'image/png' : 'text/javascript')
  response.end(asset || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const script = path.join(output, 'round-01.mjs')
await writeFile(script, `
const { runAvailabilityWorkflowScenarios } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/options/availability-workflow-scenarios.mjs')).href)});
const task = await taskSpace(${space ?? JSON.stringify('Curator availability workflow ' + Date.now())});
const page = task.page(${JSON.stringify(pageLabel)});
const report = await runAvailabilityWorkflowScenarios(page, "http://127.0.0.1:${server.address().port}/#availability", ${JSON.stringify(output.replaceAll('\\', '/'))});
await (await import("node:fs/promises")).writeFile(${JSON.stringify(path.join(output, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(report);
${space ? '' : 'await task.finish({keep:[]});'}
`, 'utf8')
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(script).href}')`],
      { maxBuffer: 2 ** 20, timeout: 360000, windowsHide: true }, error => error ? reject(error) : resolve())
    child.stdin.end()
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  })
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  console.log('Availability workflow report: ' + path.join(output, 'report.json'))
}
