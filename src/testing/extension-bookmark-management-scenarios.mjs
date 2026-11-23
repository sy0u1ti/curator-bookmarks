import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { extensionCommand } from './ego-extension-command.mjs'

const TIMEOUT = 15000

async function ensureNormalWindow(task, page) {
  await page.info()
  const windowInfo = await task.cdp('Browser.getWindowForTarget', { targetId: page.targetId })
  if (windowInfo.bounds.windowState === 'minimized') {
    await task.cdp('Browser.setWindowBounds', { windowId: windowInfo.windowId, bounds: { windowState: 'normal' } })
  }
}

async function setViewport(page, width, height) {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
}

async function settleUi(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getTiming().iterations !== Infinity) {
        try { animation.finish() } catch {}
      }
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

async function waitForSubfolderByTitle(page, parentId, title) {
  await page.waitForFunction(async ({ parentId, title }) => {
    const children = await chrome.bookmarks.getChildren(parentId)
    return children.some((node) => !node.url && node.title === title)
  }, { parentId, title }, { timeout: TIMEOUT })
  return page.evaluate(async ({ parentId, title }) => {
    const children = await chrome.bookmarks.getChildren(parentId)
    return children.find((node) => !node.url && node.title === title) || null
  }, { parentId, title })
}

async function waitForBookmarkTitle(page, bookmarkId, expectedTitle) {
  await page.waitForFunction(async ({ bookmarkId, expectedTitle }) => {
    const nodes = await chrome.bookmarks.get(bookmarkId)
    return nodes[0]?.title === expectedTitle
  }, { bookmarkId, expectedTitle }, { timeout: TIMEOUT })
}

async function waitForBookmarkParent(page, bookmarkId, expectedParentId) {
  await page.waitForFunction(async ({ bookmarkId, expectedParentId }) => {
    const nodes = await chrome.bookmarks.get(bookmarkId)
    return nodes[0]?.parentId === expectedParentId
  }, { bookmarkId, expectedParentId }, { timeout: TIMEOUT })
}

async function waitForDirectBookmarkOrder(page, folderId, expectedIds) {
  await page.waitForFunction(async ({ folderId, expectedIds }) => {
    const children = await chrome.bookmarks.getChildren(folderId)
    const ids = children.filter((node) => node.url).map((node) => node.id)
    return ids.length === expectedIds.length && ids.every((id, index) => id === expectedIds[index])
  }, { folderId, expectedIds }, { timeout: TIMEOUT })
}

async function collectPageErrors(page, label, target) {
  const errors = await page.evaluate(() => window.__curatorQa?.errors || []).catch(() => [])
  for (const message of errors) target.push(`${label}: ${message}`)
}

