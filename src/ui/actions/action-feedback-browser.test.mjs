import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const spaceIndex = process.argv.indexOf('--space')
const spaceValue = spaceIndex < 0 ? process.env.CURATOR_EGO_SPACE ?? null : process.argv[spaceIndex + 1]
const existingSpace = spaceValue === null ? null : Number(spaceValue)
const fromIndex = process.argv.indexOf('--from')
const startAt = fromIndex < 0 ? 'controls' : process.argv[fromIndex + 1]
if (existingSpace !== null && (!Number.isSafeInteger(existingSpace) || existingSpace < 1)) throw new Error('Invalid --space')
const directory = path.resolve('.tmp', existingSpace ? `action-feedback-space-${existingSpace}` : `action-feedback-${Date.now()}`)
await mkdir(directory, { recursive: true })
const styles = new Map()
// Read each surface's stylesheets from its built page; Rollup's shared chunk names are not stable.
for (const surface of ['options', 'popup', 'newtab', 'sidepanel']) {
  const html = await readFile(path.resolve(`dist/src/${surface}/${surface}.html`), 'utf8').catch(() => '')
  const links = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
  if (!links.length) throw new Error(`Build the extension before testing (${surface} CSS missing).`)
  styles.set(surface, (await Promise.all(links.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))).join('\n'))
}
const bundle = await build({
  entryPoints: ['src/ui/actions/action-feedback.fixture.tsx'],
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
  outfile: path.join(directory, 'fixture.js'),
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{
    name: 'isolate-fixture-io',
    setup(build) {
      build.onResolve({ filter: /(^|\/)options-controller(\.js)?$/ }, () => ({
        path: path.resolve('src/ui/actions/action-feedback.fixture-controller.ts')
      }))
      build.onResolve({ filter: /(^|\/)(AutoBackupPoints|StorageManagement|SyncCard)(\.js)?$/ }, args => ({
        path: path.basename(args.path).replace(/\.js$/, ''), namespace: 'fixture-omitted'
      }))
      build.onLoad({ filter: /.*/, namespace: 'fixture-omitted' }, args => ({
        contents: `export function ${args.path}() { return null }`
      }))
    }
  }]
})
const responses = new Map(bundle.outputFiles.map(output => [
  `/${path.basename(output.path)}`, [output.path.endsWith('.css') ? 'text/css' : 'text/javascript', output.text]
]))
for (const [prefix, css] of styles) responses.set(`/${prefix}.css`, ['text/css', css])
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (url.pathname === '/') {
    const surface = url.searchParams.get('surface') || 'controls'
    const css = styles.has(surface) ? surface : 'options'
    response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' })
    response.end(`<!doctype html><html><head><title>Curator action checks</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;min-width:0}#root{height:100vh;overflow:auto}</style></head><body><div id="root"></div><script>window.chrome={runtime:{id:"fixture",getURL:p=>"/"+p},storage:{onChanged:{addListener(){},removeListener(){}}}};</script><script type="module" src="/fixture.js"></script></body></html>`)
    return
  }
  const found = responses.get(url.pathname)
  response.writeHead(found ? 200 : 404, { 'content-type': found?.[0] || 'text/plain', 'cache-control': 'no-store' })
  response.end(found?.[1] || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const script = `
const { runActionFeedbackChecks } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/ui/actions/action-feedback-scenarios.mjs')).href)});
const task = await taskSpace(${existingSpace ?? JSON.stringify(`Curator action checks ${Date.now()}`)});
const page = (await task.pages())[0] ?? await task.newPage();
console.log({ spaceId: task.spaceId, page: page.label });
const report = await runActionFeedbackChecks(page, "http://127.0.0.1:${server.address().port}", ${JSON.stringify(directory.replaceAll('\\', '/'))}, ${JSON.stringify(startAt)});
const fs = await import("node:fs/promises");
await fs.writeFile(${JSON.stringify(path.join(directory, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
${existingSpace ? '' : 'await task.finish({ keep: [] });'}
`
const scriptPath = path.join(directory, `round-${Date.now()}.mjs`)
await writeFile(scriptPath, script)
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
      maxBuffer: 2 ** 20, timeout: 240_000, windowsHide: true
    }, error => error ? reject(error) : resolve())
    child.stdin.end()
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  })
  console.log(`Action feedback report: ${path.join(directory, 'report.json')}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
