import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function parseEgoSpaceArg(argv = process.argv) {
  const index = argv.indexOf('--space')
  if (index < 0) return null
  const value = Number(argv[index + 1])
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Invalid --space value: ${argv[index + 1]}`)
  }
  return value
}

export function getEgoExecutable() {
  return process.env.EGO_BROWSER_EXECUTABLE || (process.platform === 'win32'
    ? path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe')
    : 'ego-browser')
}

export async function prepareIsolatedQaExtension({
  name,
  root,
  entries = ['options', 'popup', 'sidepanel', 'newtab']
}) {
  if (!name.startsWith('Curator QA ')) {
    throw new Error('QA extension name must start with "Curator QA "')
  }
  const extension = path.join(root, 'extension')
  await mkdir(root, { recursive: true })
  await cp(path.resolve('dist'), extension, { recursive: true })

  const manifestPath = path.join(extension, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.name = name
  delete manifest.key
  delete manifest.commands
  delete manifest.chrome_url_overrides
  await writeFile(manifestPath, JSON.stringify(manifest))

  await writeFile(
    path.join(extension, 'qa-bookmarks.js'),
    await readFile(path.resolve('src/testing/isolated-extension-bookmarks.js'), 'utf8')
  )

  await writeFile(path.join(extension, 'qa-page.js'), `
(() => {
  if (!chrome.runtime.getManifest().name.startsWith('Curator QA ')) {
    throw new Error('QA page shim is only allowed in Curator QA extensions');
  }
  const qa = window.__curatorQa = {
    errors: [],
    createdTabs: [],
    updatedTabs: [],
    closed: false
  };
  window.close = () => { qa.closed = true; };
  addEventListener('error', (event) => qa.errors.push(event.message || 'Unknown error'));
  addEventListener('unhandledrejection', (event) => qa.errors.push(String(event.reason)));

  const respond = (value, callback) => {
    const copy = structuredClone(value);
    if (typeof callback === 'function') {
      queueMicrotask(() => callback(copy));
      return;
    }
    return Promise.resolve(copy);
  };

  chrome.tabs.create = (details = {}, callback) => {
    const tab = { id: -1 - qa.createdTabs.length, active: details.active !== false, ...details };
    qa.createdTabs.push(structuredClone(tab));
    return respond(tab, callback);
  };
  chrome.tabs.update = (tabIdOrProps, maybeProps, maybeCallback) => {
    const hasTabId = typeof tabIdOrProps === 'number';
    const tabId = hasTabId ? tabIdOrProps : -1;
    const props = hasTabId ? (maybeProps || {}) : (tabIdOrProps || {});
    const callback = hasTabId ? maybeCallback : (typeof maybeProps === 'function' ? maybeProps : undefined);
    const updated = { id: tabId, ...props };
    qa.updatedTabs.push(structuredClone(updated));
    return respond(updated, callback);
  };
  chrome.tabs.query = (details = {}, callback) => {
    const tabs = details && details.active
      ? [{ id: -1, active: true, windowId: -1, title: 'Curator QA current page', url: 'https://curator-qa.invalid/current' }]
      : [];
    return respond(tabs, callback);
  };
})();
`.trimStart())

  for (const entry of entries) {
    const htmlPath = path.join(extension, 'src', entry, `${entry}.html`)
    const html = await readFile(htmlPath, 'utf8')
    await writeFile(
      htmlPath,
      html.replace('<head>', '<head><script src="/qa-bookmarks.js"></script><script src="/qa-page.js"></script>')
    )
  }

  const workerPath = path.join(extension, manifest.background.service_worker)
  const workerSource = await readFile(workerPath, 'utf8')
  await writeFile(workerPath, `import './qa-bookmarks.js';\n${workerSource}`)

  return extension
}

export async function runEgoScenario({
  root,
  space = null,
  title,
  scenarioFile,
  exportName,
  config,
  timeoutMs = 420000,
  cleanupRoot = true
}) {
  const executable = getEgoExecutable()
  const scriptPath = path.join(root, 'round-01.mjs')
  const finishPath = path.join(root, 'finish.mjs')
  const spacePath = path.join(root, 'space.json')

  const execute = (file) => new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      ['nodejs', '-e', `await import('${pathToFileURL(file).href}')`],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error) => (error ? reject(error) : resolve())
    )
    child.stdin.end()
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  })

  await writeFile(scriptPath, `
const task = await taskSpace(${space ?? JSON.stringify(title)});
const fs = await import('node:fs/promises');
await fs.writeFile(${JSON.stringify(spacePath)}, JSON.stringify({ spaceId: task.spaceId }));
const mod = await import(${JSON.stringify(pathToFileURL(path.resolve(scenarioFile)).href)});
const report = await mod[${JSON.stringify(exportName)}](task, ${JSON.stringify(config)});
await fs.writeFile(${JSON.stringify(path.join(root, 'report.json'))}, JSON.stringify(report, null, 2));
console.log(${JSON.stringify(`${title} passed:`)} + ' ' + JSON.stringify(report));
`.trimStart(), 'utf8')

  try {
    await execute(scriptPath)
  } finally {
    if (space === null) {
      try {
        const { spaceId } = JSON.parse(await readFile(spacePath, 'utf8'))
        await writeFile(finishPath, `const task = await taskSpace(${spaceId}); await task.finish({ keep: [] });\n`, 'utf8')
        await execute(finishPath)
      } catch {}
    }
    if (cleanupRoot) {
      await rm(root, { recursive: true, force: true }).catch(() => {})
    }
  }
}
