import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// Read the Ego skill before running. An existing --space belongs to the caller;
// standalone runs finish only their own space. No real bookmarks are accessed.
const index = process.argv.indexOf('--space')
const space = index < 0 ? null : Number(process.argv[index + 1])
const pageIndex = process.argv.indexOf('--page')
const existingPage = pageIndex < 0 ? null : process.argv[pageIndex + 1]
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
if (pageIndex >= 0 && (!space || !/^p[1-9]\d*$/.test(existingPage ?? ''))) throw new Error('--page requires --space and an existing page label')
const directory = path.resolve('.tmp', `corner-geometry-${Date.now()}`)
await mkdir(directory, { recursive: true })
const html = await readFile('dist/src/options/options.html', 'utf8')
const styles = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
if (!styles.length) throw new Error('Build the extension before testing its production CSS')
const css = (await Promise.all(styles.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))).join('\n')
const bundle = await build({
  entryPoints: ['src/styles/corners.fixture.tsx'], bundle: true, write: false,
  format: 'esm', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'),
  define: { 'process.env.NODE_ENV': '"production"' }
})
const responses = new Map([
  ['/', ['text/html', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Curator corner geometry</title><link rel="stylesheet" href="/production.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>']],
  ['/production.css', ['text/css', css]],
  ['/favicon.svg', ['image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="#ddd" d="M0 0h32v32H0z"/><path fill="#333" d="M8 8h12v4h-8v12H8z"/></svg>']]
])
for (const output of bundle.outputFiles) {
  responses.set(`/${path.basename(output.path)}`, [output.path.endsWith('.css') ? 'text/css' : 'text/javascript', output.text])
}
const server = createServer((request, response) => {
  const found = responses.get(request.url)
  response.writeHead(found ? 200 : 404, { 'content-type': `${found?.[0] || 'text/plain'}; charset=utf-8`, 'cache-control': 'no-store' })
  response.end(found?.[1] || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const script = `
const { runCornerGeometryChecks } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/styles/corners-scenarios.mjs')).href)});
const task = await taskSpace(${space ?? JSON.stringify(`Curator corner geometry ${Date.now()}`)});
const page = ${existingPage ? `task.page(${JSON.stringify(existingPage)})` : space ? 'await task.newPage()' : 'task.page("p1")'};
console.log({ spaceId: task.spaceId, page: page.label });
await page.goto("http://127.0.0.1:${server.address().port}/");
console.log(await page.snapshot());
const report = await runCornerGeometryChecks(page, "http://127.0.0.1:${server.address().port}", ${JSON.stringify(directory.replaceAll('\\', '/'))});
await (await import("node:fs/promises")).writeFile(${JSON.stringify(path.join(directory, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
${space ? 'await page.close();' : 'await task.finish({ keep: [] });'}
`
const scriptPath = path.join(directory, 'round-01.mjs')
await writeFile(scriptPath, script)
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
      maxBuffer: 2 ** 20, timeout: 180_000, windowsHide: true
    }, error => error ? reject(error) : resolve())
    child.stdin.end()
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  })
  console.log(`Corner geometry report: ${path.join(directory, 'report.json')}`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
