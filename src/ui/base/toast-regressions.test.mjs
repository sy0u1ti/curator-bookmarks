import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

await mkdir('.tmp-test', { recursive: true })
const temporary = await mkdtemp(path.resolve('.tmp-test/toast-regressions-'))
const extension = path.join(temporary, 'extension')
await cp(path.resolve('dist'), extension, { recursive: true })
await writeFile(path.join(extension, 'fixture.html'), `<!doctype html><html><head><style>
  .t-toast { transition: opacity 150ms; } .t-toast[data-ending-style] { opacity: 0; }
</style></head><body><div id="root"></div><script type="module" src="fixture.js"></script></body></html>`)
await build({ stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
  import React, { useState } from 'react';
  import { createRoot } from 'react-dom/client';
  import { ToastList } from './src/ui/base/Toast';
  function App() {
    const [version, setVersion] = useState(0);
    const [items, setItems] = useState([{ id: 'manual', description: '手动通知' }]);
    return <><button onClick={() => setVersion(version + 1)}>重新渲染 {version}</button>
      <button onClick={() => setItems([{ id: 'custom', description: '删除成功', actions: <button>撤销指定书签</button> }])}>新增通知</button>
      <button onClick={() => setItems([])}>移除通知</button>
      <ToastList items={items} /></>;
  }
  createRoot(document.getElementById('root')).render(<App />);
` }, bundle: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, format: 'esm', platform: 'browser', outfile: path.join(extension, 'fixture.js') })
const context = await chromium.launchPersistentContext(path.join(temporary, 'profile'), {
  channel: 'chromium', headless: true,
  args: [`--load-extension=${extension}`, `--disable-extensions-except=${extension}`]
})
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
  const page = await context.newPage()
  page.on('pageerror', error => console.error(error.message))
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/fixture.html`)
  await page.locator('[data-dismiss-toast="manual"]').click()
  await page.locator('[data-toast-id="manual"]').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: '重新渲染 0' }).click()
  assert.equal(await page.locator('[data-toast-id="manual"]').count(), 0, 'Dismissed controlled notifications must not reappear on a render')
  await page.getByRole('button', { name: '新增通知' }).click()
  await page.getByRole('button', { name: '撤销指定书签' }).waitFor()
  const frames = await page.evaluate(async () => {
    const frames = []
    document.querySelectorAll('button')[2].click()
    for (let i = 0; i < 30; i++) {
      await new Promise(requestAnimationFrame)
      const toast = document.querySelector('[data-toast-id="custom"]')
      if (!toast) break
      frames.push({ text: toast.textContent, inert: toast.inert })
    }
    return frames
  })
  assert.ok(frames.length > 0, 'Observe the actual exit rather than only the unmounted result')
  assert.ok(frames.every(frame => frame.text.includes('撤销指定书签') && !frame.text.includes('关闭') && frame.inert))
  await page.locator('[data-toast-id="custom"]').waitFor({ state: 'detached' })
  console.log('Toast manual dismissal and exit action preservation passed.')
} finally {
  await context.close()
  await rm(temporary, { recursive: true, force: true })
}
