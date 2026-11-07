import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null
const space = option('--space') === null ? null : Number(option('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const directory = path.resolve(option('--output') || `.tmp/popup-activity-${Date.now()}`)
await mkdir(directory, { recursive: true })
const root = path.resolve('dist')
const io = await readFile('src/popup/popup-activity-io.fixture.mjs', 'utf8')
const pages = new Map(await Promise.all(['popup', 'sidepanel'].map(async name => [
  `/src/${name}/${name}.html`,
  (await readFile(`dist/src/${name}/${name}.html`, 'utf8')).replace('<head>', `<head><script>${io}</script>`)
])))
const icon = await readFile('dist/src/assets/icon128.png')
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  response.setHeader('cache-control', 'no-store')
  if (pages.has(url.pathname)) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(pages.get(url.pathname))
    return
  }
  if (url.pathname.startsWith('/_favicon/')) {
    response.writeHead(200, { 'content-type': 'image/png' })
    response.end(icon)
    return
  }
  const filename = path.resolve(root, url.pathname.replace(/^\/+/, ''))
  let contents
  if (filename.startsWith(root + path.sep)) {
    try { contents = await readFile(filename) } catch {}
  }
  const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' }
  response.writeHead(contents ? 200 : 404, { 'content-type': types[path.extname(filename)] || 'application/octet-stream' })
  response.end(contents || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
console.log(JSON.stringify({ origin, directory, pid: process.pid }))
await writeFile(path.join(directory, 'server.json'), JSON.stringify({ origin, pid: process.pid }))
if (!process.argv.includes('--serve')) {
  const script = path.join(directory, `round-${Date.now()}.mjs`)
  await writeFile(script, `
const task=await taskSpace(${space ?? JSON.stringify(`Curator activity ${Date.now()}`)});
const page=task.page('p1');
console.log({spaceId:task.spaceId,page:page.label});
const {runPopupActivityChecks}=await import(${JSON.stringify(pathToFileURL(path.resolve('src/popup/popup-activity-scenarios.mjs')).href)});
const report=await runPopupActivityChecks(page,${JSON.stringify(origin)},${JSON.stringify(directory.replaceAll('\\', '/'))},${JSON.stringify({ cases: option('--cases')?.split(',') })});
await (await import('node:fs/promises')).writeFile(${JSON.stringify(path.join(directory, 'report.json'))},JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
if(report.failures.length)throw new Error('Popup activity checks failed; see report.json');
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
    console.error(`Activity checks failed: ${error.code || error.message}`)
    process.exitCode = 1
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}
