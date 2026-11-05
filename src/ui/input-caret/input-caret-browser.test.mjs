import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// Read the installed ego-browser skill before running. Reused spaces belong to
// the caller; this runner only finishes spaces it creates.
const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null
const space = option('--space') === null ? null : Number(option('--space'))
if (space !== null && (!Number.isSafeInteger(space) || space < 1)) throw new Error('Invalid --space')
const directory = path.resolve(option('--output') || `.tmp/input-caret-${Date.now()}`)
await mkdir(directory, { recursive: true })
const files = new Map()
for (const surface of ['popup', 'sidepanel', 'newtab', 'options', 'archive']) {
  const html = await readFile(`dist/src/${surface}/${surface}.html`, 'utf8')
  const links = [...html.matchAll(/<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="([^"]+)"/g)].map(([, url]) => url)
  if (!links.length) throw new Error('Build the extension before running caret checks')
  const css = await Promise.all(links.map(url => readFile(path.join('dist', url.replace(/^\/+/, '')), 'utf8')))
  files.set(`/${surface}.css`, ['text/css', css.join('\n')])
}
const bundle = await build({
  stdin: {
    contents: `import { startInputCaretController } from './src/ui/input-caret/input-caret-controller';
      window.__stopInputCaret = startInputCaretController(); window.__inputCaretReady = true;`,
    resolveDir: process.cwd()
  },
  bundle: true, write: false, format: 'esm', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' }
})
files.set('/caret.js', ['text/javascript', bundle.outputFiles[0].text])
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (url.pathname === '/') {
    const surface = ['popup', 'sidepanel', 'newtab', 'options', 'archive'].includes(url.searchParams.get('surface'))
      ? url.searchParams.get('surface') : 'popup'
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(`<!doctype html><html lang="zh-CN" data-curator-surface="${surface}"><head>
      <meta name="viewport" content="width=device-width,initial-scale=1"><title>Curator caret regression</title>
      <link rel="stylesheet" href="/${surface}.css"><style>
      html,body{margin:0;min-width:0;max-width:none;width:100%;height:100%;background:#151515;color:white}
      main{padding:24px;width:min(100%,640px);box-sizing:border-box}
      label{display:block;margin-bottom:20px;font:14px system-ui}
      input,textarea{display:block;box-sizing:border-box;width:100%;margin-top:8px;padding:10px 12px;
        border:1px solid #555;border-radius:12px;background:#222;color:white;font:16px/24px Arial}
      input{height:46px}textarea{height:100px;resize:none;white-space:pre-wrap;overflow-wrap:break-word}
      </style></head><body><main>
      <label>输入<input id="text" type="text" autocomplete="off"></label>
      <label>多行<textarea id="textarea"></textarea></label>
      <label>密码<input id="password" type="password" autocomplete="off"></label>
      </main><script type="module" src="/caret.js"></script></body></html>`)
    return
  }
  const file = files.get(url.pathname)
  response.writeHead(file ? 200 : 404, { 'content-type': file?.[0] || 'text/plain', 'cache-control': 'no-store' })
  response.end(file?.[1] || '')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const scriptPath = path.join(directory, 'round-01.mjs')
await writeFile(scriptPath, `
const task = await taskSpace(${space ?? JSON.stringify(`Curator caret ${Date.now()}`)});
const page = task.page("p1");
console.log({ spaceId: task.spaceId, page: page.label });
const { runInputCaretChecks } = await import(${JSON.stringify(pathToFileURL(path.resolve('src/ui/input-caret/input-caret-scenarios.mjs')).href)});
const report = await runInputCaretChecks(page, ${JSON.stringify(origin)}, ${JSON.stringify(directory.replaceAll('\\', '/'))});
await (await import("node:fs/promises")).writeFile(${JSON.stringify(path.join(directory, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures, measurements: report.measurements }));
${process.argv.includes('--record-only') ? '' : 'if (report.failures.length) throw new Error("Input caret regression(s); see report.json");'}
${space === null ? 'await task.finish({ keep: [] });' : ''}
`, 'utf8')
const executable = process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
  ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe') : 'ego-browser')
try {
  await new Promise((resolve, reject) => {
    const child = execFile(executable, ['nodejs', '-e', `await import('${pathToFileURL(scriptPath).href}')`], {
      windowsHide: true, timeout: 180000, maxBuffer: 2 ** 20
    }, error => error ? reject(error) : resolve())
    child.stdin.end()
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  })
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  console.log(`Caret report: ${path.join(directory, 'report.json')}`)
}
