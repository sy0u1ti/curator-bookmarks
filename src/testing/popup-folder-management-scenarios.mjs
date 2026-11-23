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

async function collectPageErrors(page, label, target) {
  const errors = await page.evaluate(() => window.__curatorQa?.errors || []).catch(() => [])
  for (const message of errors) target.push(`${label}: ${message}`)
}

async function waitForDockText(page, substring) {
  await page.waitForFunction(
    (text) => (document.getElementById('popup-selection-dock')?.textContent || '').includes(text),
    substring,
    { timeout: TIMEOUT }
  )
}

export async function runPopupFolderManagementChecks(task, config) {
  const management = (await task.pages())[0] ?? await task.newPage()
  await ensureNormalWindow(task, management)
  await management.goto('chrome://extensions/')
  const { id: extensionId } = await extensionCommand(task, management, 'Extensions.loadUnpacked', { path: config.extension })
  const page = await task.newPage()

  const baseUrl = `chrome-extension://${extensionId}`
  const popupUrl = `${baseUrl}/src/popup/popup.html`
  const sidepanelUrl = `${baseUrl}/src/sidepanel/sidepanel.html`
  const output = config.output
  const pageErrors = []
  const report = { engine: 'ego-browser', spaceId: task.spaceId }

  try {
    await setViewport(page, 800, 600)
    await page.goto(popupUrl)
    await page.waitForFunction(() =>
      document.getElementById('popup-root')?.dataset.popupReady === 'true' &&
      document.getElementById('popup-preboot-shell')?.hidden === true,
      undefined,
      { timeout: TIMEOUT }
    )

    const seed = await page.evaluate(async () => {
      const tree = await chrome.bookmarks.getTree()
      if (tree[0]?.children?.[0]?.title !== 'QA Bookmarks Bar') {
        throw new Error('Refusing to modify non-isolated bookmarks')
      }
      await chrome.storage.local.set({
        curatorBookmarkOnboardingState: { completed: true, dismissed: true },
        curatorBookmarkAiNamingSettings: { autoAnalyzeBookmarks: false },
        curatorBookmarkContentSnapshotSettings: { enabled: false },
        curatorModelsDevSync: { autoUpdate: false }
      })

      const archiveTarget = await chrome.bookmarks.create({ parentId: '1', title: '归档目标' })
      const deleteFolder = await chrome.bookmarks.create({ parentId: '1', title: '待删项目' })
      const deleteSubfolder = await chrome.bookmarks.create({ parentId: deleteFolder.id, title: '内部文档' })
      const deleteDocA = await chrome.bookmarks.create({
        parentId: deleteFolder.id,
        title: '文档 A',
        url: 'https://example.com/doc-a'
      })
      const deleteDocB = await chrome.bookmarks.create({
        parentId: deleteSubfolder.id,
        title: '文档 B',
        url: 'https://example.com/doc-b'
      })

      const sortFolder = await chrome.bookmarks.create({ parentId: '1', title: '排序实验室' })
      const waitTick = () => new Promise((resolve) => setTimeout(resolve, 15))
      const sortSubfolder = await chrome.bookmarks.create({ parentId: sortFolder.id, title: '保留子目录' })
      await waitTick()
      const bmZeta10 = await chrome.bookmarks.create({ parentId: sortFolder.id, title: 'Zeta 10', url: 'https://example.com/zeta-10' })
      await waitTick()
      const bmAlpha = await chrome.bookmarks.create({ parentId: sortFolder.id, title: 'Alpha 指南', url: 'https://example.com/alpha' })
      await waitTick()
      const bmBeta = await chrome.bookmarks.create({ parentId: sortFolder.id, title: 'Beta 工具', url: 'https://example.com/beta' })
      await waitTick()
      const bmZeta2 = await chrome.bookmarks.create({ parentId: sortFolder.id, title: 'Zeta 2', url: 'https://example.com/zeta-2' })
      await chrome.bookmarks.move(sortSubfolder.id, { parentId: sortFolder.id, index: 3 })

      await chrome.storage.local.set({
        curatorBookmarkNewTabActivity: {
          pinnedIds: [],
          records: {
            [bmBeta.id]: {
              bookmarkId: bmBeta.id,
              title: bmBeta.title,
              url: bmBeta.url,
              openCount: 12,
              firstOpenedAt: 1000,
              lastOpenedAt: 5000
            },
            [bmZeta2.id]: {
              bookmarkId: bmZeta2.id,
              title: bmZeta2.title,
              url: bmZeta2.url,
              openCount: 4,
              firstOpenedAt: 1000,
              lastOpenedAt: 4000
            },
            [bmZeta10.id]: {
              bookmarkId: bmZeta10.id,
              title: bmZeta10.title,
              url: bmZeta10.url,
              openCount: 1,
              firstOpenedAt: 1000,
              lastOpenedAt: 2000
            }
          }
        }
      })

      return {
        archiveTarget,
        deleteFolder,
        deleteSubfolder,
        deleteDocA,
        deleteDocB,
        sortFolder,
        sortSubfolder,
        sortBookmarks: { bmZeta10, bmAlpha, bmBeta, bmZeta2 }
      }
    })

    // Reload popup cleanly after seeding so initial tree, activity cache & layout hydrate fresh.
    await page.goto(popupUrl)
    await page.waitForFunction(() => {
      const workspace = document.querySelector('.popup-workspace-reveal')
      return document.getElementById('popup-root')?.dataset.popupReady === 'true' &&
        document.getElementById('popup-preboot-shell')?.hidden === true &&
        workspace?.getAttribute('data-state') === 'ready' &&
        document.querySelectorAll('.t-skel-content .popup-folder-tree [role="treeitem"]').length >= 4
    }, undefined, { timeout: TIMEOUT })
    await settleUi(page)

    const folderHeaderHeight = await page.evaluate(
      () => document.querySelector('.t-skel-content aside[aria-label="文件夹树"] > header')?.getBoundingClientRect().height || 0
    )
    assert.equal(Math.round(folderHeaderHeight), 42, `folder pane header must stay 42px, got ${folderHeaderHeight}`)

    // 1. Create folder via folder pane "+" button.
    await page.click('.t-skel-content #popup-create-folder-button')
    await page.waitForSelector('#folder-modal', { state: 'visible', timeout: TIMEOUT })
    assert.equal(await page.evaluate(() => Boolean(document.getElementById('confirm-folder-modal')?.disabled)), true, 'empty folder title cannot be created')
    await page.fill('#folder-title-input', '工程实验室')
    await page.keyboard.press('Enter')
    await page.waitForSelector('#folder-modal', { state: 'hidden', timeout: TIMEOUT })
    const createdFolder = await page.evaluate(async () => {
      const children = await chrome.bookmarks.getChildren('1')
      return children.find((node) => !node.url && node.title === '工程实验室') || null
    })
    assert.ok(createdFolder, 'new folder must be created in Chrome bookmarks')
    await page.waitForSelector(`.t-skel-content [data-folder-row-id="${createdFolder.id}"] button`, { state: 'visible', timeout: TIMEOUT })
    report.createFolder = true

    // 1b. Create folder with parent switcher: choose "其他书签" ('2') inside Create Folder dialog.
    await page.click('.t-skel-content #popup-create-folder-button')
    await page.waitForSelector('#folder-modal', { state: 'visible', timeout: TIMEOUT })
    await page.click('#folder-parent-picker-button')
    await page.waitForSelector('#folder-parent-picker', { state: 'visible', timeout: TIMEOUT })
    await settleUi(page)
    await page.screenshot({ path: `${output}/05-create-folder-parent-picker.png` })
    await page.click('#folder-parent-list button[data-folder-create-select="2"]')
    await page.waitForSelector('#folder-parent-picker', { state: 'hidden', timeout: TIMEOUT })
    const modalPathText = await page.evaluate(() => document.getElementById('folder-modal-path')?.textContent || '')
    assert.match(modalPathText, /其他书签|Other Bookmarks/)
    await page.fill('#folder-title-input', '其他收件箱')
    await page.click('#confirm-folder-modal')
    await page.waitForSelector('#folder-modal', { state: 'hidden', timeout: TIMEOUT })
    const otherInboxFolder = await page.evaluate(async () => {
      const children = await chrome.bookmarks.getChildren('2')
      return children.find((node) => !node.url && node.title === '其他收件箱') || null
    })
    assert.ok(otherInboxFolder, 'new folder must be created under Other Bookmarks via parent switcher')
    await page.waitForSelector(`.t-skel-content [data-folder-row-id="${otherInboxFolder.id}"] button`, { state: 'visible', timeout: TIMEOUT })
    report.createFolderParentSwitcher = true

    // 2. Right-click context menu: create subfolder, then rename parent folder + Undo.
    const createdFolderBtn = `.t-skel-content [data-folder-row-id="${createdFolder.id}"] button`
    await page.click(createdFolderBtn, { button: 'right' })
    await page.waitForSelector('#popup-folder-context-menu', { state: 'visible', timeout: TIMEOUT })
    await settleUi(page)
    await page.screenshot({ path: `${output}/01-folder-context-menu.png` })
    await page.click('#popup-folder-context-menu [data-folder-context-action="create"]')
    await page.waitForSelector('#folder-modal', { state: 'visible', timeout: TIMEOUT })
    await page.fill('#folder-title-input', '子目录 Alpha')
    await page.click('#confirm-folder-modal')
    await page.waitForSelector('#folder-modal', { state: 'hidden', timeout: TIMEOUT })
    const createdSubfolder = await page.evaluate(async (parentId) => {
      const children = await chrome.bookmarks.getChildren(parentId)
      return children.find((node) => !node.url && node.title === '子目录 Alpha') || null
    }, createdFolder.id)
    assert.ok(createdSubfolder, 'subfolder must be created under the right-clicked folder')

    await page.click(createdFolderBtn, { button: 'right' })
    await page.waitForSelector('#popup-folder-context-menu [data-folder-context-action="rename"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-folder-context-menu [data-folder-context-action="rename"]')
    await page.waitForSelector('#folder-modal', { state: 'visible', timeout: TIMEOUT })
    assert.equal(await page.evaluate(() => document.getElementById('folder-title-input')?.value || ''), '工程实验室')
    await page.fill('#folder-title-input', '研发工作台')
    await page.click('#confirm-folder-modal')
    await page.waitForSelector('#folder-modal', { state: 'hidden', timeout: TIMEOUT })
    const renamedTitle = await page.evaluate(async (id) => (await chrome.bookmarks.get(id))[0]?.title, createdFolder.id)
    assert.equal(renamedTitle, '研发工作台', 'folder must be renamed')

    // Verify folder rename Undo roundtrip.
    await page.waitForSelector('#popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-activity-action')
    await page.waitForFunction(async (id) => (await chrome.bookmarks.get(id))[0]?.title === '工程实验室', createdFolder.id, { timeout: TIMEOUT })
    await page.click(createdFolderBtn, { button: 'right' })
    await page.waitForSelector('#popup-folder-context-menu [data-folder-context-action="rename"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-folder-context-menu [data-folder-context-action="rename"]')
    await page.waitForSelector('#folder-modal', { state: 'visible', timeout: TIMEOUT })
    await page.fill('#folder-title-input', '研发工作台')
    await page.click('#confirm-folder-modal')
    await page.waitForSelector('#folder-modal', { state: 'hidden', timeout: TIMEOUT })
    report.subfolderAndRename = true

    // 3. Move folder and verify self & descendant targets are blocked.
    await page.click(createdFolderBtn, { button: 'right' })
    await page.waitForSelector('#popup-folder-context-menu [data-folder-context-action="move"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-folder-context-menu [data-folder-context-action="move"]')
    await page.waitForSelector('#move-modal', { state: 'visible', timeout: TIMEOUT })
    assert.equal(await page.evaluate(() => document.getElementById('move-modal-title')?.textContent?.trim()), '移动文件夹')
    assert.equal(
      await page.evaluate((id) => Boolean(document.querySelector(`#move-folder-list button[data-select-folder="${id}"]`)?.disabled), createdFolder.id),
      true,
      'cannot move a folder into itself'
    )
    await page.click('#move-folder-list button[data-select-folder="2"]')
    await page.waitForSelector('#move-modal', { state: 'hidden', timeout: TIMEOUT })
    const movedToOtherParentId = await page.evaluate(async (id) => (await chrome.bookmarks.get(id))[0]?.parentId, createdFolder.id)
    assert.equal(movedToOtherParentId, '2', 'folder must move into Other Bookmarks')
    await page.waitForSelector('.t-skel-content [data-folder-row-id="2"] button', { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector(createdFolderBtn, { state: 'visible', timeout: TIMEOUT })
    await page.waitForSelector('#popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-activity-action')
    await page.waitForFunction(async (id) => (await chrome.bookmarks.get(id))[0]?.parentId === '1', createdFolder.id, { timeout: TIMEOUT })
    await page.click(createdFolderBtn, { button: 'right' })
    await page.waitForSelector('#popup-folder-context-menu [data-folder-context-action="move"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-folder-context-menu [data-folder-context-action="move"]')
    await page.waitForSelector('#move-modal', { state: 'visible', timeout: TIMEOUT })
    await page.click(`#move-folder-list button[data-select-folder="${seed.archiveTarget.id}"]`)
    await page.waitForSelector('#move-modal', { state: 'hidden', timeout: TIMEOUT })
    const movedParentId = await page.evaluate(async (id) => (await chrome.bookmarks.get(id))[0]?.parentId, createdFolder.id)
    assert.equal(movedParentId, seed.archiveTarget.id, 'folder must move into target folder')
    report.moveFolder = true

    // 4. Delete folder with nested subfolder + bookmarks -> Cancel focus, Recycle Bin, full subtree Undo.
    await page.click(`.t-skel-content [data-folder-row-id="${seed.deleteFolder.id}"] button`)
    await page.waitForSelector('.t-skel-content #popup-folder-actions-menu', { state: 'visible', timeout: TIMEOUT })
    await page.click('.t-skel-content #popup-folder-actions-menu')
    await page.waitForSelector('loc=role:menuitem[name="删除文件夹"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:menuitem[name="删除文件夹"]')
    await page.waitForSelector('#folder-modal', { state: 'visible', timeout: TIMEOUT })
    await page.waitForFunction(() => document.activeElement?.id === 'cancel-folder-modal', undefined, { timeout: TIMEOUT })
    await settleUi(page)
    await page.screenshot({ path: `${output}/02-folder-delete-confirm.png` })
    const summaryText = await page.evaluate(() => document.getElementById('delete-folder-summary')?.textContent || '')
    assert.match(summaryText, /1 个子文件夹/)
    assert.match(summaryText, /2 个书签/)
    await page.click('#confirm-folder-modal')
    await page.waitForSelector('#folder-modal', { state: 'hidden', timeout: TIMEOUT })
    await page.waitForSelector('#popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    const afterDeleteState = await page.evaluate(async (folderId) => {
      let exists = true
      try {
        await chrome.bookmarks.get(folderId)
      } catch {
        exists = false
      }
      const stored = await chrome.storage.local.get('curatorBookmarkRecycleBin')
      const recycleItems = Array.isArray(stored.curatorBookmarkRecycleBin) ? stored.curatorBookmarkRecycleBin : []
      return {
        exists,
        recycleUrls: recycleItems.map((item) => item.url)
      }
    }, seed.deleteFolder.id)
    assert.equal(afterDeleteState.exists, false, 'deleted folder must be removed from Chrome tree')
    assert.ok(afterDeleteState.recycleUrls.includes('https://example.com/doc-a'), 'direct bookmark must be archived in Recycle Bin')
    assert.ok(afterDeleteState.recycleUrls.includes('https://example.com/doc-b'), 'nested bookmark must be archived in Recycle Bin')

    await page.click('#popup-activity-action')
    await page.waitForFunction(async () => {
      const children = await chrome.bookmarks.getChildren('1')
      return children.some((node) => !node.url && node.title === '待删项目')
    }, undefined, { timeout: TIMEOUT })
    const restoredSubtree = await page.evaluate(async () => {
      const barChildren = await chrome.bookmarks.getChildren('1')
      const folder = barChildren.find((node) => !node.url && node.title === '待删项目')
      const tree = folder ? (await chrome.bookmarks.getSubTree(folder.id))[0] : null
      const sub = tree?.children?.find((node) => !node.url && node.title === '内部文档')
      return {
        directTitles: (tree?.children || []).filter((n) => n.url).map((n) => n.title),
        subTitles: (sub?.children || []).filter((n) => n.url).map((n) => n.title)
      }
    })
    assert.deepEqual(restoredSubtree.directTitles, ['文档 A'])
    assert.deepEqual(restoredSubtree.subTitles, ['文档 B'])
    report.deleteFolderAndUndo = true

    // 5. One-click folder sorting (title A->Z + Undo, frequency + live background-open activity) + interleaved subfolder preserved.
    await page.click(`.t-skel-content [data-folder-row-id="${seed.sortFolder.id}"] button`)
    await page.waitForSelector(`.t-skel-content .popup-main-row[data-bookmark-id="${seed.sortBookmarks.bmZeta10.id}"]`, { state: 'visible', timeout: TIMEOUT })
    const readSortChildren = () => page.evaluate(async (folderId) => {
      const children = await chrome.bookmarks.getChildren(folderId)
      return children.map((node) => ({ title: node.title, isFolder: !node.url }))
    }, seed.sortFolder.id)
    const initialOrder = await readSortChildren()
    assert.equal(initialOrder[2].title, '保留子目录', 'subfolder starts at index 2')

    await page.click('.t-skel-content #popup-folder-sort-menu')
    await page.waitForSelector('loc=role:menuitem[name="按名称（A → Z）"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:menuitem[name="按名称（A → Z）"]')
    await page.waitForSelector('#popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    const afterAsc = await readSortChildren()
    assert.deepEqual(
      afterAsc.filter((item) => !item.isFolder).map((item) => item.title),
      ['Alpha 指南', 'Beta 工具', 'Zeta 2', 'Zeta 10'],
      'title A->Z sort must apply natural numeric collation'
    )
    assert.equal(afterAsc[2].title, '保留子目录', 'interleaved subfolder slot must stay untouched after sort')

    await page.click('#popup-activity-action')
    await page.waitForFunction(async ({ folderId, firstTitle }) => {
      const children = await chrome.bookmarks.getChildren(folderId)
      return children.filter((node) => node.url)[0]?.title === firstTitle
    }, { folderId: seed.sortFolder.id, firstTitle: initialOrder.filter((item) => !item.isFolder)[0].title }, { timeout: TIMEOUT })
    assert.deepEqual(await readSortChildren(), initialOrder, 'undoing sort must restore exact original layout')
    await settleUi(page)

    await page.click('.t-skel-content #popup-folder-sort-menu')
    await page.waitForSelector('loc=role:menuitem[name="按常点程度（最常访问在前）"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:menuitem[name="按常点程度（最常访问在前）"]')
    await page.waitForFunction(
      () => (document.getElementById('popup-activity')?.textContent || '').includes('已按常点程度排序'),
      undefined,
      { timeout: TIMEOUT }
    )
    const afterFreq = await readSortChildren()
    assert.deepEqual(
      afterFreq.filter((item) => !item.isFolder).map((item) => item.title),
      ['Beta 工具', 'Zeta 2', 'Zeta 10', 'Alpha 指南'],
      'frequency sort must rank by openCount'
    )

    // Opening a bookmark in background twice records activity into activity-repository,
    // elevating Alpha (openCount=2) above Zeta 10 (openCount=1).
    await page.click('.popup-activity-dismiss')
    await page.waitForSelector('.popup-activity-card', { state: 'hidden', timeout: TIMEOUT })
    await page.mouse.move(10, 300)
    const alphaRowButtonSel = `.t-skel-content .popup-main-row[data-bookmark-id="${seed.sortBookmarks.bmAlpha.id}"] button >> nth=0`
    await page.focus(alphaRowButtonSel)
    await page.keyboard.press('Control+Enter')
    await page.waitForFunction(
      () => (document.querySelector('.popup-activity-card')?.textContent || '').includes('已在后台打开'),
      undefined,
      { timeout: TIMEOUT }
    )
    await page.waitForFunction(async () => {
      const stored = await chrome.storage.local.get('curatorBookmarkNewTabActivity')
      return (stored.curatorBookmarkNewTabActivity?.recordCount || 0) >= 4
    }, undefined, { timeout: TIMEOUT })
    const firstOpenUpdatedAt = await page.evaluate(async () => {
      const stored = await chrome.storage.local.get('curatorBookmarkNewTabActivity')
      return Number(stored.curatorBookmarkNewTabActivity?.updatedAt || 0)
    })
    await page.focus(alphaRowButtonSel)
    await page.keyboard.press('Control+Enter')
    await page.waitForFunction(async (previousUpdatedAt) => {
      const stored = await chrome.storage.local.get('curatorBookmarkNewTabActivity')
      return Number(stored.curatorBookmarkNewTabActivity?.updatedAt || 0) > previousUpdatedAt
    }, firstOpenUpdatedAt, { timeout: TIMEOUT })
    await page.click('.t-skel-content #popup-folder-sort-menu')
    await page.waitForSelector('loc=role:menuitem[name="按常点程度（最常访问在前）"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('loc=role:menuitem[name="按常点程度（最常访问在前）"]')
    await page.waitForFunction(async (folderId) => {
      const children = await chrome.bookmarks.getChildren(folderId)
      const titles = children.filter((node) => node.url).map((node) => node.title)
      return titles.indexOf('Alpha 指南') < titles.indexOf('Zeta 10')
    }, seed.sortFolder.id, { timeout: TIMEOUT })
    report.sortAndActivity = true

    // 6. Multi-select in folder view: fixed 60px rows, pointer drag/swipe select & deselect, Shift range select, batch move + Undo.
    await page.click('.t-skel-content #popup-selection-mode-toggle')
    await page.waitForSelector('#popup-selection-dock', { state: 'visible', timeout: TIMEOUT })
    const selectHeights = await page.evaluate(() =>
      [...document.querySelectorAll('.t-skel-content .popup-main-row')].map((row) => Math.round(row.getBoundingClientRect().height))
    )
    assert.ok(selectHeights.every((height) => Math.abs(height - 60) <= 1), `selection mode must keep 60px rows, got ${selectHeights}`)

    const swipePoints = await page.evaluate(() =>
      [...document.querySelectorAll('.t-skel-content .popup-main-row')].map((row) => {
        const rect = row.getBoundingClientRect()
        return { x: rect.left + Math.min(80, rect.width * 0.35), y: rect.top + rect.height / 2 }
      })
    )
    assert.ok(swipePoints.length >= 4, 'sort folder should display 4 bookmarks for swipe-select test')

    await page.mouse.move(swipePoints[0].x, swipePoints[0].y)
    await page.mouse.down()
    await page.mouse.move(swipePoints[3].x, swipePoints[3].y, { steps: 8 })
    await waitForDockText(page, '已选 4 项')
    await page.mouse.move(swipePoints[2].x, swipePoints[2].y, { steps: 4 })
    await waitForDockText(page, '已选 3 项')
    await page.mouse.up()
    await settleUi(page)
    await waitForDockText(page, '已选 3 项')

    await page.mouse.move(swipePoints[0].x, swipePoints[0].y)
    await page.mouse.down()
    await page.mouse.move(swipePoints[1].x, swipePoints[1].y, { steps: 6 })
    await waitForDockText(page, '已选 1 项')
    await page.mouse.up()
    await settleUi(page)
    await waitForDockText(page, '已选 1 项')

    await page.mouse.click(swipePoints[2].x, swipePoints[2].y)
    await waitForDockText(page, '点选或拖滑选择')
    report.swipeSelectAndDeselect = true

    await page.mouse.click(swipePoints[0].x, swipePoints[0].y)
    await page.keyboard.down('Shift')
    await page.mouse.click(swipePoints[2].x, swipePoints[2].y)
    await page.keyboard.up('Shift')
    await waitForDockText(page, '已选 3 项')
    await settleUi(page)
    await page.screenshot({ path: `${output}/03-multi-select-dock.png` })

    await page.click('#popup-selection-move')
    await page.waitForSelector('#move-modal', { state: 'visible', timeout: TIMEOUT })
    assert.equal(await page.evaluate(() => document.getElementById('move-modal-title')?.textContent?.trim()), '批量移动书签')
    await page.click(`#move-folder-list button[data-select-folder="${seed.archiveTarget.id}"]`)
    await page.waitForSelector('#move-modal', { state: 'hidden', timeout: TIMEOUT })
    await page.waitForSelector('#popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    const movedBatchCount = await page.evaluate(async (targetId) => {
      const children = await chrome.bookmarks.getChildren(targetId)
      return children.filter((node) => node.url).length
    }, seed.archiveTarget.id)
    assert.equal(movedBatchCount, 3, 'all 3 selected bookmarks must move into target folder')

    await page.click('#popup-activity-action')
    await page.waitForFunction(async (folderId) => {
      const children = await chrome.bookmarks.getChildren(folderId)
      return children.filter((node) => node.url).length === 4
    }, seed.sortFolder.id, { timeout: TIMEOUT })
    report.treeBatchMoveAndUndo = true

    // 7. Multi-select in search results: Ctrl+A select all, batch delete to Recycle Bin + Undo, Escape exit.
    await page.fill('#search-input', 'Zeta')
    await page.waitForFunction(() => document.querySelectorAll('#popup-search-results [role="row"]').length === 2, undefined, { timeout: TIMEOUT })
    await page.click('.t-skel-content #popup-selection-mode-toggle')
    await page.waitForSelector('#popup-selection-dock', { state: 'visible', timeout: TIMEOUT })
    await page.focus('#popup-search-results [role="row"] button >> nth=0')
    await page.keyboard.press('Control+a')
    await waitForDockText(page, '已选 2 项')
    await page.click('#popup-selection-delete')
    await page.waitForSelector('#popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    const zetaAfterDelete = await page.evaluate(async () => chrome.bookmarks.search('Zeta'))
    assert.equal(zetaAfterDelete.length, 0, 'both Zeta bookmarks must be batch-deleted')
    await page.click('#popup-activity-action')
    await page.waitForFunction(async () => (await chrome.bookmarks.search('Zeta')).length === 2, undefined, { timeout: TIMEOUT })
    report.searchBatchDeleteAndUndo = true

    // Enter multi-select again and verify Escape exits cleanly.
    await page.click('.t-skel-content #popup-selection-mode-toggle')
    await page.waitForSelector('#popup-selection-dock', { state: 'visible', timeout: TIMEOUT })
    await page.keyboard.press('Escape')
    await page.waitForSelector('#popup-selection-dock', { state: 'hidden', timeout: TIMEOUT })

    // 7b. Closed-loop single-bookmark flows: All Bookmarks scope, right-click Move + Undo,
    // Locate Folder, Direct-count clarity, Multi-select this bookmark, Move inline Create & Move + Undo, Edit Undo.
    await page.fill('#search-input', '')
    await page.click('.t-skel-content [data-folder-row-id="all"] button')
    await page.waitForFunction(() => document.querySelectorAll('.t-skel-content #popup-folder-actions-menu').length === 0, undefined, { timeout: TIMEOUT })
    assert.equal(await page.evaluate(() => document.querySelectorAll('.t-skel-content #popup-folder-sort-menu').length), 0, 'sort menu must hide on All Bookmarks scope')
    assert.equal(await page.evaluate(() => document.querySelectorAll('.t-skel-content [data-folder-row-id="2"] button').length), 1, 'Other Bookmarks root must stay visible in sidebar')

    const alphaAllRowSel = `.t-skel-content .popup-main-row[data-bookmark-id="${seed.sortBookmarks.bmAlpha.id}"]`
    await page.click(alphaAllRowSel, { button: 'right' })
    await page.waitForSelector('#popup-bookmark-context-menu [data-bookmark-context-action="move"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-bookmark-context-menu [data-bookmark-context-action="move"]')
    await page.waitForSelector('#move-modal', { state: 'visible', timeout: TIMEOUT })
    await page.click('#move-folder-list button[data-select-folder="2"]')
    await page.waitForSelector('#move-modal', { state: 'hidden', timeout: TIMEOUT })
    await page.waitForFunction(async (id) => (await chrome.bookmarks.get(id))[0]?.parentId === '2', seed.sortBookmarks.bmAlpha.id, { timeout: TIMEOUT })
    await page.click('.t-skel-content [data-folder-row-id="2"] button')
    await page.waitForSelector(alphaAllRowSel, { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-activity-action')
    await page.waitForFunction(async ({ id, expectedParent }) => (await chrome.bookmarks.get(id))[0]?.parentId === expectedParent, {
      id: seed.sortBookmarks.bmAlpha.id,
      expectedParent: seed.sortFolder.id
    }, { timeout: TIMEOUT })
    report.singleMoveAndUndo = true

    // Search -> right-click -> "定位所在文件夹"
    await page.click('.t-skel-content [data-folder-row-id="all"] button')
    await page.fill('#search-input', 'Alpha')
    await page.waitForFunction(() => document.querySelectorAll('#popup-search-results [role="row"]').length === 1, undefined, { timeout: TIMEOUT })
    await page.click('#popup-search-results [role="row"] >> nth=0', { button: 'right' })
    await page.waitForSelector('#popup-bookmark-context-menu', { state: 'visible', timeout: TIMEOUT })
    await settleUi(page)
    await page.screenshot({ path: `${output}/06-bookmark-context-menu.png` })
    await page.click('#popup-bookmark-context-menu [data-bookmark-context-action="locate-folder"]')
    await page.waitForFunction((folderId) => {
      const input = document.getElementById('search-input')
      const folderButton = document.querySelector(`.t-skel-content [data-folder-row-id="${folderId}"] button`)
      return input?.value === '' && folderButton?.getAttribute('aria-current') === 'page'
    }, seed.sortFolder.id, { timeout: TIMEOUT })
    report.bookmarkLocateFolder = true

    // Verify direct-count clarity when a folder holds both direct bookmarks and subfolder bookmarks.
    await page.click('.t-skel-content .popup-folder-tree button:has-text("待删项目") >> nth=0')
    await page.waitForFunction(() => {
      const meta = document.querySelector('.t-skel-content .popup-main-pane > header')?.textContent || ''
      return meta.includes('2 个书签 · 直属 1')
    }, undefined, { timeout: TIMEOUT })
    await page.click(`.t-skel-content [data-folder-row-id="${seed.sortFolder.id}"] button`)

    // Right-click -> "多选此书签" -> enters multi-select with 1 item selected -> Escape exits.
    const betaRowSel = `.t-skel-content .popup-main-row[data-bookmark-id="${seed.sortBookmarks.bmBeta.id}"]`
    await page.waitForSelector(betaRowSel, { state: 'visible', timeout: TIMEOUT })
    await page.click(betaRowSel, { button: 'right' })
    await page.waitForSelector('#popup-bookmark-context-menu [data-bookmark-context-action="select"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-bookmark-context-menu [data-bookmark-context-action="select"]')
    await waitForDockText(page, '已选 1 项')
    await page.keyboard.press('Escape')
    await page.waitForSelector('#popup-selection-dock', { state: 'hidden', timeout: TIMEOUT })

    // Move modal inline "新建并移入" under Other Bookmarks ('2') + Undo cleans up empty newly created folder.
    await page.click(alphaAllRowSel, { button: 'right' })
    await page.waitForSelector('#popup-bookmark-context-menu [data-bookmark-context-action="move"]', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-bookmark-context-menu [data-bookmark-context-action="move"]')
    await page.waitForSelector('#move-modal', { state: 'visible', timeout: TIMEOUT })
    await page.click('#move-inline-create-toggle')
    await page.waitForSelector('#move-inline-create', { state: 'visible', timeout: TIMEOUT })
    await page.fill('#move-inline-create-input', '临时合集')
    await page.click('#move-folder-list button[data-select-folder="2"]')
    await page.waitForFunction(() => {
      const pathEl = document.getElementById('move-inline-create-parent-path')
      return /其他书签|Other Bookmarks/.test(pathEl?.textContent || '')
    }, undefined, { timeout: TIMEOUT })
    await settleUi(page)
    await page.screenshot({ path: `${output}/07-move-inline-create.png` })
    await page.click('#move-inline-create-submit')
    await page.waitForSelector('#move-modal', { state: 'hidden', timeout: TIMEOUT })
    const inlineCreatedFolder = await page.evaluate(async (bookmarkId) => {
      const children = await chrome.bookmarks.getChildren('2')
      const created = children.find((node) => !node.url && node.title === '临时合集') || null
      const moved = (await chrome.bookmarks.get(bookmarkId))[0]
      return { createdId: created?.id || '', bookmarkParentId: moved?.parentId || '' }
    }, seed.sortBookmarks.bmAlpha.id)
    assert.ok(inlineCreatedFolder.createdId, 'inline create must create the destination folder under Other Bookmarks')
    assert.equal(inlineCreatedFolder.bookmarkParentId, inlineCreatedFolder.createdId, 'bookmark must move into newly created folder')
    await page.waitForSelector('#popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-activity-action')
    await page.waitForFunction(async ({ bookmarkId, expectedParent, createdFolderId }) => {
      const bm = (await chrome.bookmarks.get(bookmarkId))[0]
      const otherChildren = await chrome.bookmarks.getChildren('2')
      return bm?.parentId === expectedParent && !otherChildren.some((node) => node.id === createdFolderId)
    }, {
      bookmarkId: seed.sortBookmarks.bmAlpha.id,
      expectedParent: seed.sortFolder.id,
      createdFolderId: inlineCreatedFolder.createdId
    }, { timeout: TIMEOUT })
    report.moveInlineCreateAndUndo = true

    // Bookmark edit Undo roundtrip.
    await page.hover(betaRowSel)
    await page.click(`${betaRowSel} [data-bookmark-menu-action="edit"]`)
    await page.waitForSelector('#edit-modal', { state: 'visible', timeout: TIMEOUT })
    // Expand folder picker inside Edit modal and verify compressed layout frees ample list height.
    await page.click('#edit-folder-picker-button')
    await page.waitForSelector('#edit-folder-picker-button[aria-expanded="true"]', { state: 'visible', timeout: TIMEOUT })
    await settleUi(page)
    const editModalMetrics = await page.evaluate(() => {
      const list = document.getElementById('edit-folder-list')?.getBoundingClientRect()
      const surface = document.querySelector('#edit-modal .popup-edit-surface')?.getBoundingClientRect()
      return {
        listHeight: list ? Math.round(list.height) : 0,
        surfaceTop: surface ? Math.round(surface.top) : -1,
        surfaceBottom: surface ? Math.round(surface.bottom) : 9999,
        viewportHeight: window.innerHeight
      }
    })
    assert.ok(editModalMetrics.listHeight >= 210, `edit folder list should show 6+ rows at 600px height: ${JSON.stringify(editModalMetrics)}`)
    assert.ok(editModalMetrics.surfaceTop >= 8 && editModalMetrics.surfaceBottom <= editModalMetrics.viewportHeight - 8,
      `expanded edit modal must stay cleanly inside viewport: ${JSON.stringify(editModalMetrics)}`)
    await page.screenshot({ path: `${output}/08-edit-modal-expanded.png` })
    report.editModalCompressed = editModalMetrics
    await page.click('#edit-folder-picker-button')
    await page.waitForSelector('#edit-folder-picker-button[aria-expanded="false"]', { state: 'visible', timeout: TIMEOUT })
    await page.fill('#edit-title-input', 'Beta 改名版')
    await page.click('#save-edit')
    await page.waitForSelector('#edit-modal', { state: 'hidden', timeout: TIMEOUT })
    await page.waitForFunction(async (id) => (await chrome.bookmarks.get(id))[0]?.title === 'Beta 改名版', seed.sortBookmarks.bmBeta.id, { timeout: TIMEOUT })
    await page.waitForSelector('#popup-activity-action', { state: 'visible', timeout: TIMEOUT })
    await page.click('#popup-activity-action')
    await page.waitForFunction(async (id) => (await chrome.bookmarks.get(id))[0]?.title === 'Beta 工具', seed.sortBookmarks.bmBeta.id, { timeout: TIMEOUT })
    report.editBookmarkUndo = true
    await collectPageErrors(page, 'popup', pageErrors)

    // 8. Narrow Side Panel (380x680) dedicated vertical companion checks:
    // resting collapsed folder drawer + compact single-row clip strip + on-demand drawer auto-collapse + multi-select dock.
    await setViewport(page, 380, 680)
    await page.goto(sidepanelUrl)
    await page.waitForFunction(() => {
      const workspace = document.querySelector('.popup-workspace-reveal')
      return workspace?.getAttribute('data-state') === 'ready' &&
        document.querySelectorAll('.t-skel-content .popup-main-row').length > 0
    }, undefined, { timeout: TIMEOUT })
    await settleUi(page)
    const restingSidepanel = await page.evaluate(() => {
      const toggle = document.querySelector('[aria-controls="sidepanel-folder-tree"]')
      const tree = document.getElementById('sidepanel-folder-tree')
      const activitySlot = document.querySelector('.popup-activity-slot')?.getBoundingClientRect()
      const mainPane = document.querySelector('.t-skel-content .popup-main-pane')?.getBoundingClientRect()
      return {
        expanded: toggle?.getAttribute('aria-expanded'),
        treeHidden: Boolean(tree?.hidden),
        activityHeight: activitySlot ? Math.round(activitySlot.height) : 0,
        mainPaneHeight: mainPane ? Math.round(mainPane.height) : 0
      }
    })
    assert.equal(restingSidepanel.expanded, 'false', `sidepanel folder drawer should start collapsed: ${JSON.stringify(restingSidepanel)}`)
    assert.equal(restingSidepanel.treeHidden, true, `sidepanel folder tree should start hidden: ${JSON.stringify(restingSidepanel)}`)
    assert.ok(restingSidepanel.activityHeight > 0 && restingSidepanel.activityHeight <= 52,
      `sidepanel current-page clip strip should stay single-row (~48px): ${JSON.stringify(restingSidepanel)}`)
    assert.ok(restingSidepanel.mainPaneHeight >= 420,
      `sidepanel bookmark pane should receive generous vertical room at rest: ${JSON.stringify(restingSidepanel)}`)
    await page.screenshot({ path: `${output}/09-sidepanel-resting.png` })
    report.sidepanelResting = restingSidepanel

    // Open folder drawer on demand, inspect expanded height, then pick a folder and confirm auto-collapse.
    await page.click('[aria-controls="sidepanel-folder-tree"]')
    await page.waitForSelector('#sidepanel-folder-tree', { state: 'visible', timeout: TIMEOUT })
    await settleUi(page)
    const drawerMetrics = await page.evaluate(() => {
      const aside = document.querySelector('.t-skel-content aside[aria-label="文件夹树"]')?.getBoundingClientRect()
      return { asideHeight: aside ? Math.round(aside.height) : 0 }
    })
    assert.ok(drawerMetrics.asideHeight >= 140, `expanded sidepanel folder drawer should have comfortable height: ${JSON.stringify(drawerMetrics)}`)
    await page.screenshot({ path: `${output}/10-sidepanel-folder-drawer.png` })
    await page.click(`#sidepanel-folder-tree [data-folder-row-id="${seed.sortFolder.id}"] button`)
    await page.waitForSelector('#sidepanel-folder-tree', { state: 'hidden', timeout: TIMEOUT })
    assert.equal(
      await page.evaluate(() => document.querySelector('[aria-controls="sidepanel-folder-tree"]')?.getAttribute('aria-expanded')),
      'false',
      'picking a folder in sidepanel drawer should auto-collapse it back to bookmarks'
    )
    report.sidepanelDrawer = drawerMetrics

    await page.click('.t-skel-content #popup-selection-mode-toggle')
    await page.waitForSelector('#popup-selection-dock', { state: 'visible', timeout: TIMEOUT })
    await page.click('.t-skel-content .popup-main-row button >> nth=0')
    await settleUi(page)
    await page.screenshot({ path: `${output}/04-sidepanel-narrow-selection.png` })
    const narrowMetrics = await page.evaluate(() => {
      const dock = document.getElementById('popup-selection-dock')
      const dockRect = dock?.getBoundingClientRect()
      const folderHeader = document.querySelector('.t-skel-content aside[aria-label="文件夹树"] > header')?.getBoundingClientRect()
      const mainHeader = document.querySelector('.t-skel-content .popup-main-pane > header')?.getBoundingClientRect()
      return {
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        dockLeft: dockRect ? Math.round(dockRect.left) : -1,
        dockRight: dockRect ? Math.round(dockRect.right) : 9999,
        viewportWidth: window.innerWidth,
        folderHeaderHeight: folderHeader ? Math.round(folderHeader.height) : 0,
        mainHeaderHeight: mainHeader ? Math.round(mainHeader.height) : 0
      }
    })
    assert.ok(narrowMetrics.docOverflow <= 1, `narrow sidepanel must not overflow horizontally: ${JSON.stringify(narrowMetrics)}`)
    assert.ok(narrowMetrics.dockLeft >= 0 && narrowMetrics.dockRight <= narrowMetrics.viewportWidth, `selection dock must fit inside narrow sidepanel: ${JSON.stringify(narrowMetrics)}`)
    assert.equal(narrowMetrics.folderHeaderHeight, 42)
    assert.equal(narrowMetrics.mainHeaderHeight, 42)
    report.sidepanelNarrow = narrowMetrics
    await collectPageErrors(page, 'sidepanel', pageErrors)

    assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join('; ')}`)
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2))
    return report
  } catch (error) {
    await collectPageErrors(page, 'failure', pageErrors)
    const diag = await page.evaluate(() => ({
      url: location.href,
      activeEl: document.activeElement ? `${document.activeElement.tagName}#${document.activeElement.id}` : null,
      activity: document.getElementById('popup-activity')?.textContent?.trim() || '',
      dock: document.getElementById('popup-selection-dock')?.textContent?.trim() || '',
      modalOpen: [...document.querySelectorAll('[role="dialog"]')].map((el) => el.id || el.className)
    })).catch(() => ({}))
    console.error('Popup folder management Ego failure:', JSON.stringify({ error: error.message, pageErrors, report, diag }, null, 2))
    throw error
  } finally {
    await page.cdp('Emulation.clearDeviceMetricsOverride').catch(() => {})
    await extensionCommand(task, management, 'Extensions.uninstall', { id: extensionId }).catch(() => {})
  }
}
