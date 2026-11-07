import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null
const space = option('--space') === null ? null : Number(option('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const directory = path.resolve(option('--output') || `.tmp/newtab-search-expansion-${Date.now()}`)
await mkdir(directory, { recursive: true })
const root = path.resolve('dist')
const io = await readFile('src/newtab/glass-browser-fixture.mjs', 'utf8')
const html = (await readFile('dist/src/newtab/newtab.html', 'utf8')).replace('<head>', `<head><script>${io}</script>`)
const icon = await readFile('dist/src/assets/icon128.png')
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  response.setHeader('cache-control', 'no-store')
  if (url.pathname === '/src/newtab/newtab.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(html)
    return
  }
  if (url.pathname === '/wallpaper.svg') {
    response.writeHead(200, { 'content-type': 'image/svg+xml' })
    response.end('<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000"><rect width="1440" height="1000" fill="#272b32"/></svg>')
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
if (!process.argv.includes('--serve')) {
  const script = path.join(directory, 'round-01.mjs')
  await writeFile(script, `
const task=await taskSpace(${space ?? JSON.stringify(`Curator search expansion ${Date.now()}`)});
const page=task.page('p1');
console.log({spaceId:task.spaceId,page:page.label});
await page.info();
const ownerWindow=await task.cdp('Browser.getWindowForTarget',{targetId:page.targetId});
if(ownerWindow.bounds.windowState==='minimized')await task.cdp('Browser.setWindowBounds',{windowId:ownerWindow.windowId,bounds:{windowState:'normal'}});
const {runSearchExpansionChecks}=await import(${JSON.stringify(pathToFileURL(path.resolve('src/newtab/newtab-search-expansion-scenarios.mjs')).href)});
const report=await runSearchExpansionChecks(page,${JSON.stringify(origin)},${JSON.stringify(directory.replaceAll('\\', '/'))});
await (await import('node:fs/promises')).writeFile(${JSON.stringify(path.join(directory, 'report.json'))},JSON.stringify(report,null,2));
console.log(JSON.stringify({checks:report.checks.length,failures:report.failures,measurements:report.measurements}));
${process.argv.includes('--record-only') ? '' : "if(report.failures.length)throw new Error('Search expansion regression(s); see report.json');"}
${space === null ? "await task.finish({keep:[]});" : ''}
`, 'utf8')
  const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
  try {
    await new Promise((resolve, reject) => {
      const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(script).href}')`], {
        windowsHide: true, timeout: 180000, maxBuffer: 2 ** 20
      }, error => error ? reject(error) : resolve())
      child.stdin.end()
      child.stdout.pipe(process.stdout)
      child.stderr.pipe(process.stderr)
    })
  } catch (error) {
    console.error(`Search expansion checks failed: ${error.code || error.message}; see ${path.join(directory, 'report.json')}`)
    process.exitCode = 1
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}
