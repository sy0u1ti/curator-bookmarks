// Runs inside ego-browser's Node.js runtime; `page` is an Ego Page.
export async function runSyncInterfaceChecks(page, url, directory) {
  const report = { checks: 0, failures: [], screenshots: [] }
  let viewport = 0
  // A pointer action that cannot reach its target says which one, and at what width.
  const click = (selector) => page.click(selector).catch((error) => {
    throw new Error(`${viewport}px: click ${selector}: ${error.message}`)
  })
  const check = (condition, message) => {
    report.checks++
    if (!condition) report.failures.push(message)
  }
  const screenshot = async (name) => {
    const file = `${directory}/${name}.png`
    await page.screenshot({ path: file })
    report.screenshots.push(file)
  }
  const field = async label => {
    const id = await page.evaluate(label => [...document.querySelectorAll('[role="dialog"] label')].find(node => node.textContent === label)?.htmlFor, label)
    if (!id) throw new Error(`Missing field: ${label}`)
    return `input[id="${id}"]`
  }
  const scene = async (name) => {
    await page.evaluate(name => window.__sync.scene(name), name)
    await page.waitForFunction(count => document.querySelectorAll('#settings-sync li').length === count, {
      empty: 0, many: 3
    }[name] ?? 1)
    await page.waitForTimeout(80)
  }
  // Where the controls a user is aiming at are, and whether anything spills out of the page.
  const measure = () => page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector)?.getBoundingClientRect()
      return rect ? [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)] : null
    }
    const card = document.querySelector('#settings-sync').getBoundingClientRect()
    const spill = [...document.querySelectorAll('#settings-sync *')].filter((node) => {
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && (rect.right > card.right + 0.5 || rect.left < card.left - 0.5)
    }).length
    return {
      run: box('#settings-sync li button[aria-label^="同步："], #settings-sync li button[aria-label^="取消同步："]'),
      add: box('#settings-sync button[aria-label="添加同步"], #settings-sync button[aria-label="重新读取同步状态"], #settings-sync button[aria-label="打开扩展管理以更新后台"]'),
      row: box('#settings-sync li'),
      spill,
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      status: document.querySelector('#settings-sync li .curator-status-message-live')?.textContent || ''
    }
  })

  for (const width of [1440, 768, 390]) {
    viewport = width
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await page.goto(url)
    // Transitions and resize observers need an active render surface, not an occluded tab.
    await page.cdp('Page.bringToFront')
    await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
    await page.waitForSelector('#settings-sync')

    await scene('empty')
    check((await page.evaluate(() => document.querySelectorAll('#settings-sync ul').length)) === 0, `${width}: no empty list at rest`)
    await screenshot(`sync-${width}-empty`)

    await scene('idle')
    const idle = await measure()
    check(idle.status.includes('上次同步'), `${width}: an idle profile shows when it last synced`)
    check(await page.evaluate(() => document.querySelector('#settings-sync li').textContent.includes('双向合并')), `${width}: the saved merge direction is visible`)
    for (const [name, direction] of [['download', '只下载'], ['upload', '只上传']]) {
      await scene(name)
      check(await page.evaluate(direction => document.querySelector('#settings-sync li').textContent.includes(direction), direction), `${width}: the saved ${direction} direction is visible`)
    }
    await scene('idle')
    await page.evaluate(() => {
      window.__sync.fail('后台查询失败。' + '这是需要保留完整详情的较长错误原因。'.repeat(12))
      window.__sync.scene('idle')
    })
    await page.waitForSelector('#settings-sync [aria-label="重新读取同步状态"]')
    const loadError = await measure()
    check(JSON.stringify(loadError.add) === JSON.stringify(idle.add), `${width}: the recovery action moved the primary control`)
    check(JSON.stringify(loadError.row) === JSON.stringify(idle.row), `${width}: a failed refresh displaced the last results`)
    await screenshot(`sync-${width}-load-error`)
    await click('#settings-sync [aria-label="重新读取同步状态"]')
    await page.waitForSelector('#settings-sync [aria-label="添加同步"]')
    check(JSON.stringify((await measure()).row) === JSON.stringify(idle.row), `${width}: retry displaced the retained results`)
    for (const state of ['syncing', 'scheduled', 'error', 'pending']) {
      await scene(state)
      const current = await measure()
      check(JSON.stringify(current.run) === JSON.stringify(idle.run), `${width}/${state}: the sync button moved ${JSON.stringify(idle.run)} -> ${JSON.stringify(current.run)}`)
      check(JSON.stringify(current.row) === JSON.stringify(idle.row), `${width}/${state}: the row resized ${JSON.stringify(idle.row)} -> ${JSON.stringify(current.row)}`)
      check(JSON.stringify(current.add) === JSON.stringify(idle.add), `${width}/${state}: the add button moved`)
      check(current.spill === 0 && current.scroll <= 0, `${width}/${state}: content overflows (${current.spill} nodes, ${current.scroll}px)`)
      if (state === 'syncing') {
        check(await page.evaluate(() => !document.querySelector('#settings-sync [role="progressbar"]')), `${width}: running state stays indeterminate`)
        check(await page.evaluate(() => document.querySelector('#settings-sync li')?.textContent.includes('正在同步')), `${width}: running state is still readable`)
        check(await page.evaluate(() => Boolean(document.querySelector('#settings-sync li button[aria-label^="取消同步："]'))), `${width}: a running sync can be cancelled from the same button`)
      }
      if (state === 'error') {
        check(current.status.startsWith('E029'), `${width}: the row says what failed`)
        check(await page.evaluate(() => {
          const live = document.querySelector('#settings-sync li .curator-status-message-live')
          return live.scrollHeight <= live.clientHeight + 1 && live.scrollWidth <= live.clientWidth + 1
        }), `${width}: the error summary fits its line`)
        await screenshot(`sync-${width}-error`)
        // The whole message, with how to recover, is one keyboard-reachable step away.
        await page.focus('#settings-sync li button[aria-label^="查看同步失败详情"]')
        await page.keyboard.press('Enter')
        await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] p')].some(node => node.textContent.endsWith('恢复本机。')))
        // Measured and captured at rest, not partway through the opening transition.
        await page.evaluate(() => Promise.allSettled(document.getAnimations()
          .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map(animation => animation.finished)))
        check(await page.evaluate(() => {
          const text = [...document.querySelectorAll('[role="dialog"] p')].find(node => node.textContent.endsWith('恢复本机。'))
          const rect = text.closest('[role="dialog"]').getBoundingClientRect()
          return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && text.scrollWidth <= text.clientWidth + 1
        }), `${width}: the error details fit inside the page`)
        check(JSON.stringify((await measure()).run) === JSON.stringify(idle.run), `${width}: opening the error details moved the sync button`)
        await screenshot(`sync-${width}-error-details`)
        await page.keyboard.press('Escape')
        await page.waitForFunction(() => ![...document.querySelectorAll('[role="dialog"] p')].some(node => node.textContent.endsWith('恢复本机。') && node.getClientRects().length))
        check(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')?.startsWith('查看同步失败详情')), `${width}: focus returns to the error after closing its details`)
      }
      if (state === 'syncing') await screenshot(`sync-${width}-syncing`)
    }

    // A forced run bypasses a server lock only after an explicit confirmation.
    await scene('scheduled')
    await click('#settings-sync li button[aria-label$="的更多同步操作"]')
    await click('[role="menuitem"]:has-text("立即强制同步")')
    await page.waitForSelector('#sync-overwrite-title', { state: 'visible' })
    const forceBefore = await page.evaluate(() => window.__sync.calls.filter(call => call.type === 'sync:run' && call.mode === 'force').length)
    await page.keyboard.press('Escape')
    await page.waitForSelector('#sync-overwrite-title', { state: 'hidden' })
    check(forceBefore === await page.evaluate(() => window.__sync.calls.filter(call => call.type === 'sync:run' && call.mode === 'force').length), `${width}: cancelled force sync does nothing`)

    await scene('many')
    const many = await measure()
    check(many.spill === 0 && many.scroll <= 0, `${width}/many: content overflows (${many.spill} nodes, ${many.scroll}px)`)
    check(await page.evaluate(() => Boolean(document.querySelector('#settings-sync button[aria-label="同步全部"]'))), `${width}: several profiles can be synced at once`)
    await screenshot(`sync-${width}-many`)
    await click('#settings-sync li button[aria-label$="的更多同步操作"] >> nth=0')
    const downloadPromise = page.waitForEvent('download')
    await click('[role="menuitem"]:has-text("导出此配置")')
    const download = await downloadPromise
    const exportPath = `${directory}/profile-${width}.json`
    await download.saveAs(exportPath)
    const exported = JSON.parse(await (await import('node:fs/promises')).readFile(exportPath, 'utf8'))
    check(exported.length === 1 && exported[0].type === 'webdav', `${width}: single-profile export contains only the chosen profile`)
    await click('#settings-sync button[aria-label="同步配置与日志"]')
    await click('[role="menuitem"]:has-text("导出配置")')
    await page.waitForSelector('#sync-export-title', { state: 'visible' })
    check(await page.evaluate(() => {
      const panel = document.querySelector('#sync-export-title').closest('[role="dialog"]')
      const rect = panel.getBoundingClientRect()
      return rect.left >= 0 && rect.right <= innerWidth && panel.scrollWidth <= panel.clientWidth + 1
    }), `${width}: profile selection fits the viewport`)
    await screenshot(`sync-${width}-export`)
    await click('[role="dialog"] [role="checkbox"] >> nth=1')
    const selectedDownload = page.waitForEvent('download')
    await click('[role="dialog"] button:has-text("导出 2 项")')
    const selectedFile = await selectedDownload
    await selectedFile.saveAs(`${directory}/selected-${width}.json`)
    const selectedProfiles = JSON.parse(await (await import('node:fs/promises')).readFile(`${directory}/selected-${width}.json`,'utf8'))
    check(selectedProfiles.length === 2 && selectedProfiles.every(profile => profile.type !== 'google-drive'), `${width}: export honors the selected subset`)

    // A sync request reports failure in the card's own status slot without moving the header.
    await page.evaluate(() => window.__sync.fail('同步服务没有响应，请重试。'))
    await click('#settings-sync li button[aria-label^="同步："] >> nth=0')
    await page.waitForFunction(() => document.querySelector('#settings-sync header [role="alert"]')?.textContent.includes('没有响应'))
    check(JSON.stringify((await measure()).add) === JSON.stringify(many.add), `${width}: a failed request moved the header actions`)

    // Overwriting one side asks first.
    await click('#settings-sync li button[aria-label$="的更多同步操作"] >> nth=0')
    check(await page.evaluate(() => ![...document.querySelectorAll('[role="menuitem"]')].some(item => item.textContent.trim() === '设置')), `${width}: settings is available directly instead of inside the menu`)
    await click('text="本次以服务器为准"')
    await page.waitForSelector('#sync-overwrite-title', { state: 'visible' })
    const before = await page.evaluate(() => window.__sync.calls.filter(call => call.type === 'sync:run').length)
    await screenshot(`sync-${width}-overwrite`)
    await page.keyboard.press('Escape')
    await page.waitForSelector('#sync-overwrite-title', { state: 'hidden' })
    check(before === await page.evaluate(() => window.__sync.calls.filter(call => call.type === 'sync:run').length), `${width}: dismissing the confirmation starts nothing`)
    await click('#settings-sync li button[aria-label$="的更多同步操作"] >> nth=0')
    await click('text="本次以服务器为准"')
    await page.waitForSelector('#sync-overwrite-title', { state: 'visible' })
    await click('[role="dialog"] button:text-is("覆盖本机")')
    await page.waitForSelector('#sync-overwrite-title', { state: 'hidden' })
    check(await page.evaluate(() => {
      const call = window.__sync.calls.filter(call => call.type === 'sync:run').at(-1)
      return call?.mode === 'download' && !window.__sync.calls.some(call => call.type === 'sync:update') &&
        document.querySelector('#settings-sync li').textContent.includes('双向合并')
    }), `${width}: a one-time overwrite preserves the saved direction`)

    // The editor: one form, service-specific fields, nothing wider than the dialog.
    await click('#settings-sync button[aria-label="添加同步"]')
    await page.waitForSelector('#sync-editor-title', { state: 'visible' })
    await page.waitForTimeout(350)
    const editor = () => page.evaluate(() => {
      const panel = document.querySelector('#sync-editor-title').closest('[role="dialog"][aria-labelledby="sync-editor-title"]')
      const rect = panel.getBoundingClientRect()
      const body = panel.querySelector('.curator-dialog-body')
      return {
        inside: rect.left >= 0 && rect.right <= innerWidth + 0.5 && rect.top >= 0 && rect.bottom <= innerHeight + 0.5,
        spill: [...panel.querySelectorAll('*')].filter((node) => {
          const box = node.getBoundingClientRect()
          return box.width > 0 && (box.right > rect.right + 0.5 || box.left < rect.left - 0.5)
        }).length,
        bodyScrollsX: body.scrollWidth > body.clientWidth + 1,
        labels: [...panel.querySelectorAll('label')].map(label => label.textContent),
        unlabelled: [...panel.querySelectorAll('input:not([type="hidden"]):not([aria-hidden="true"])')].filter(input =>
          !input.labels?.length && !input.getAttribute('aria-label')).length,
        footer: (() => {
          const save = [...panel.querySelectorAll('.curator-dialog-footer button')].at(-1).getBoundingClientRect()
          return [Math.round(save.left), Math.round(save.top)]
        })()
      }
    })
    let form = await editor()
    check(form.inside && form.spill === 0 && !form.bodyScrollsX, `${width}: the editor overflows ${JSON.stringify(form)}`)
    check(form.unlabelled === 0, `${width}: ${form.unlabelled} editor inputs have no label`)
    check(['WebDAV 地址', '用户名', '密码', '书签文件', '加密口令'].every(label => form.labels.includes(label)), `${width}: WebDAV fields are missing: ${form.labels}`)
    check(await page.evaluate(() => document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] [aria-label="要同步的本地文件夹"]').textContent === '书签栏'), `${width}: new profiles default to the bookmarks bar`)
    await screenshot(`sync-${width}-editor`)

    const footer = form.footer
    await page.evaluate(() => window.__sync.fail('同步设置保存失败，请重试。'))
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] .curator-dialog-footer button >> nth=-1')
    await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] .curator-dialog-footer [role="alert"]')?.textContent.includes('保存失败'))
    form = await editor()
    check(JSON.stringify(form.footer) === JSON.stringify(footer), `${width}: the save button moved when an error appeared`)
    check(await page.evaluate(() => window.__sync.calls.filter(call => call.type === 'sync:create').at(-1)?.data.localRoot === '1'), `${width}: the default bookmarks bar reaches the save request`)

    await click('[role="dialog"][aria-labelledby="sync-editor-title"] [aria-label="WebDAV 服务商"]')
    await click('[role="option"]:has-text("Koofr")')
    check(await page.evaluate(() => [...document.querySelectorAll('[role="dialog"][aria-labelledby="sync-editor-title"] input')].some(input => input.value === 'https://app.koofr.net/dav/Koofr/')), `${width}: choosing a provider fills its editable address`)
    await page.fill(await field('密码'), 'typed-only-here')
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] [aria-label="显示 密码"]')
    check(await page.evaluate(() => [...document.querySelectorAll('[role="dialog"][aria-labelledby="sync-editor-title"] input')].some(input => input.value === 'typed-only-here' && input.type === 'text')), `${width}: the entered secret can be revealed`)
    await page.keyboard.press('Escape')
    check(await page.evaluate(() => [...document.querySelectorAll('[role="dialog"][aria-labelledby="sync-editor-title"] input')].some(input => input.value === 'typed-only-here' && input.type === 'password')), `${width}: Escape conceals the secret before dismissing the editor`)
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("新建文件夹")')
    await page.fill('[role="dialog"][aria-labelledby="sync-editor-title"] input[aria-label="新文件夹名称"]', `同步 ${width}`)
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("创建")')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] input[aria-label="新文件夹名称"]'))
    check(await page.evaluate(width => document.querySelector('[aria-label="要同步的本地文件夹"]').textContent.includes(`同步 ${width}`), width), `${width}: a created folder becomes the local target`)

    await click('[role="dialog"][aria-labelledby="sync-editor-title"] [aria-label="同步服务"]')
    await click('[role="option"]:has-text("Google Drive")')
    await page.waitForSelector('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("使用 Google 登录")')
    form = await editor()
    check(form.inside && form.spill === 0 && !form.bodyScrollsX, `${width}: the Google Drive form overflows ${JSON.stringify(form)}`)
    check(!form.labels.includes('WebDAV 地址') && !form.labels.includes('客户端 ID') && !form.labels.includes('客户端密钥'),
      `${width}: normal Google login must not ask users to configure an OAuth app`)
    await screenshot(`sync-${width}-editor-oauth-ready`)
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("使用 Google 登录")')
    await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"]').textContent.includes('已连接 Fixture Account'))
    check(await page.evaluate(() => {
      const call = window.__sync.calls.filter(call => call.type === 'sync:authorize').at(-1)
      return call?.adapter === 'google-drive' && !('client' in call)
    }), `${width}: Google login uses the publisher client in one action`)
    await screenshot(`sync-${width}-editor-oauth`)
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] [aria-label="同步服务"]')
    await click('[role="option"]:has-text("Dropbox")')
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("使用 Dropbox 登录")')
    await page.waitForFunction(() => document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"]').textContent.includes('已连接 Fixture Account'))
    check(await page.evaluate(() => {
      const call = window.__sync.calls.filter(call => call.type === 'sync:authorize').at(-1)
      return call?.adapter === 'dropbox' && !('client' in call)
    }), `${width}: Dropbox login also uses the publisher client`)
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("高级")')
    await click('[role="switch"][aria-label="使用自定义 OAuth 客户端"]')
    check(await page.evaluate(() => document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] code')?.textContent.endsWith('.chromiumapp.org/')),
      `${width}: custom clients retain their redirect address in advanced settings`)
    await screenshot(`sync-${width}-editor-oauth-custom`)
    await page.keyboard.press('Escape')
    await page.waitForSelector('#sync-editor-title', { state: 'hidden' })

    // An existing profile: stored secrets are never filled in, removal needs a deliberate hold.
    await click('#settings-sync li button[aria-label^="同步设置："] >> nth=0')
    await page.waitForSelector('#sync-editor-title', { state: 'visible' })
    await page.waitForTimeout(350)
    check(await page.evaluate(() => document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] [aria-label="要同步的本地文件夹"]').textContent === '书签栏 / 工作资料'), `${width}: existing profiles keep their chosen folder`)
    check(await page.evaluate(() => {
      const panel = document.querySelector('#sync-editor-title').closest('[role="dialog"][aria-labelledby="sync-editor-title"]')
      const secrets = [...panel.querySelectorAll('input[type="password"]')]
      return secrets.length === 2 && secrets.every(input => input.value === '') && secrets[0].placeholder.includes('已保存') &&
        panel.querySelector('[aria-label="同步服务"]').hasAttribute('disabled') || panel.querySelector('[aria-label="同步服务"]').getAttribute('aria-disabled') === 'true'
    }), `${width}: an existing profile must not expose its secrets or let its service change`)
    check(await page.evaluate(() => Boolean(document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] .curator-hold-button'))), `${width}: deleting is a hold-to-confirm action`)
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("高级")')
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"][aria-labelledby="sync-editor-title"] [role="switch"]')].some(node => node.getAttribute('aria-label') === '安全保护'))
    // Keyboard focus scrolls a newly opened control into view. No resize observer
    // may keep scrolling while the user is aiming at the control.
    await page.evaluate(() => Promise.allSettled(document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] .t-acc-panel').getAnimations({ subtree: true })
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished)))
    await page.keyboard.press('Tab') // Name
    await page.keyboard.press('Tab') // Failsafe switch; native Tab brings it into view.
    const revealed = await page.waitForFunction(() => {
      const body = document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] .curator-dialog-body').getBoundingClientRect()
      const section = document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] .t-acc-panel')
      const control = document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] [role="switch"][aria-label="安全保护"]').getBoundingClientRect()
      return section.getAnimations({ subtree: true }).length === 0 && control.top >= body.top && control.bottom <= body.bottom
    }, undefined, { timeout: 5000 }).then(() => true, error => {
      console.log(`Advanced focus wait failed at ${width}: ${error.message}`)
      return false
    })
    if (!revealed) console.log(await page.evaluate(() => {
      const box = node => node?.getBoundingClientRect().toJSON()
      return {
        active: document.activeElement?.outerHTML.slice(0,450),
        body: box(document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] .curator-dialog-body')),
        control: box(document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] [role="switch"][aria-label="安全保护"]')),
        animations: document.querySelector('[role="dialog"][aria-labelledby="sync-editor-title"] .t-acc-panel')?.getAnimations({subtree:true}).map(a=>({state:a.playState,timing:a.effect?.getComputedTiming()}))
      }
    }))
    check(revealed, `${width}: advanced settings cannot be reached with keyboard focus`)
    form = await editor()
    check(form.inside && form.spill === 0 && !form.bodyScrollsX, `${width}: the advanced settings overflow ${JSON.stringify(form)}`)
    await screenshot(`sync-${width}-editor-advanced`)
    await page.keyboard.press('Escape')
    await page.waitForSelector('#sync-editor-title', { state: 'hidden' })

    await click('#settings-sync button[aria-label="添加同步"]')
    await page.waitForSelector('#sync-editor-title', { state: 'visible' })
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] [aria-label="同步服务"]')
    await click('[role="option"]:has-text("Linkwarden")')
    await page.fill(await field('Linkwarden 地址'), 'https://linkwarden.example')
    await page.fill(await field('访问令牌'), 'fixture-token')
    await click('[aria-label="要同步的本地文件夹"]')
    await click('[role="option"]:has-text("工作资料") >> nth=0')
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("高级")')
    const orderSwitch = '[role="dialog"] [role="switch"][aria-label="同步书签和文件夹顺序"]'
    await page.waitForSelector(orderSwitch)
    check(await page.evaluate(selector => document.querySelector(selector)?.getAttribute('aria-checked') === 'true', orderSwitch),
      `${width}: new Linkwarden profiles enable ordering`)
    form = await editor()
    check(form.inside && form.spill === 0 && !form.bodyScrollsX, `${width}: Linkwarden ordering controls fit the editor`)
    await page.focus(orderSwitch)
    await page.keyboard.press('Space')
    await screenshot(`sync-${width}-linkwarden-order`)
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:text-is("添加")')
    await page.waitForSelector('#sync-editor-title', { state: 'hidden' })
    check(await page.evaluate(() => window.__sync.calls.filter(call => call.type === 'sync:create').at(-1)?.data.syncOrder === false),
      `${width}: keyboard order selection reaches the create request`)

    await scene('linkwarden')
    await click('#settings-sync li button[aria-label^="同步设置："]')
    await page.waitForSelector('#sync-editor-title', { state: 'visible' })
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:has-text("高级")')
    await page.waitForSelector(orderSwitch)
    check(await page.evaluate(selector => document.querySelector(selector)?.getAttribute('aria-checked') === 'false', orderSwitch),
      `${width}: older Linkwarden profiles retain disabled ordering`)
    await page.focus(orderSwitch)
    await page.keyboard.press('Space')
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] [aria-label="同步方向"]')
    await click('[role="option"]:has-text("只上传：本机覆盖服务器")')
    await click('[role="dialog"][aria-labelledby="sync-editor-title"] button:text-is("保存")')
    await page.waitForSelector('#sync-editor-title', { state: 'hidden' })
    check(await page.evaluate(() => window.__sync.calls.filter(call => call.type === 'sync:update' && call.id === 'lw').at(-1)?.data.syncOrder === true),
      `${width}: explicit order changes reach the existing profile update`)
    await page.waitForFunction(() => document.querySelector('#settings-sync li').textContent.includes('只上传'))
    check(await page.evaluate(() => window.__sync.calls.filter(call => call.type === 'sync:update' && call.id === 'lw').at(-1)?.data.strategy === 'overwrite'), `${width}: the list shows the direction after saving it`)

    check((await page.evaluate(() => window.__fixtureErrors || [])).length === 0, `${width}: page errors`)
  }
  return report
}
