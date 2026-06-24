import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json')
const USER_DATA_PREFIX = path.join(os.tmpdir(), 'curator-extension-smoke-')

const STORAGE_KEYS = {
  onboardingState: 'curatorBookmarkOnboardingState',
  recycleBin: 'curatorBookmarkRecycleBin',
  newTabFolderSettings: 'curatorBookmarkNewTabFolderSettings',
  newTabWorkspaceSettings: 'curatorBookmarkNewTabWorkspaceSettings',
  bookmarkTagIndex: 'curatorBookmarkTagIndex'
}

const SMOKE_TIMEOUT_MS = 45_000
const PAGE_TIMEOUT_MS = 20_000
const POPUP_FRAME_WIDTH = 758
const POPUP_FRAME_HEIGHT = 609
const DASHBOARD_LAYOUT_MIN_CARD_WIDTH = 240
const DASHBOARD_LAYOUT_SEED_BOOKMARK_COUNT = 90
const DASHBOARD_ACTION_MOVE_TOLERANCE_PX = 1

let context
let userDataDir = ''
let seed
let extensionId = ''
const pageErrors = []
const consoleErrors = []
const requestFailures = []

try {
  await assertBuiltExtension()

  userDataDir = await fs.mkdtemp(USER_DATA_PREFIX)
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      '--disable-default-apps',
      '--disable-features=Translate,OptimizationHints',
      '--no-default-browser-check',
      '--no-first-run'
    ]
  })

  context.setDefaultTimeout(PAGE_TIMEOUT_MS)
  context.on('page', attachPageDiagnostics)
  for (const page of context.pages()) {
    attachPageDiagnostics(page)
  }

  const worker = await waitForExtensionServiceWorker(context)
  extensionId = getExtensionId(worker)
  seed = await seedExtensionData(worker)

  await smokePopup()
  await smokeNewtab()
  await smokeOptionsDashboard(worker)
  await assertPermissions(worker)
  assertNoRuntimeErrors()

  console.log(`Extension smoke passed for ${extensionId}.`)
} catch (error) {
  dumpDiagnostics()
  throw error
} finally {
  if (context) {
    if (seed?.folderId) {
      await removeSeedFolder(context, seed.folderId).catch(() => {})
    }
    await context.close().catch(() => {})
  }
  if (userDataDir) {
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function assertBuiltExtension() {
  try {
    await fs.access(MANIFEST_PATH)
  } catch {
    throw new Error('dist/manifest.json is missing. Run `npm run build` before `npm run smoke:extension`.')
  }
}

async function waitForExtensionServiceWorker(browserContext) {
  const existingWorker = browserContext.serviceWorkers()
    .find((worker) => worker.url().startsWith('chrome-extension://'))
  if (existingWorker) {
    return existingWorker
  }

  return await browserContext.waitForEvent('serviceworker', {
    timeout: SMOKE_TIMEOUT_MS,
    predicate: (worker) => worker.url().startsWith('chrome-extension://')
  })
}

function getExtensionId(worker) {
  const url = new URL(worker.url())
  if (!url.hostname) {
    throw new Error(`Unable to read extension id from service worker URL: ${worker.url()}`)
  }
  return url.hostname
}

async function seedExtensionData(worker) {
  return await worker.evaluate(async ({ dashboardLayoutSeedBookmarkCount, storageKeys }) => {
    const callChrome = (target, method, ...args) => new Promise((resolve, reject) => {
      target[method](...args, (result) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve(result)
      })
    })

    const now = Date.now()
    const folder = await callChrome(chrome.bookmarks, 'create', {
      parentId: '1',
      title: `Curator Smoke ${now}`
    })
    const archive = await callChrome(chrome.bookmarks, 'create', {
      parentId: folder.id,
      title: 'Archive Smoke Folder'
    })
    const alpha = await callChrome(chrome.bookmarks, 'create', {
      parentId: folder.id,
      title: 'Alpha Runtime Smoke',
      url: 'https://example.com/alpha-runtime-smoke'
    })
    const beta = await callChrome(chrome.bookmarks, 'create', {
      parentId: folder.id,
      title: 'Beta Dashboard Smoke',
      url: 'https://developer.chrome.com/docs/extensions/mv3/'
    })
    const gamma = await callChrome(chrome.bookmarks, 'create', {
      parentId: folder.id,
      title: 'Gamma Newtab Smoke',
      url: 'https://react.dev/'
    })
    for (let index = 0; index < dashboardLayoutSeedBookmarkCount; index += 1) {
      await callChrome(chrome.bookmarks, 'create', {
        parentId: folder.id,
        title: `Keyboard Scroll Smoke ${String(index).padStart(2, '0')}`,
        url: `https://example.com/keyboard-scroll-smoke-${index}`
      })
    }
    const tagRecord = {
      schemaVersion: 1,
      bookmarkId: beta.id,
      url: beta.url,
      normalizedUrl: beta.url,
      duplicateKey: beta.url,
      title: beta.title,
      path: `${folder.title}/${beta.title}`,
      summary: 'Dashboard smoke seed bookmark',
      contentType: 'documentation',
      topics: ['extensions'],
      tags: ['smoke', 'dashboard', 'extensions', 'mv3', 'docs'],
      aliases: [],
      confidence: 0.99,
      source: 'manual',
      model: 'smoke',
      extraction: {
        status: 'completed',
        source: 'smoke',
        warnings: []
      },
      generatedAt: now,
      updatedAt: now
    }

    await callChrome(chrome.storage.local, 'set', {
      [storageKeys.onboardingState]: {
        version: 1,
        completed: true,
        completedAt: now
      },
      [storageKeys.newTabFolderSettings]: {
        selectedFolderIds: [folder.id],
        hideFolderNames: false
      },
      [storageKeys.newTabWorkspaceSettings]: {
        activeWorkspaceId: 'default',
        workspaces: [{
          id: 'default',
          name: 'Speed Dial',
          pinnedIds: [],
          createdAt: now,
          updatedAt: now
        }]
      },
      [storageKeys.bookmarkTagIndex]: {
        version: 1,
        updatedAt: now,
        records: {
          [beta.id]: tagRecord
        }
      }
    })

    return {
      folderTitle: folder.title,
      folderId: folder.id,
      archiveTitle: archive.title,
      archiveId: archive.id,
      alphaId: alpha.id,
      betaId: beta.id,
      gammaId: gamma.id
    }
  }, {
    dashboardLayoutSeedBookmarkCount: DASHBOARD_LAYOUT_SEED_BOOKMARK_COUNT,
    storageKeys: STORAGE_KEYS
  })
}

async function smokePopup() {
  const popup = await newExtensionPage(`chrome-extension://${extensionId}/src/popup/popup.html`, {
    width: POPUP_FRAME_WIDTH,
    height: POPUP_FRAME_HEIGHT
  })

  await assertPopupFrameSize(popup)
  await expect(popup.locator('#search-input')).toBeVisible()
  await assertPopupFolderTreeHierarchy(popup, seed.folderTitle, seed.archiveTitle)
  await assertPopupKeyboardActiveBookmark(popup)

  await popup.fill('#search-input', 'Alpha Runtime Smoke')
  await expect(popup.getByText('Alpha Runtime Smoke')).toBeVisible()
  await assertPopupWorkspaceNotBlurred(popup)

  await popup.getByRole('button', { name: '编辑书签：Alpha Runtime Smoke' }).click()
  await expect(popup.locator('#edit-modal')).toBeVisible()
  await expect(popup.locator('#popup-app-shell')).toHaveAttribute('aria-hidden', 'true')
  await expect(popup.locator('#popup-app-shell')).toHaveJSProperty('inert', true)

  await popup.locator('#edit-title-input').focus()
  await popup.fill('#edit-title-input', 'Alpha Runtime Smoke Edited')
  await popup.locator('#edit-folder-picker-button').click()
  await popup.locator(`[data-select-edit-folder="${seed.archiveId}"]`).click()
  await popup.locator('#save-edit').click()
  await expect(popup.locator('#edit-modal')).toHaveCount(0)

  let alpha = await getBookmark(seed.alphaId)
  expect(alpha.title).toBe('Alpha Runtime Smoke Edited')
  expect(alpha.parentId).toBe(seed.archiveId)

  await popup.fill('#search-input', 'Alpha Runtime Smoke Edited')
  await expect(popup.getByText('Alpha Runtime Smoke Edited')).toBeVisible()
  await popup.getByRole('button', { name: '删除书签：Alpha Runtime Smoke Edited' }).click()
  await expect(popup.locator('#delete-modal')).toBeVisible()
  await popup.locator('#confirm-delete').click()
  await waitForBookmarkRemoved(seed.alphaId)
  await expect(popup.locator('#delete-modal')).toHaveCount(0)

  const recycleBin = await getStorage(STORAGE_KEYS.recycleBin)
  expect(JSON.stringify(recycleBin)).toContain('Alpha Runtime Smoke Edited')

  const popupTabsBefore = context.pages().length
  await popup.locator('#open-settings').click()
  await context.waitForEvent('page', {
    timeout: PAGE_TIMEOUT_MS,
    predicate: (page) => page.url().includes('/src/options/options.html')
  }).catch(async () => {
    const opened = context.pages().slice(popupTabsBefore)
      .find((page) => page.url().includes('/src/options/options.html'))
    if (!opened) {
      throw new Error('Popup settings button did not open the options page.')
    }
  })

  await popup.close()
}

async function smokeNewtab() {
  const newtab = await newExtensionPage(`chrome-extension://${extensionId}/src/newtab/newtab.html`, { width: 1280, height: 900 })

  await expect(newtab.getByRole('link', { name: 'Beta Dashboard Smoke', exact: true })).toBeVisible()
  const faviconSrc = await newtab.locator('.bookmark-favicon').first().getAttribute('src')
  expect(faviconSrc || '').toContain(`chrome-extension://${extensionId}/_favicon/`)
  expect(faviconSrc || '').toContain('pageUrl=')

  const settingsTrigger = newtab.locator('#newtab-settings-trigger')
  await settingsTrigger.click()
  const drawer = newtab.locator('#newtab-settings-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toHaveAttribute('aria-hidden', 'false')
  await expect(drawer).toHaveJSProperty('inert', false)
  await newtab.mouse.click(32, 80)
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  await expect(drawer).toHaveJSProperty('inert', true)
  await settingsTrigger.click()
  await expect(drawer).toHaveAttribute('aria-hidden', 'false')
  await expect(drawer).toHaveJSProperty('inert', false)
  await newtab.keyboard.press('Tab')
  await expect.poll(async () => {
    return await newtab.evaluate(() => {
      const drawerElement = document.querySelector('#newtab-settings-drawer')
      return Boolean(drawerElement && document.activeElement && drawerElement.contains(document.activeElement))
    })
  }, { timeout: PAGE_TIMEOUT_MS }).toBe(true)
  await newtab.keyboard.press('Escape')
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  await expect(drawer).toHaveJSProperty('inert', true)
  await expect(settingsTrigger).toBeFocused()

  await newtab.locator('#newtab-dashboard-trigger').click()
  const overlay = newtab.locator('#newtab-dashboard-overlay')
  await expect(overlay).toBeVisible()
  const frame = newtab.frameLocator('#newtab-dashboard-frame')
  await expect(frame.locator('#dashboard')).toBeVisible()
  await frame.locator('#dashboard-query').fill('Beta Dashboard')
  await expect(frame.getByText('Beta Dashboard Smoke').first()).toBeVisible()
  const frameSrc = await newtab.locator('#newtab-dashboard-frame').getAttribute('src')
  expect(frameSrc || '').toContain('/src/options/options.html?embed=newtab-dashboard')
  expect(frameSrc || '').toContain('#dashboard')
  await overlay.focus()
  await newtab.keyboard.press('Escape')
  await expect(overlay).toBeHidden()

  await newtab.close()
}

async function smokeOptionsDashboard(worker) {
  const options = await newExtensionPage(`chrome-extension://${extensionId}/src/options/options.html#dashboard`, { width: 1440, height: 960 })

  await expect(options.locator('#dashboard')).toBeVisible()
  await expect(options.locator('#dashboard-query')).toBeVisible()
  await assertDashboardLayoutStable(options)
  await options.fill('#dashboard-query', 'Beta Dashboard')
  await expect(options.getByText('Beta Dashboard Smoke').first()).toBeVisible()
  await assertDashboardTagPopoverDoesNotMoveActions(options, 'Beta Dashboard Smoke')

  await options.getByRole('checkbox', { name: /选择书签：Beta Dashboard Smoke/ }).click()
  await options.getByRole('button', { name: '批量移动 Dashboard 已选书签' }).click()
  await expect(options.locator('#move-search-input')).toBeVisible()
  await expect(options.locator('#move-search-input')).toBeFocused()
  await options.keyboard.press('Escape')
  await expect(options.locator('#move-search-input')).toBeHidden()
  await expect(options.getByRole('button', { name: '批量移动 Dashboard 已选书签' })).toBeFocused()

  const menuTrigger = options.getByRole('button', { name: '更多操作：Beta Dashboard Smoke' })
  await menuTrigger.click()
  await options.getByRole('menuitem', { name: '添加进 Speed Dial：Beta Dashboard Smoke' }).click()
  const workspace = await getStorage(STORAGE_KEYS.newTabWorkspaceSettings)
  expect(JSON.stringify(workspace)).toContain(seed.betaId)

  await menuTrigger.click()
  await options.getByRole('menuitem', { name: '修改书签标签：Beta Dashboard Smoke' }).click()
  await expect(options.locator('#dashboard-tag-editor')).toBeVisible()
  await expect(options.locator('#dashboard-tag-editor textarea')).toBeFocused()
  await options.keyboard.press('Escape')
  await expect(options.locator('#dashboard-tag-editor')).toBeHidden()
  await expect(menuTrigger).toBeFocused()

  const dashboardFaviconSrc = await options.locator('#dashboard article img[src*="/_favicon/"]').first().getAttribute('src')
  expect(dashboardFaviconSrc || '').toContain(`chrome-extension://${extensionId}/_favicon/`)
  expect(dashboardFaviconSrc || '').toContain('pageUrl=')

  await options.close()

  await worker.evaluate(async () => {
    await new Promise((resolve, reject) => {
      chrome.storage.local.get(null, () => {
        const error = chrome.runtime.lastError
        error ? reject(new Error(error.message)) : resolve()
      })
    })
  })
}

async function assertDashboardLayoutStable(options) {
  await options.waitForFunction(() => document.querySelectorAll('#dashboard article').length > 0, null, {
    timeout: PAGE_TIMEOUT_MS
  })

  await expect.poll(async () => {
    const snapshot = await readDashboardLayoutSnapshot(options)
    if (snapshot.loaderHidden && snapshot.firstCardWidth >= DASHBOARD_LAYOUT_MIN_CARD_WIDTH) {
      return 'ready'
    }
    return JSON.stringify(snapshot)
  }, { timeout: PAGE_TIMEOUT_MS }).toBe('ready')
}

async function readDashboardLayoutSnapshot(options) {
  return await options.evaluate(() => {
    const round = (value) => Math.round(Number(value) || 0)
    const loader = document.querySelector('output[aria-label="正在读取书签仪表盘"]')
    const loaderStyle = loader ? getComputedStyle(loader) : null
    const firstCard = document.querySelector('#dashboard article')
    const virtualWindow = firstCard?.parentElement || null
    const virtualSpacer = virtualWindow?.parentElement || null
    const resultsGrid = virtualSpacer?.parentElement || null
    const cardRect = firstCard?.getBoundingClientRect()
    const windowRect = virtualWindow?.getBoundingClientRect()
    const spacerRect = virtualSpacer?.getBoundingClientRect()
    const gridRect = resultsGrid?.getBoundingClientRect()
    const gridStyle = resultsGrid ? getComputedStyle(resultsGrid) : null

    return {
      cardCount: document.querySelectorAll('#dashboard article').length,
      firstCardWidth: round(cardRect?.width),
      gridDisplay: gridStyle?.display || '',
      gridTemplateColumns: gridStyle?.gridTemplateColumns || '',
      gridWidth: round(gridRect?.width),
      loaderHidden: !loader || loaderStyle?.visibility === 'hidden' || Number(loaderStyle?.opacity || 0) < 0.05,
      loaderOpacity: loaderStyle?.opacity || '',
      loaderVisibility: loaderStyle?.visibility || '',
      spacerWidth: round(spacerRect?.width),
      virtualWindowGridTemplateColumns: virtualWindow instanceof HTMLElement
        ? getComputedStyle(virtualWindow).gridTemplateColumns
        : '',
      virtualWindowWidth: round(windowRect?.width)
    }
  })
}

async function assertDashboardTagPopoverDoesNotMoveActions(options, bookmarkTitle) {
  const before = await readDashboardCardActionSnapshot(options, bookmarkTitle)
  const tagToggle = options.getByRole('button', { name: /查看 \d+ 个隐藏标签/ }).first()
  const tagToggleBox = await tagToggle.boundingBox()
  if (!tagToggleBox) {
    throw new Error('Unable to measure Dashboard hidden tag toggle.')
  }

  await options.mouse.move(
    tagToggleBox.x + tagToggleBox.width / 2,
    tagToggleBox.y + tagToggleBox.height / 2
  )
  await expect(options.getByText('全部标签')).toBeVisible()
  await options.waitForTimeout(150)

  const after = await readDashboardCardActionSnapshot(options, bookmarkTitle)
  expect(Math.abs(after.openButtonTop - before.openButtonTop)).toBeLessThanOrEqual(DASHBOARD_ACTION_MOVE_TOLERANCE_PX)
  expect(Math.abs(after.copyButtonTop - before.copyButtonTop)).toBeLessThanOrEqual(DASHBOARD_ACTION_MOVE_TOLERANCE_PX)
  expect(Math.abs(after.moreButtonTop - before.moreButtonTop)).toBeLessThanOrEqual(DASHBOARD_ACTION_MOVE_TOLERANCE_PX)

  await options.mouse.move(20, 20)
}

async function readDashboardCardActionSnapshot(options, bookmarkTitle) {
  return await options.evaluate((title) => {
    const titleElement = [...document.querySelectorAll('#dashboard article strong')]
      .find((candidate) => candidate.textContent?.trim() === title)
    const card = titleElement?.closest('article')
    if (!card) {
      throw new Error(`Unable to find Dashboard card for ${title}`)
    }
    const openButton = card.querySelector('a[aria-label^="打开书签"]')
    const copyButton = card.querySelector('button[aria-label^="复制书签"]')
    const moreButton = card.querySelector('button[aria-label^="更多操作"]')

    return {
      copyButtonTop: Math.round(copyButton?.getBoundingClientRect().top || 0),
      moreButtonTop: Math.round(moreButton?.getBoundingClientRect().top || 0),
      openButtonTop: Math.round(openButton?.getBoundingClientRect().top || 0)
    }
  }, bookmarkTitle)
}

async function assertPermissions(worker) {
  const result = await worker.evaluate(async () => {
    const contains = (permissions) => new Promise((resolve) => {
      chrome.permissions.contains(permissions, resolve)
    })

    return {
      bookmarks: await contains({ permissions: ['bookmarks'] }),
      favicon: await contains({ permissions: ['favicon'] }),
      storage: await contains({ permissions: ['storage'] }),
      exampleHost: await contains({ origins: ['https://example.com/*'] })
    }
  })

  expect(result).toEqual({
    bookmarks: true,
    favicon: true,
    storage: true,
    exampleHost: false
  })
}

async function assertPopupFrameSize(popup) {
  await expect.poll(async () => {
    return await popup.evaluate(() => {
      const body = document.body.getBoundingClientRect()
      const shell = document.querySelector('#popup-app-shell')?.getBoundingClientRect()
      const bodyStyle = getComputedStyle(document.body)
      return {
        bodyHeight: Math.round(body.height),
        bodyMaxHeight: bodyStyle.maxHeight,
        bodyMaxWidth: bodyStyle.maxWidth,
        bodyMinHeight: bodyStyle.minHeight,
        bodyMinWidth: bodyStyle.minWidth,
        bodyWidth: Math.round(body.width),
        shellHeight: Math.round(shell?.height || 0),
        shellWidth: Math.round(shell?.width || 0)
      }
    })
  }, { timeout: PAGE_TIMEOUT_MS }).toEqual({
    bodyHeight: POPUP_FRAME_HEIGHT,
    bodyMaxHeight: `${POPUP_FRAME_HEIGHT}px`,
    bodyMaxWidth: `${POPUP_FRAME_WIDTH}px`,
    bodyMinHeight: `${POPUP_FRAME_HEIGHT}px`,
    bodyMinWidth: `${POPUP_FRAME_WIDTH}px`,
    bodyWidth: POPUP_FRAME_WIDTH,
    shellHeight: POPUP_FRAME_HEIGHT,
    shellWidth: POPUP_FRAME_WIDTH
  })
}

async function assertPopupWorkspaceNotBlurred(popup) {
  await expect.poll(async () => {
    return await popup.evaluate(() => {
      const tree = document.querySelector('[aria-label="文件夹树"]')
      const contentLayer = tree?.parentElement?.parentElement
      const shell = contentLayer?.parentElement

      if (!tree || !contentLayer || !shell) {
        return {
          ready: false,
          filter: 'missing',
          opacity: 'missing',
          treeFilter: 'missing'
        }
      }

      return {
        ready: shell.getAttribute('data-state') === 'ready' && shell.getAttribute('aria-busy') === 'false',
        filter: getComputedStyle(contentLayer).filter || 'none',
        opacity: getComputedStyle(contentLayer).opacity,
        treeFilter: getComputedStyle(tree).filter || 'none'
      }
    })
  }, { timeout: PAGE_TIMEOUT_MS }).toEqual({
    ready: true,
    filter: 'none',
    opacity: '1',
    treeFilter: 'none'
  })
}

async function assertPopupFolderTreeHierarchy(popup, parentLabel, childLabel) {
  const metrics = await popup.evaluate(({ childLabel, parentLabel }) => {
    const buttons = [...document.querySelectorAll('[role="tree"] button')]
    const getRowMetrics = (label) => {
      const button = buttons.find((candidate) => candidate.textContent?.includes(label))
      const title = button
        ? [...button.querySelectorAll('span')].find((candidate) => candidate.textContent?.trim() === label)
        : null

      if (!button || !title) {
        return null
      }

      return {
        buttonPaddingLeft: getComputedStyle(button).paddingLeft,
        titleLeft: title.getBoundingClientRect().left
      }
    }

    const parent = getRowMetrics(parentLabel)
    const child = getRowMetrics(childLabel)
    return {
      child,
      indentDelta: parent && child ? child.titleLeft - parent.titleLeft : 0,
      parent
    }
  }, { childLabel, parentLabel })

  expect(metrics.parent).toBeTruthy()
  expect(metrics.child).toBeTruthy()
  expect(metrics.indentDelta).toBeGreaterThanOrEqual(12)
}

async function assertPopupKeyboardActiveBookmark(popup) {
  const beforeRows = await readPopupMainBookmarkRows(popup)
  const beforeActiveIndex = beforeRows.find((row) => row.dataActive === 'true')?.index ?? -1

  await popup.keyboard.press('ArrowDown')

  await expect.poll(async () => {
    const rows = await readPopupMainBookmarkRows(popup)
    const activeRow = rows.find((row) => row.dataActive === 'true')
    return Boolean(
      activeRow &&
      activeRow.index !== beforeActiveIndex &&
      hasVisibleActiveBookmarkStyle(activeRow)
    )
  }, { timeout: PAGE_TIMEOUT_MS }).toBe(true)

  await assertPopupTreeKeyboardScrollsToActiveBookmark(popup)
}

async function assertPopupTreeKeyboardScrollsToActiveBookmark(popup) {
  for (let index = 0; index < 9; index += 1) {
    await popup.keyboard.press('ArrowDown')
  }

  await expect.poll(async () => {
    const rows = await readPopupMainBookmarkRows(popup)
    const activeRow = rows.find((row) => row.dataActive === 'true')
    return Boolean(
      activeRow &&
      activeRow.index >= 10 &&
      activeRow.listScrollTop > 0 &&
      activeRow.visible &&
      hasVisibleActiveBookmarkStyle(activeRow)
    )
  }, { timeout: PAGE_TIMEOUT_MS }).toBe(true)
}

async function readPopupMainBookmarkRows(popup) {
  return await popup.evaluate(() => {
    const section = [...document.querySelectorAll('section[aria-label]')]
      .find((candidate) => candidate.querySelector('ul li button'))
    const list = section?.querySelector('ul')
    const listRect = list?.getBoundingClientRect()
    const rows = list ? [...list.querySelectorAll(':scope > li')] : []

    return rows.map((row, index) => {
      const button = row.querySelector('button')
      const titleElement = button?.querySelector(':scope > span > span:first-child') || button?.querySelector('span span')
      const title = titleElement?.textContent?.trim() || button?.textContent?.trim() || ''
      const style = button ? getComputedStyle(button) : null
      const buttonRect = button?.getBoundingClientRect()
      const titleRect = titleElement?.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()

      return {
        backgroundColor: style?.backgroundColor || '',
        borderColor: style?.borderTopColor || '',
        boxShadow: style?.boxShadow || '',
        className: button?.getAttribute('class') || '',
        dataActive: row.getAttribute('data-active'),
        index,
        listScrollTop: list?.scrollTop || 0,
        visible: Boolean(listRect && rowRect.top >= listRect.top && rowRect.bottom <= listRect.bottom),
        textInset: buttonRect && titleRect ? titleRect.left - buttonRect.left : 0,
        textTopInset: buttonRect && titleRect ? titleRect.top - buttonRect.top : 0,
        title
      }
    })
  })
}

function hasVisibleActiveBookmarkStyle(row) {
  return Boolean(
    row &&
    row.dataActive === 'true' &&
    hasSoftWhiteBackground(row.backgroundColor) &&
    hasSoftWhiteGlow(row.boxShadow) &&
    hasComfortableActiveBookmarkInset(row) &&
    !String(row.className || '').includes('ui-accent') &&
    !String(row.className || '').includes('inset_3px') &&
    !/rgb\(159,\s*206,\s*161\)|inset/.test(String(row.boxShadow || ''))
  )
}

function hasComfortableActiveBookmarkInset(row) {
  return Number(row.textInset) >= 13 && Number(row.textTopInset) >= 7
}

function hasSoftWhiteBackground(backgroundColor) {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/.exec(String(backgroundColor || ''))
  if (!match) {
    return false
  }

  const red = Number(match[1])
  const green = Number(match[2])
  const blue = Number(match[3])
  const alpha = match[4] === undefined ? 1 : Number(match[4])
  const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue)

  return alpha > 0 && colorSpread <= 6 && red >= 20 && green >= 20 && blue >= 20
}

function hasSoftWhiteGlow(boxShadow) {
  const shadow = String(boxShadow || '')
  if (!shadow || shadow === 'none' || /rgb\(159,\s*206,\s*161\)|inset/.test(shadow)) {
    return false
  }

  const color = /rgba?\([^)]+\)/.exec(shadow)?.[0] || ''
  const lengths = shadow.replace(color, '').match(/-?\d+(?:\.\d+)?px/g) || []
  const blurRadius = Number(String(lengths[2] || '0').replace('px', ''))

  return hasSoftWhiteBackground(color) && blurRadius >= 8
}

