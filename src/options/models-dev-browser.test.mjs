import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const spaceIndex = process.argv.indexOf('--space')
const space = spaceIndex < 0 ? null : Number(process.argv[spaceIndex + 1])
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const keepSpace = process.argv.includes('--keep-space')
const directory = path.resolve('.tmp', `models-dev-browser-${Date.now()}`)
await mkdir(directory, { recursive: true })
const assets = await readdir(path.resolve('dist/assets'))
const responses = new Map()
for (const prefix of ['ThemeProvider', 'options']) {
  const file = assets.find(name => name.startsWith(`${prefix}-`) && name.endsWith('.css'))
  if (!file) throw new Error('Build the extension before running models.dev UI checks.')
  responses.set(`/${prefix}.css`, ['text/css', await readFile(path.resolve('dist/assets', file))])
}
const bundle = await build({
  entryPoints: ['src/options/models-dev.fixture.tsx'], bundle: true, write: false,
  format: 'esm', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'),
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'isolated-controller',
    setup(build) {
      build.onResolve({ filter: /(^|\/)options-controller(\.js)?$/ }, () => ({
        path: path.resolve('src/ui/actions/action-feedback.fixture-controller.ts')
      }))
    }
  }]
})
for (const file of bundle.outputFiles) responses.set(`/${path.basename(file.path)}`, [file.path.endsWith('.css') ? 'text/css' : 'text/javascript', file.text])
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (url.pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' })
    // Production options scrolls inside its shell; body intentionally hides overflow.
    response.end('<!doctype html><html><head><title>Curator models.dev checks</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ThemeProvider.css"><link rel="stylesheet" href="/options.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;min-width:0}#root{height:100vh;min-height:0;overflow-y:auto}</style></head><body><div id="root"></div><script>window.chrome={runtime:{id:"isolated-ui-fixture",getURL:p=>"/"+p},storage:{onChanged:{addListener(){},removeListener(){}}}};</script><script type="module" src="/fixture.js"></script></body></html>')
    return
  }
  const value = responses.get(url.pathname)
  response.writeHead(value ? 200 : 404, { 'content-type': value?.[0] || 'text/plain', 'cache-control': 'no-store' })
  response.end(value?.[1] || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const script = `
const { runModelsDevBrowserChecks } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/options/models-dev-browser-scenarios.mjs')).href)});
const task = await taskSpace(${space ?? JSON.stringify(`Curator models.dev checks ${Date.now()}`)});
const page = task.page("p1");
console.log({ spaceId: task.spaceId, page: page.label });
const report = await runModelsDevBrowserChecks(page, "http://127.0.0.1:${server.address().port}", ${JSON.stringify(directory.replaceAll('\\', '/'))});
const fs = await import("node:fs/promises");
await fs.writeFile(${JSON.stringify(path.join(directory, 'results.json').replaceAll('\\', '/'))}, JSON.stringify(report, null, 2));
console.log(report);
${keepSpace ? '' : 'await task.finish({ keep: [] });'}
`
const scriptPath = path.join(directory, 'round-01.mjs')
await writeFile(scriptPath, script, 'utf8')
const executable = process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser'
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], { maxBuffer: 4 * 1024 * 1024, timeout: 180000, windowsHide: true }, (error) => {
      if (error) reject(error)
      else resolve()
    })
    child.stdin.end()
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  })
  console.log(`models.dev browser checks passed. Artifacts: ${directory}`)
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
