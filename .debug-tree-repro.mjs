// [DEBUG-tree1] dashboard 文件夹树复现回路:卡片有而树为空 => BUG (exit 1)
import { chromium } from '@playwright/test'
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const dist = resolve('dist')
const userDir = mkdtempSync(join(tmpdir(), 'dash-tree-'))

// 预置用户真实数据:书签文件 + 扩展 chrome.storage(LevelDB)
const WIN_PROFILE = '/mnt/c/Users/Administrator/AppData/Local/Google/Chrome/User Data/Default'
const WIN_EXT_ID = 'ihfokbkanmklffljcfpglcikaeeinicf'
const REPRO_EXT_ID = 'dpdaoopeglpjjmieangajjfcnoieppol'
mkdirSync(join(userDir, 'Default'), { recursive: true })
cpSync(join(WIN_PROFILE, 'Bookmarks'), join(userDir, 'Default', 'Bookmarks'))
cpSync(
  join(WIN_PROFILE, 'Local Extension Settings', WIN_EXT_ID),
  join(userDir, 'Default', 'Local Extension Settings', REPRO_EXT_ID),
  { recursive: true }
)
rmSync(join(userDir, 'Default', 'Local Extension Settings', REPRO_EXT_ID, 'LOCK'), { force: true })

const context = await chromium.launchPersistentContext(userDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 2560, height: 1050 },
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`
  ]
})

let [worker] = context.serviceWorkers()
if (!worker) {
  worker = await context.waitForEvent('serviceworker', { timeout: 15000 })
}
const extensionId = new URL(worker.url()).host
console.log('[DEBUG-tree1] extension id:', extensionId)

const page = await context.newPage()
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[DEBUG-tree1][console.error]', msg.text())
})
page.on('pageerror', (err) => console.log('[DEBUG-tree1][pageerror]', String(err)))

// 真实路径:打开 newtab 页,点击 dashboard 触发按钮,在 overlay iframe 内断言
await page.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`)
await page.waitForTimeout(2500)
await page.click('#newtab-dashboard-trigger')
const frameElement = await page.waitForSelector('#newtab-dashboard-frame', { timeout: 15000 })
const frame = await frameElement.contentFrame()
await page.waitForTimeout(5000)

const treeCount = await frame.locator('nav[aria-label="按文件夹筛选书签"] button').count()
const treeVisible = await frame.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="按文件夹筛选书签"]')
  if (!nav) return { navFound: false }
  const rect = nav.getBoundingClientRect()
  const buttons = [...nav.querySelectorAll('button')]
  const visibleButtons = buttons.filter((b) => {
    const r = b.getBoundingClientRect()
    const cs = getComputedStyle(b)
    return r.height > 0 && r.width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'
  })
  return {
    navFound: true,
    navHeight: Math.round(rect.height),
    navWidth: Math.round(rect.width),
    buttons: buttons.length,
    visibleButtons: visibleButtons.length,
    navDisplay: getComputedStyle(nav).display,
    navOverflow: getComputedStyle(nav).overflow
  }
})
const cardCount = await frame.evaluate(() => document.querySelectorAll('[data-bookmark-id], article').length)
const sidebarCountText = await frame.locator('#dashboard-folder-sidebar-title + span').textContent().catch(() => '(none)')

console.log(`[DEBUG-tree1] tree buttons=${treeCount} cards=${cardCount} countPill=${JSON.stringify(sidebarCountText)}`)
console.log('[DEBUG-tree1] visibility:', JSON.stringify(treeVisible))

await context.close()

const visibleOk = treeVisible.navFound && treeVisible.visibleButtons > 0
if (cardCount > 0 && !visibleOk) {
  console.log('[DEBUG-tree1] RED: 卡片渲染但文件夹树不可见 —— bug 复现')
  process.exit(1)
}
if (cardCount === 0) {
  console.log('[DEBUG-tree1] INCONCLUSIVE: 卡片也没渲染,回路无效')
  process.exit(2)
}
console.log('[DEBUG-tree1] GREEN: 文件夹树有节点')
process.exit(0)
