import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const argument = name => {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}
const root = path.resolve('dist')
const directory = path.resolve(argument('--output') || `.tmp/glass-surface-browser-${Date.now()}`)
await mkdir(directory, { recursive: true })
const fixture = await readFile('src/newtab/glass-browser-fixture.mjs', 'utf8')
await readFile(path.join(root, 'src/newtab/newtab.html'))
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const wallpaper = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1000">
  <defs><linearGradient id="sky" x2="1" y2="1"><stop stop-color="#0b182b"/><stop offset=".55" stop-color="#3f5266"/><stop offset="1" stop-color="#c4c7c9"/></linearGradient><pattern id="lines" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M-12 12L36 60M12-12L60 36" stroke="#fff" stroke-opacity=".12" stroke-width="8"/></pattern></defs>
  <rect width="1440" height="1000" fill="url(#sky)"/><rect width="1440" height="1000" fill="url(#lines)"/>
  <circle cx="1160" cy="150" r="290" fill="#e6e1d9" opacity=".38"/>
</svg>`
const favicon = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="2" y="2" width="28" height="28" rx="6" fill="#94a3b8"/><path d="M10 8h12v16l-6-4-6 4z" fill="#172132"/></svg>'
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1')
    const send = (type, body) => {
      response.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' })
      response.end(body)
    }
    if (url.pathname === '/glass-fixture.js') return send('text/javascript', fixture)
    if (url.pathname === '/wallpaper.svg') return send('image/svg+xml', wallpaper)
    if (url.pathname.startsWith('/_favicon')) return send('image/svg+xml', favicon)
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/src/newtab/newtab.html' : url.pathname))
    if (!target.startsWith(root + path.sep)) throw new Error('Outside fixture root')
    let body = await readFile(target)
    if (target.endsWith('.html')) body = body.toString().replace('<head>', '<head><script src="/glass-fixture.js"></script>')
    send(mime[path.extname(target)] || 'application/octet-stream', body)
  } catch {
    response.writeHead(404)
    response.end()
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
await writeFile(path.join(directory, 'server.json'), JSON.stringify({ origin, directory }, null, 2))
console.log(JSON.stringify({ origin, directory }))

if (!process.argv.includes('--serve-only')) {
  const space = argument('--space') === null ? null : Number(argument('--space'))
  if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
  const scriptPath = path.join(directory, `round-${Date.now()}.mjs`)
  await writeFile(scriptPath, `
    const { runGlassSurfaceChecks } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/newtab/glass-surface-scenarios.mjs')).href)});
    const task = await taskSpace(${space ?? JSON.stringify(`Curator GlassSurface checks ${Date.now()}`)});
    console.log({ spaceId: task.spaceId });
    const report = await runGlassSurfaceChecks(task.page("p1"), ${JSON.stringify(origin)}, ${JSON.stringify(directory.replaceAll('\\', '/'))});
    console.log(report);
    ${space ? '' : 'await task.finish({ keep: [] });'}
  `, 'utf8')
  const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
  try {
    await new Promise((resolve, reject) => {
      const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
        windowsHide: true, timeout: 300000, maxBuffer: 2 ** 20
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