async function newExtensionPage(url, viewport) {
  const page = await context.newPage()
  attachPageDiagnostics(page)
  await page.setViewportSize(viewport)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  return page
}

function attachPageDiagnostics(page) {
  if (page.__curatorSmokeDiagnosticsAttached) {
    return
  }
  page.__curatorSmokeDiagnosticsAttached = true
  page.on('pageerror', (error) => {
    pageErrors.push(`${page.url()}: ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error' && !isIgnorableFaviconMessage(message.text())) {
      consoleErrors.push(`${page.url()}: ${message.text()}`)
    }
  })
  page.on('requestfailed', (request) => {
    if (!isIgnorableFaviconMessage(request.url())) {
      requestFailures.push(`${page.url()}: ${request.url()} ${request.failure()?.errorText || ''}`.trim())
    }
  })
}

function isIgnorableFaviconMessage(text) {
  return text.includes('/_favicon/') || text.includes('favicon')
}

function assertNoRuntimeErrors() {
  if (pageErrors.length || consoleErrors.length || requestFailures.length) {
    throw new Error([
      pageErrors.length ? `Page errors:\n${pageErrors.join('\n')}` : '',
      consoleErrors.length ? `Console errors:\n${consoleErrors.join('\n')}` : '',
      requestFailures.length ? `Request failures:\n${requestFailures.join('\n')}` : ''
    ].filter(Boolean).join('\n\n'))
  }
}

function dumpDiagnostics() {
  if (pageErrors.length) {
    console.error('\nPage errors:')
    for (const entry of pageErrors) {
      console.error(`- ${entry}`)
    }
  }
  if (consoleErrors.length) {
    console.error('\nConsole errors:')
    for (const entry of consoleErrors) {
      console.error(`- ${entry}`)
    }
  }
  if (requestFailures.length) {
    console.error('\nRequest failures:')
    for (const entry of requestFailures) {
      console.error(`- ${entry}`)
    }
  }
}

async function getBookmark(bookmarkId) {
  const page = await ensureExtensionUtilityPage()
  return await page.evaluate(async (id) => {
    const nodes = await new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, (result) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve(result)
      })
    })
    return nodes[0]
  }, bookmarkId)
}

async function waitForBookmarkRemoved(bookmarkId) {
  const page = await ensureExtensionUtilityPage()
  await expect.poll(async () => {
    return await page.evaluate(async (id) => {
      return await new Promise((resolve) => {
        chrome.bookmarks.get(id, () => {
          resolve(Boolean(chrome.runtime.lastError))
        })
      })
    }, bookmarkId)
  }, { timeout: PAGE_TIMEOUT_MS }).toBe(true)
}

async function getStorage(key) {
  const page = await ensureExtensionUtilityPage()
  const result = await page.evaluate(async (storageKey) => {
    return await new Promise((resolve, reject) => {
      chrome.storage.local.get(storageKey, (items) => {
        const error = chrome.runtime.lastError
        if (error) {
          reject(new Error(error.message))
          return
        }
        resolve(items[storageKey])
      })
    })
  }, key)
  return result
}

async function ensureExtensionUtilityPage() {
  const existing = context.pages().find((page) => page.url().startsWith(`chrome-extension://${extensionId}/`))
  if (existing) {
    return existing
  }
  return await newExtensionPage(`chrome-extension://${extensionId}/src/options/options.html`, { width: 1280, height: 900 })
}

async function removeSeedFolder(browserContext, folderId) {
  const page = browserContext.pages().find((candidate) => candidate.url().startsWith(`chrome-extension://${extensionId}/`)) ||
    await browserContext.newPage()

  if (!page.url().startsWith(`chrome-extension://${extensionId}/`)) {
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, { waitUntil: 'domcontentloaded' })
  }

  await page.evaluate(async (id) => {
    await new Promise((resolve) => {
      chrome.bookmarks.removeTree(id, () => {
        resolve()
      })
    })
  }, folderId)
}
