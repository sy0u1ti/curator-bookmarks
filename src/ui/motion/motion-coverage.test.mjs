import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// Run the real shared primitives and compiled production CSS through Ego.
// --space resumes an existing QA task; standalone runs clean up their own space.
const spaceIndex = process.argv.indexOf('--space')
const existingSpace = spaceIndex < 0 ? null : Number(process.argv[spaceIndex + 1])
const pageIndex = process.argv.indexOf('--page')
const existingPage = pageIndex < 0 ? null : process.argv[pageIndex + 1]
if (spaceIndex >= 0 && (!Number.isSafeInteger(existingSpace) || existingSpace <= 0)) {
  throw new Error('--space requires the numeric ID of an existing Ego task space.')
}
if (pageIndex >= 0 && (!existingSpace || !/^p[1-9]\d*$/.test(existingPage ?? ''))) {
  throw new Error('--page requires --space and an existing page label, such as p1.')
}
const directory = path.resolve('.tmp', `motion-coverage-${Date.now()}`)
await mkdir(directory, { recursive: true })
const assets = await readdir(path.resolve('dist/assets'))
const stylesheet = assets.find(name => /^ThemeProvider-.*\.css$/.test(name))
const optionsStyle = assets.find(name => /^options-.*\.css$/.test(name))
if (!stylesheet || !optionsStyle) throw new Error('Run npm run build before the motion coverage checks.')
const bundle = await build({
  entryPoints: ['src/ui/motion/motion-coverage.fixture.tsx'],
  bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic',
  outfile: path.join(directory, 'fixture.js'),
  define: { 'process.env.NODE_ENV': '"production"' }
})
const responses = new Map([
  ['/', ['text/html', '<!doctype html><html><head><title>Curator motion fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/shared.css"><link rel="stylesheet" href="/options.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>']],
  ['/shared.css', ['text/css', await readFile(path.resolve('dist/assets', stylesheet))]],
  ['/options.css', ['text/css', await readFile(path.resolve('dist/assets', optionsStyle))]]
])
for (const output of bundle.outputFiles) {
  responses.set(`/${path.basename(output.path)}`, [output.path.endsWith('.css') ? 'text/css' : 'text/javascript', output.text])
}
const server = createServer((request, response) => {
  const found = responses.get(request.url)
  response.writeHead(found ? 200 : 404, { 'content-type': found?.[0] || 'text/plain', 'cache-control': 'no-store' })
  response.end(found?.[1] || 'Not found')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const scenariosUrl = pathToFileURL(path.resolve('src/ui/motion/motion-coverage-scenarios.mjs')).href
const script = `
const { runMotionCoverage } = await import(${JSON.stringify(scenariosUrl)});
const task = await taskSpace(${existingSpace ?? JSON.stringify(`Curator motion checks ${Date.now()}`)});
const page = ${existingPage ? `task.page(${JSON.stringify(existingPage)})` : existingSpace ? 'await task.newPage()' : 'task.page("p1")'};
console.log({ spaceId: task.spaceId, page: page.label });
await page.goto("http://127.0.0.1:${server.address().port}/");
await page.waitForSelector("#motion-button");
console.log(await page.snapshot());
const report = await runMotionCoverage(page);
console.log(JSON.stringify(report, null, 2));
const fs = await import("node:fs/promises");
await fs.writeFile(${JSON.stringify(path.join(directory, 'report.json'))}, JSON.stringify(report, null, 2));
${existingSpace ? 'await page.close();' : 'await task.finish({ keep: [] });'}
`
const scriptPath = path.join(directory, 'run.mjs')
await writeFile(scriptPath, script)
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe')
  : 'ego-browser')
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
      maxBuffer: 2 ** 20,
      timeout: 180_000,
      windowsHide: true
    }, error => error ? reject(error) : resolve())
    child.stdin.end()
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  })
  console.log(`Motion coverage report: ${path.join(directory, 'report.json')}`)
} catch (error) {
  console.error(error.killed
    ? 'Ego motion checks exceeded 180 seconds. Inspect the existing task space before continuing.'
    : error.message)
  process.exitCode = 1
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