export async function runExtensionBookmarkManagementChecks(task, config) {
  const management = (await task.pages())[0] ?? await task.newPage()
  await ensureNormalWindow(task, management)
  await management.goto('chrome://extensions/')
  const { id: extensionId } = await extensionCommand(task, management, 'Extensions.loadUnpacked', { path: config.extension })
  const page = await task.newPage()

  const baseUrl = `chrome-extension://${extensionId}`
  const optionsBaseUrl = `${baseUrl}/src/options/options.html`
  const popupUrl = `${baseUrl}/src/popup/popup.html`
  const newtabUrl = `${baseUrl}/src/newtab/newtab.html`
  const output = config.output
  const pageErrors = []
  const report = { engine: 'ego-browser', spaceId: task.spaceId }

  try {
    await setViewport(page, 1440, 900)
    await page.goto(`${optionsBaseUrl}#general`)
    await page.waitForSelector('#options-settings-search', { state: 'visible', timeout: TIMEOUT })

    const seed = await page.evaluate(async () => {
      const tree = await chrome.bookmarks.getTree()
      if (tree[0]?.children?.[0]?.title !== 'QA Bookmarks Bar') {
        throw new Error('Refusing to run against non-isolated bookmarks')
      }
      await chrome.storage.local.set({
        curatorBookmarkOnboardingState: { completed: true, dismissed: true },
        curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
        curatorBookmarkContentSnapshotSettings: { enabled: false },
        curatorModelsDevSync: { autoUpdate: false }
      })
      const workspace = await chrome.bookmarks.create({ parentId: '1', title: '全扩展工作区' })
      const nested = await chrome.bookmarks.create({ parentId: workspace.id, title: '内部子目录' })
      const archiveTarget = await chrome.bookmarks.create({ parentId: '1', title: '归档中转站' })
      const otherFolder = await chrome.bookmarks.create({ parentId: '2', title: '其他资料' })

      const waitTick = () => new Promise((resolve) => setTimeout(resolve, 15))
      const bmZeta = await chrome.bookmarks.create({ parentId: workspace.id, title: 'Zeta 手册', url: 'https://example.com/ext-zeta' })
      await waitTick()
      const bmAlpha = await chrome.bookmarks.create({ parentId: workspace.id, title: 'Alpha 入口', url: 'https://example.com/ext-alpha' })
      await waitTick()
      const bmBeta = await chrome.bookmarks.create({ parentId: workspace.id, title: 'Beta 工具', url: 'https://example.com/ext-beta' })
      await waitTick()
      const bmNested = await chrome.bookmarks.create({ parentId: nested.id, title: '子目录文档', url: 'https://example.com/ext-nested' })
      const bmDupA = await chrome.bookmarks.create({ parentId: archiveTarget.id, title: '重复参考 A', url: 'https://example.com/ext-dup' })
      const bmDupB = await chrome.bookmarks.create({ parentId: otherFolder.id, title: '重复参考 B', url: 'https://example.com/ext-dup' })
      const bmOther = await chrome.bookmarks.create({ parentId: otherFolder.id, title: '其他根书签', url: 'https://example.com/ext-other' })

      await chrome.storage.local.set({
        curatorBookmarkNewTabFolderSettings: {
          selectedFolderIds: [workspace.id, archiveTarget.id],
          browseMode: 'expanded'
        },
        curatorBookmarkNewTabBackgroundSettings: { type: 'color', color: '#101013' }
      })
      return {
        barTitle: tree[0].children[0].title,
        otherTitle: tree[0].children[1].title,
        workspace, nested, archiveTarget, otherFolder,
        bmZeta, bmAlpha, bmBeta, bmNested, bmDupA, bmDupB, bmOther
      }
    })

    // =========================================================================
    // Part 1: Options full-page #bookmarks workspace & cross-panel deep links
    // =========================================================================
    await page.goto(`${optionsBaseUrl}#general`)
    await page.waitForSelector('#options-settings-search', { state: 'visible', timeout: TIMEOUT })

    // Open via SettingsSearch ("全部书签")
    await page.click('#options-settings-search')
    await page.fill('#options-settings-search', '全部书签')
    await page.waitForSelector('.options-settings-search-item:has-text("全部书签") >> nth=0', { state: 'visible', timeout: TIMEOUT })
    await page.click('.options-settings-search-item:has-text("全部书签") >> nth=0')
    await page.waitForSelector('section#bookmarks #popup-root[data-popup-embedded="options"]', { state: 'visible', timeout: TIMEOUT })

    // Sidebar shows All Bookmarks, Bookmarks Bar, and Other Bookmarks
    await page.waitForSelector('[data-folder-row-id="all"]', { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector('[data-folder-row-id="1"]', { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector('[data-folder-row-id="2"]', { state: 'visible', timeout: TIMEOUT })
    await page.click(`[data-folder-row-id="${seed.workspace.id}"] button`)
    await page.waitForSelector(`[data-folder-row-id="${seed.workspace.id}"] button[aria-current="page"]`, { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector(`.popup-main-row[data-bookmark-id="${seed.bmZeta.id}"]`, { state: 'visible', timeout: TIMEOUT })

    // Ultrawide layout check + screenshot (2200x1000): folder tree hugs directly next to
    // the bookmark list (12px gap) and the combined workbench centers cleanly in the stage.
    await setViewport(page, 2200, 1000)
    await settleUi(page)
    const ultrawideMetrics = await page.evaluate(() => {
      const popupRoot = document.querySelector('section#bookmarks #popup-root')?.getBoundingClientRect()
      const folderPane = document.querySelector('section#bookmarks aside[aria-label="文件夹树"]')?.getBoundingClientRect()
      const mainPane = document.querySelector('section#bookmarks .popup-main-pane')?.getBoundingClientRect()
      const searchStage = document.querySelector('section#bookmarks .options-bookmarks-search-stage')?.getBoundingClientRect()
      const favicons = document.querySelectorAll('section#bookmarks .popup-main-row .popup-bookmark-favicon').length
      const folderToMainGap = folderPane && mainPane ? Math.round(mainPane.left - folderPane.right) : -1
      const outerLeftGap = popupRoot && folderPane ? Math.round(folderPane.left - popupRoot.left) : -1
      const outerRightGap = popupRoot && mainPane ? Math.round(popupRoot.right - mainPane.right) : -1
      return {
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        folderWidth: folderPane ? Math.round(folderPane.width) : 0,
        mainWidth: mainPane ? Math.round(mainPane.width) : 0,
        folderToMainGap,
        outerLeftGap,
        outerRightGap,
        searchLeftDiff: searchStage && mainPane ? Math.round(Math.abs(searchStage.left - mainPane.left)) : 999,
        searchRightDiff: searchStage && mainPane ? Math.round(Math.abs(searchStage.right - mainPane.right)) : 999,
        favicons
      }
    })
    assert.ok(ultrawideMetrics.docOverflow <= 2, `Options #bookmarks ultrawide overflowed: ${JSON.stringify(ultrawideMetrics)}`)
    assert.ok(ultrawideMetrics.folderWidth >= 230 && ultrawideMetrics.folderWidth <= 290,
      `Folder sidebar should keep comfortable width on ultrawide: ${JSON.stringify(ultrawideMetrics)}`)
    assert.ok(ultrawideMetrics.mainWidth >= 860 && ultrawideMetrics.mainWidth <= 912,
      `Bookmark pane should stay comfortably bounded (~900px) on ultrawide: ${JSON.stringify(ultrawideMetrics)}`)
    assert.ok(ultrawideMetrics.folderToMainGap >= 10 && ultrawideMetrics.folderToMainGap <= 16,
      `Folder sidebar should hug directly beside the bookmark list: ${JSON.stringify(ultrawideMetrics)}`)
    assert.ok(ultrawideMetrics.outerLeftGap > 100 && Math.abs(ultrawideMetrics.outerLeftGap - ultrawideMetrics.outerRightGap) <= 6,
      `Combined folder + bookmark workbench should center cleanly on ultrawide: ${JSON.stringify(ultrawideMetrics)}`)
    assert.ok(ultrawideMetrics.searchLeftDiff <= 4 && ultrawideMetrics.searchRightDiff <= 4,
      `Top search bar should align with centered bookmark column on ultrawide: ${JSON.stringify(ultrawideMetrics)}`)
    assert.ok(ultrawideMetrics.favicons >= 1, `Options #bookmarks rows should render site favicons: ${JSON.stringify(ultrawideMetrics)}`)
    await page.screenshot({ path: `${output}/00-options-bookmarks-ultrawide.png` })
    report.optionsUltrawide = ultrawideMetrics

    await setViewport(page, 1440, 900)
    // Desktop layout check + screenshot (1440x900)
    await settleUi(page)
    const desktopMetrics = await page.evaluate(() => {
      const section = document.querySelector('section#bookmarks')
      const popupRoot = document.querySelector('section#bookmarks #popup-root')
      const workspace = document.querySelector('section#bookmarks .popup-workspace')
      return {
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        sectionHeight: section ? Math.round(section.getBoundingClientRect().height) : 0,
        popupHeight: popupRoot ? Math.round(popupRoot.getBoundingClientRect().height) : 0,
        workspaceHeight: workspace ? Math.round(workspace.getBoundingClientRect().height) : 0
      }
    })
    assert.ok(desktopMetrics.docOverflow <= 2, `Options #bookmarks desktop overflowed: ${JSON.stringify(desktopMetrics)}`)
    assert.ok(desktopMetrics.workspaceHeight >= 500, `Options #bookmarks workspace should stretch full height: ${JSON.stringify(desktopMetrics)}`)
    await page.screenshot({ path: `${output}/01-options-bookmarks-desktop.png` })
    report.optionsDesktop = desktopMetrics

    // Create folder in Options #bookmarks
    await page.click('#popup-create-folder-button')
    await page.waitForSelector('#folder-modal', { state: 'visible', timeout: TIMEOUT })
    await page.fill('#folder-title-input', '设置页新建目录')
    await page.click('#confirm-folder-modal')
    await page.waitForSelector('#folder-modal', { state: 'hidden', timeout: TIMEOUT })
    const createdInOptions = await waitForSubfolderByTitle(page, seed.workspace.id, '设置页新建目录')
    assert.ok(createdInOptions?.id)

    // Sort folder in Options #bookmarks + Undo via floating activity overlay
    await page.click(`[data-folder-row-id="${seed.workspace.id}"] button`)
    await page.click('#popup-folder-sort-menu')
    await page.click('loc=role:menuitem[name="按名称（A → Z）"]')
    await waitForDirectBookmarkOrder(page, seed.workspace.id, [seed.bmAlpha.id, seed.bmBeta.id, seed.bmZeta.id])
    await page.waitForSelector('.popup-embedded-activity-overlay .popup-activity-card', { state: 'visible', timeout: TIMEOUT })
    await page.click('.popup-embedded-activity-overlay #popup-activity-action')
    await waitForDirectBookmarkOrder(page, seed.workspace.id, [seed.bmZeta.id, seed.bmAlpha.id, seed.bmBeta.id])
    report.optionsSortAndUndo = true

    // Swipe multi-select in Options #bookmarks + batch move to Other Bookmarks + Undo
    await page.click('#popup-selection-mode-toggle')
    await page.waitForSelector('#popup-selection-dock', { state: 'visible', timeout: TIMEOUT })
    const swipeBoxes = await page.evaluate(({ alphaId, betaId }) => {
      const a = document.querySelector(`.popup-main-row[data-bookmark-id="${alphaId}"]`)?.getBoundingClientRect()
      const b = document.querySelector(`.popup-main-row[data-bookmark-id="${betaId}"]`)?.getBoundingClientRect()
      return a && b ? {
        ax: a.left + Math.min(80, a.width * 0.35),
        ay: a.top + a.height / 2,
        bx: b.left + Math.min(80, b.width * 0.35),
        by: b.top + b.height / 2
      } : null
    }, { alphaId: seed.bmAlpha.id, betaId: seed.bmBeta.id })
    assert.ok(swipeBoxes, 'Alpha and Beta rows should have bounding boxes')
    await page.mouse.move(swipeBoxes.ax, swipeBoxes.ay)
    await page.mouse.down()
    await page.mouse.move(swipeBoxes.bx, swipeBoxes.by, { steps: 6 })
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('#popup-selection-dock')?.textContent?.includes('已选 2 项'), undefined, { timeout: TIMEOUT })
    await page.click('#popup-selection-move')
    await page.waitForSelector('#move-modal', { state: 'visible', timeout: TIMEOUT })
    await page.click(`#move-folder-list button[data-select-folder="${seed.otherFolder.id}"]`)
    await page.waitForSelector('#move-modal', { state: 'hidden', timeout: TIMEOUT })
    await waitForBookmarkParent(page, seed.bmAlpha.id, seed.otherFolder.id)
    await waitForBookmarkParent(page, seed.bmBeta.id, seed.otherFolder.id)
    await page.waitForSelector('.popup-embedded-activity-overlay .popup-activity-card', { state: 'visible', timeout: TIMEOUT })
    await page.click('.popup-embedded-activity-overlay #popup-activity-action')
    await waitForBookmarkParent(page, seed.bmAlpha.id, seed.workspace.id)
    await waitForBookmarkParent(page, seed.bmBeta.id, seed.workspace.id)
    report.optionsSwipeBatchMoveAndUndo = true

    // Narrow responsive layout check + screenshot (390x844), including live floating activity overlay & visible 语义 button
    await setViewport(page, 390, 844)
    await page.click('#popup-folder-sort-menu')
    await page.click('loc=role:menuitem[name="按名称（A → Z）"]')
    await waitForDirectBookmarkOrder(page, seed.workspace.id, [seed.bmAlpha.id, seed.bmBeta.id, seed.bmZeta.id])
    await page.waitForSelector('.popup-embedded-activity-overlay #popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    await settleUi(page)
    const narrowMetrics = await page.evaluate(() => {
      const section = document.querySelector('section#bookmarks')
      const searchShell = document.querySelector('section#bookmarks .popup-search-shell')
      const searchInput = document.querySelector('section#bookmarks #search-input')
      const naturalToggle = document.querySelector('section#bookmarks #natural-search-toggle')
      const overlay = document.querySelector('section#bookmarks .popup-embedded-activity-overlay')
      const card = document.querySelector('section#bookmarks .popup-embedded-activity-overlay .popup-activity-card')
      const actionBtn = document.querySelector('section#bookmarks .popup-embedded-activity-overlay #popup-activity-action')
      const dismissBtn = document.querySelector('section#bookmarks .popup-embedded-activity-overlay .popup-activity-dismiss')
      const shellRect = searchShell?.getBoundingClientRect()
      const inputRect = searchInput?.getBoundingClientRect()
      const toggleRect = naturalToggle?.getBoundingClientRect()
      const cardRect = card?.getBoundingClientRect()
      const actionRect = actionBtn?.getBoundingClientRect()
      const dismissRect = dismissBtn?.getBoundingClientRect()
      return {
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        sectionWidth: Math.round(section?.getBoundingClientRect().width || 0),
        sectionScrollWidth: section?.scrollWidth || 0,
        semanticVisible: Boolean(toggleRect && shellRect && toggleRect.width >= 24 && toggleRect.right <= shellRect.right + 2),
        semanticSingleRow: Boolean(toggleRect && inputRect && Math.abs((toggleRect.top + toggleRect.height / 2) - (inputRect.top + inputRect.height / 2)) <= 8),
        overlayRadius: overlay ? getComputedStyle(overlay).borderRadius : '',
        cardHeight: cardRect ? Math.round(cardRect.height) : 0,
        dismissSingleRow: Boolean(actionRect && dismissRect && Math.abs((actionRect.top + actionRect.height / 2) - (dismissRect.top + dismissRect.height / 2)) <= 8)
      }
    })
    assert.ok(narrowMetrics.docOverflow <= 2, `Options #bookmarks narrow overflowed: ${JSON.stringify(narrowMetrics)}`)
    assert.ok(narrowMetrics.sectionScrollWidth <= narrowMetrics.sectionWidth + 2, `Options #bookmarks narrow panel overflowed: ${JSON.stringify(narrowMetrics)}`)
    assert.equal(narrowMetrics.semanticVisible, true, `Semantic toggle must stay visible at 390px: ${JSON.stringify(narrowMetrics)}`)
    assert.equal(narrowMetrics.semanticSingleRow, true, `Semantic toggle must stay on same row at 390px: ${JSON.stringify(narrowMetrics)}`)
    assert.equal(narrowMetrics.overlayRadius, '12px', `Floating activity overlay must keep 12px peer radius: ${JSON.stringify(narrowMetrics)}`)
    assert.equal(narrowMetrics.dismissSingleRow, true, `Activity dismiss button must stay on single row at 390px: ${JSON.stringify(narrowMetrics)}`)
    await page.screenshot({ path: `${output}/02-options-bookmarks-narrow.png` })
    await page.click('.popup-embedded-activity-overlay #popup-activity-action')
    await waitForDirectBookmarkOrder(page, seed.workspace.id, [seed.bmZeta.id, seed.bmAlpha.id, seed.bmBeta.id])
    report.optionsNarrow = narrowMetrics

    // Restore desktop viewport & test cross-panel locate from #duplicates
    await setViewport(page, 1440, 900)
    await page.goto(`${optionsBaseUrl}#duplicates`)
    const dupLocateSelector = `section#duplicates a[href="#bookmarks:bookmark=${seed.bmDupB.id}"] >> nth=0`
    await page.waitForSelector(dupLocateSelector, { state: 'visible', timeout: TIMEOUT })
    await page.click(dupLocateSelector)
    await page.waitForSelector('section#bookmarks #popup-root[data-popup-embedded="options"]', { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector(`[data-folder-row-id="${seed.otherFolder.id}"] button[aria-current="page"]`, { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector(`.popup-main-row[data-bookmark-id="${seed.bmDupB.id}"][data-active="true"]`, { state: 'visible', timeout: TIMEOUT })
    report.optionsDuplicateCrossLink = true

    // Leave #bookmarks -> #general -> verify inputs clean & re-enter #bookmarks cleanly (remount safety)
    await page.click('a[href="#general"] >> nth=0')
    await page.waitForSelector('section#general', { state: 'visible', timeout: TIMEOUT })
    await page.click('#options-settings-search')
    await page.keyboard.type('AI')
    assert.equal(await page.evaluate(() => document.getElementById('options-settings-search')?.value), 'AI')
    assert.equal(await page.evaluate(() => document.querySelectorAll('#folder-modal').length), 0)
    await page.keyboard.press('Escape')
    await page.click('a[href="#bookmarks"] >> nth=0')
    await page.waitForSelector('section#bookmarks #popup-root[data-popup-embedded="options"]', { state: 'visible', timeout: TIMEOUT })
    report.optionsLeaveAndRemount = true
    await collectPageErrors(page, 'options', pageErrors)

    // =========================================================================
    // Part 2: Popup -> Full-Page Bookmark Manager deep-link handoff
    // =========================================================================
    await setViewport(page, 800, 600)
    await page.goto(popupUrl)
    await page.waitForFunction(() =>
      document.getElementById('popup-root')?.dataset.popupReady === 'true' &&
      document.querySelector('.popup-workspace-reveal')?.classList.contains('is-revealed') &&
      document.getElementById('popup-preboot-shell')?.hidden === true,
      undefined,
      { timeout: TIMEOUT }
    )
    await settleUi(page)
    await page.waitForSelector(`[data-folder-row-id="${seed.otherFolder.id}"] button`, { state: 'visible', timeout: TIMEOUT })
    await page.click(`[data-folder-row-id="${seed.otherFolder.id}"] button`)
    await page.evaluate(() => { window.__curatorQa.createdTabs.length = 0 })
    await page.click('#open-bookmark-manager')
    await page.waitForFunction(() => window.__curatorQa.createdTabs.length > 0, undefined, { timeout: TIMEOUT })
    const popupManagerUrl = await page.evaluate(() => window.__curatorQa.createdTabs.at(-1)?.url || '')
    assert.ok(popupManagerUrl.includes(`#bookmarks:folder=${seed.otherFolder.id}`), `Expected manager URL to include folder=${seed.otherFolder.id}, got ${popupManagerUrl}`)
    await collectPageErrors(page, 'popup', pageErrors)

    await setViewport(page, 1440, 900)
    await page.goto(popupManagerUrl)
    await page.waitForSelector(`[data-folder-row-id="${seed.otherFolder.id}"] button[aria-current="page"]`, { state: 'visible', timeout: TIMEOUT })
    await collectPageErrors(page, 'options-handoff', pageErrors)
    report.popupToManagerHandoff = true

    // =========================================================================
    // Part 3: New Tab folder management, blank-canvas new folder, & Undo parity
    // =========================================================================
    await setViewport(page, 1440, 900)
    await page.goto(newtabUrl)
    const workspaceHeaderSel = `[data-folder-drag-handle="${seed.workspace.id}"]`
    await page.waitForSelector(workspaceHeaderSel, { state: 'visible', timeout: TIMEOUT })

    // Blank-canvas right-click -> New Folder
    await page.mouse.click(48, 760, { button: 'right' })
    await page.waitForSelector('.bookmark-add-menu', { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector('.bookmark-add-menu-trigger', { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector('.bookmark-add-folder-trigger', { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector('.bookmark-open-manager-trigger', { state: 'visible', timeout: TIMEOUT })
    await page.click('.bookmark-add-folder-trigger')
    await page.waitForSelector('.bookmark-add-menu input[type="text"] >> nth=0', { state: 'visible', timeout: TIMEOUT })
    await page.fill('.bookmark-add-menu input[type="text"] >> nth=0', '画布新建文件夹')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.bookmark-add-menu', { state: 'hidden', timeout: TIMEOUT })
    const createdFromCanvas = await waitForSubfolderByTitle(page, seed.workspace.id, '画布新建文件夹')
    report.newtabCanvasNewFolder = Boolean(createdFromCanvas?.id)

    // Folder header right-click -> settled screenshot + rename + Undo
    await page.click(workspaceHeaderSel, { button: 'right' })
    await page.waitForSelector('.bookmark-folder-menu', { state: 'visible', timeout: TIMEOUT })
    await settleUi(page)
    await page.screenshot({ path: `${output}/03-newtab-folder-menu.png` })

    await page.fill('.bookmark-folder-menu .bookmark-menu-fields input >> nth=0', '工作区改名版')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.bookmark-folder-menu', { state: 'hidden', timeout: TIMEOUT })
    await waitForBookmarkTitle(page, seed.workspace.id, '工作区改名版')
    await page.waitForSelector('loc=role:button[name*="撤销重命名："]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:button[name*="撤销重命名："]')
    await waitForBookmarkTitle(page, seed.workspace.id, '全扩展工作区')
    report.newtabFolderRenameAndUndo = true

    // Folder header right-click -> create subfolder inline
    await page.click(workspaceHeaderSel, { button: 'right' })
    await page.waitForSelector('.bookmark-folder-menu', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:menuitem[name*="新建子文件夹"]')
    await page.waitForSelector('.bookmark-folder-menu .bookmark-menu-fields input >> nth=1', { state: 'visible', timeout: TIMEOUT })
    await page.fill('.bookmark-folder-menu .bookmark-menu-fields input >> nth=1', '右键新建子目录')
    await page.keyboard.press('Enter')
    await waitForSubfolderByTitle(page, seed.workspace.id, '右键新建子目录')
    await page.keyboard.press('Escape')
    await page.waitForSelector('.bookmark-folder-menu', { state: 'hidden', timeout: TIMEOUT })
    report.newtabCreateSubfolder = true

    // Folder header right-click -> 5-mode Sort submenu + Undo
    await page.click(workspaceHeaderSel, { button: 'right' })
    await page.waitForSelector('.bookmark-folder-menu', { state: 'visible', timeout: TIMEOUT })
    await page.hover('loc=role:menuitem[name*="排序文件夹书签"]')
    await page.waitForSelector('loc=role:menuitem[name*="按名称（A → Z）"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:menuitem[name*="按名称（A → Z）"]')
    await page.waitForSelector('.bookmark-folder-menu', { state: 'hidden', timeout: TIMEOUT })
    await waitForDirectBookmarkOrder(page, seed.workspace.id, [seed.bmAlpha.id, seed.bmBeta.id, seed.bmZeta.id])
    await page.waitForSelector('loc=role:button[name*="撤销排序："]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:button[name*="撤销排序："]')
    await waitForDirectBookmarkOrder(page, seed.workspace.id, [seed.bmZeta.id, seed.bmAlpha.id, seed.bmBeta.id])
    report.newtabFolderSortAndUndo = true

    // Folder header right-click -> Move folder (circular-move guard) + Undo
    await page.click(workspaceHeaderSel, { button: 'right' })
    await page.waitForSelector('.bookmark-folder-menu', { state: 'visible', timeout: TIMEOUT })
    await page.hover('loc=role:menuitem[name*="移动文件夹"]')
    const barItemSel = `[data-newtab-bookmark-menu-surface] [role="menuitem"]:has-text("${seed.barTitle}") >> nth=0`
    await page.waitForSelector(barItemSel, { state: 'visible', timeout: TIMEOUT })
    await page.hover(barItemSel)
    const archiveMoveSel = '[data-newtab-bookmark-menu-surface] [role="menuitem"]:has-text("归档中转站") >> nth=0'
    await page.waitForSelector(archiveMoveSel, { state: 'visible', timeout: TIMEOUT })
    const selfCount = await page.evaluate(() =>
      [...document.querySelectorAll('[data-newtab-bookmark-menu-surface] [role="menuitem"]')]
        .filter((el) => el.textContent?.includes('全扩展工作区')).length
    )
    assert.equal(selfCount, 0, 'Folder move submenu must omit self and descendants')
    await page.click(archiveMoveSel)
    await page.waitForSelector('.bookmark-folder-menu', { state: 'hidden', timeout: TIMEOUT })
    await waitForBookmarkParent(page, seed.workspace.id, seed.archiveTarget.id)
    await page.waitForSelector('loc=role:button[name*="撤销移动文件夹："]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:button[name*="撤销移动文件夹："]')
    await waitForBookmarkParent(page, seed.workspace.id, '1')
    report.newtabFolderMoveGuardAndUndo = true

    // Bookmark right-click -> Edit + Undo
    const alphaTileSel = `.bookmark-tile[data-bookmark-id="${seed.bmAlpha.id}"] >> nth=0`
    await page.click(alphaTileSel, { button: 'right' })
    await page.waitForSelector('.bookmark-edit-menu', { state: 'visible', timeout: TIMEOUT })
    await page.fill('.bookmark-edit-menu .bookmark-menu-fields input >> nth=0', 'Alpha 已编辑')
    await page.keyboard.press('Enter')
    await waitForBookmarkTitle(page, seed.bmAlpha.id, 'Alpha 已编辑')
    await page.keyboard.press('Escape')
    await page.waitForSelector('.bookmark-edit-menu', { state: 'hidden', timeout: TIMEOUT })
    await page.waitForSelector('loc=role:button[name*="撤销编辑："]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:button[name*="撤销编辑："]')
    await waitForBookmarkTitle(page, seed.bmAlpha.id, 'Alpha 入口')
    report.newtabBookmarkEditUndo = true

    // Bookmark right-click -> Locate in Manager opens #bookmarks:bookmark=<id>
    await page.click(alphaTileSel, { button: 'right' })
    await page.waitForSelector('.bookmark-edit-menu', { state: 'visible', timeout: TIMEOUT })
    await page.evaluate(() => { window.__curatorQa.createdTabs.length = 0 })
    await page.click('loc=role:menuitem[name*="在全部书签中定位"]')
    await page.waitForFunction(() => window.__curatorQa.createdTabs.length > 0, undefined, { timeout: TIMEOUT })
    const locatedUrl = await page.evaluate(() => window.__curatorQa.createdTabs.at(-1)?.url || '')
    assert.ok(locatedUrl.includes(`#bookmarks:bookmark=${seed.bmAlpha.id}`), `Expected locate URL to include bookmark=${seed.bmAlpha.id}, got ${locatedUrl}`)
    report.newtabLocateInManager = true

    // Bookmark right-click -> Move bookmark + Undo back to original folder
    await page.click(alphaTileSel, { button: 'right' })
    await page.waitForSelector('.bookmark-edit-menu', { state: 'visible', timeout: TIMEOUT })
    await page.hover('loc=role:menuitem[name*="移动书签："]')
    await page.waitForSelector(barItemSel, { state: 'visible', timeout: TIMEOUT })
    await page.hover(barItemSel)
    await page.waitForSelector(archiveMoveSel, { state: 'visible', timeout: TIMEOUT })
    await page.click(archiveMoveSel)
    await waitForBookmarkParent(page, seed.bmAlpha.id, seed.archiveTarget.id)
    await page.keyboard.press('Escape')
    await page.waitForSelector('.bookmark-edit-menu', { state: 'hidden', timeout: TIMEOUT })
    await page.waitForSelector('loc=role:button[name*="撤销移动："]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:button[name*="撤销移动："]')
    await waitForBookmarkParent(page, seed.bmAlpha.id, seed.workspace.id)
    report.newtabBookmarkMoveUndo = true

    // Delete folder (2-step arm + confirm) -> Recycle Bin + settled Undo toast screenshot + full subtree restore
    const archiveHeaderSel = `[data-folder-drag-handle="${seed.archiveTarget.id}"]`
    await page.click(archiveHeaderSel, { button: 'right' })
    await page.waitForSelector('.bookmark-folder-menu', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:menuitem[name*="删除文件夹"]')
    await page.waitForSelector('loc=role:menuitem[name*="确认删除文件夹"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:menuitem[name*="确认删除文件夹"]')
    await page.waitForSelector('.bookmark-folder-menu', { state: 'hidden', timeout: TIMEOUT })
    const deleteUndoSel = 'loc=role:button[name*="撤销删除文件夹："]'
    await page.waitForSelector(deleteUndoSel, { state: 'visible', timeout: TIMEOUT })
    await settleUi(page)
    await page.screenshot({ path: `${output}/04-newtab-undo-toast.png` })
    await page.click(deleteUndoSel)
    await page.waitForSelector(deleteUndoSel, { state: 'hidden', timeout: TIMEOUT })
    const restoredArchive = await waitForSubfolderByTitle(page, '1', '归档中转站')
    const restoredChildren = await page.evaluate((id) => chrome.bookmarks.getChildren(id), restoredArchive.id)
    assert.ok(restoredChildren.some((child) => child.url === 'https://example.com/ext-dup'), 'Restored folder subtree must contain its bookmarks')
    report.newtabDeleteFolderAndUndo = true

    // SettingsDrawer -> Sources tab stays focused on folder sources without redundant full-manager button
    await page.click('.settings-trigger')
    await page.waitForSelector('#folder-candidates-toggle', { state: 'visible', timeout: TIMEOUT })
    const hasRedundantDrawerManagerButton = await page.evaluate(() => Boolean(document.getElementById('settings-open-bookmark-manager')))
    assert.equal(hasRedundantDrawerManagerButton, false, 'New Tab SettingsDrawer must not show redundant open-bookmark-manager button')
    report.newtabDrawerNoRedundantManagerButton = true
    await collectPageErrors(page, 'newtab', pageErrors)

    // Verify the locate URL emitted from New Tab lands directly on the highlighted bookmark in Options #bookmarks
    await page.goto(locatedUrl)
    await page.waitForSelector('section#bookmarks #popup-root[data-popup-embedded="options"]', { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector(`.popup-main-row[data-bookmark-id="${seed.bmAlpha.id}"][data-active="true"]`, { state: 'visible', timeout: TIMEOUT })
    report.newtabLocateLandingVerified = true
    await collectPageErrors(page, 'options-locate-landing', pageErrors)

    assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join('; ')}`)
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
    return report
  } catch (error) {
    await collectPageErrors(page, 'failure', pageErrors)
    const diag = await page.evaluate(() => ({
      url: location.href,
      sectionKey: document.querySelector('#options-main')?.getAttribute('data-section-key') || '',
      visibilityState: document.visibilityState,
      hasFocus: document.hasFocus(),
      activeEl: document.activeElement ? `${document.activeElement.tagName}#${document.activeElement.id}.${document.activeElement.className}` : null,
      popupReady: document.getElementById('popup-root')?.getAttribute('data-popup-ready'),
      prebootHidden: document.getElementById('popup-preboot-shell')?.hidden,
      searchInput: (() => {
        const el = document.getElementById('search-input')
        if (!el) return null
        const cs = getComputedStyle(el)
        return { disabled: el.disabled, visibility: cs.visibility, display: cs.display, inert: Boolean(el.closest('[inert]')) }
      })(),
      bodySnippet: (document.querySelector('#options-main')?.innerText || document.body.innerText || '').slice(0, 260)
    })).catch(() => ({}))
    await writeFile(`${output}/failure.json`, JSON.stringify({ error: error.message, pageErrors, report, diag }, null, 2)).catch(() => {})
    console.error('Ego E2E failure diagnostics:', JSON.stringify({ pageErrors, report, diag }, null, 2))
    throw error
  } finally {
    await page.cdp('Emulation.clearDeviceMetricsOverride').catch(() => {})
    await extensionCommand(task, management, 'Extensions.uninstall', { id: extensionId }).catch(() => {})
  }
}
