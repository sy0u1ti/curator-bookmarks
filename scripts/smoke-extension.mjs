import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { auditLayout, auditResponsive } from './layout-invariants.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = fileURLToPath(import.meta.url);
const extensionPath = resolve(repoRoot, 'dist');
const userDataDir = resolve(repoRoot, 'tmp', 'playwright-extension-smoke');

function commandExists(command) {
  const result = spawnSync('command', ['-v', command], {
    shell: true,
    stdio: 'ignore',
  });
  return result.status === 0;
}

// Whether a REAL, responsive X server is reachable. A DISPLAY that is merely *set*
// (e.g. WSLg exports DISPLAY=:0 with no working server) is NOT enough — headed Chrome
// then dies with "Missing X server or $DISPLAY". `xset q` is the cheap probe; if it is
// absent or errors (or hangs against a dead display, hence the timeout), we cannot
// confirm a usable display, so we treat it as unusable and prefer xvfb (which works
// whether or not a real display exists).
function displayWorks() {
  if (!process.env.DISPLAY) return false;
  const probe = spawnSync('xset', ['q'], { stdio: 'ignore', timeout: 4000 });
  return probe.status === 0;
}

// The smoke must launch Chrome with the unpacked extension, which needs a display. On
// Linux it re-execs itself under `xvfb-run` (a virtual display) unless a real display
// is actually usable. Set CURATOR_SMOKE_HEADED=1 to force the real display (e.g. to
// watch the run); CURATOR_SMOKE_XVFB=1 is set on the re-exec to avoid infinite recursion.
function relaunchWithXvfbIfNeeded() {
  if (process.platform !== 'linux' || process.env.CURATOR_SMOKE_XVFB === '1') {
    return;
  }
  if (process.env.CURATOR_SMOKE_HEADED === '1' || displayWorks()) {
    return;
  }

  if (!commandExists('xvfb-run')) {
    console.warn(
      `smoke: no usable X server (DISPLAY="${process.env.DISPLAY ?? ''}") and xvfb-run is not installed; ` +
        'headed Chrome will fail to launch. Install xvfb (e.g. `sudo apt-get install xvfb`), ' +
        'or run on a machine with a working display, or set CURATOR_SMOKE_HEADED=1 to try anyway.',
    );
    return;
  }

  const result = spawnSync('xvfb-run', ['-a', process.execPath, scriptPath, ...process.argv.slice(2)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CURATOR_SMOKE_XVFB: '1',
    },
    stdio: 'inherit',
  });

  process.exit(result.status ?? 1);
}

function fail(message) {
  throw new Error(message);
}

async function waitForExtensionId(context) {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  }

  const extensionId = worker.url().split('/')[2];
  if (!extensionId) {
    fail(`Unable to derive extension id from service worker URL: ${worker.url()}`);
  }

  return extensionId;
}

async function createSmokeBookmarks(worker) {
  const timestamp = Date.now();

  return worker.evaluate(async ({ timestamp }) => {
    function bookmarksCall(method, ...args) {
      return new Promise((resolve, reject) => {
        chrome.bookmarks[method](...args, (result) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(result);
        });
      });
    }

    const tree = await bookmarksCall('getTree');
    const root = Array.isArray(tree) ? tree[0] : null;
    const bookmarkBar = root?.children?.find((node) => node.id === '1' && !node.url);
    const firstFolder = root?.children?.find((node) => !node.url);
    const parent = bookmarkBar || firstFolder || root;

    if (!parent?.id) {
      throw new Error('Unable to locate a bookmark folder for smoke seed.');
    }

    const sourceFolder = await bookmarksCall('create', {
      parentId: parent.id,
      title: `Curator Smoke Source ${timestamp}`,
    });
    const targetFolder = await bookmarksCall('create', {
      parentId: parent.id,
      title: `Curator Smoke Target ${timestamp}`,
    });

    const search = await bookmarksCall('create', {
      parentId: sourceFolder.id,
      title: `Curator Smoke Search ${timestamp}`,
      url: `https://example.com/curator-smoke-search-${timestamp}`,
    });
    const edit = await bookmarksCall('create', {
      parentId: sourceFolder.id,
      title: `Curator Smoke Edit ${timestamp}`,
      url: `https://example.com/curator-smoke-edit-${timestamp}`,
    });
    const move = await bookmarksCall('create', {
      parentId: sourceFolder.id,
      title: `Curator Smoke Move ${timestamp}`,
      url: `https://example.com/curator-smoke-move-${timestamp}`,
    });
    const remove = await bookmarksCall('create', {
      parentId: sourceFolder.id,
      title: `Curator Smoke Delete ${timestamp}`,
      url: `https://example.com/curator-smoke-delete-${timestamp}`,
    });
    const scopedSource = await bookmarksCall('create', {
      parentId: sourceFolder.id,
      title: `Curator Smoke Scoped ${timestamp}`,
      url: `https://example.com/curator-smoke-scoped-source-${timestamp}`,
    });
    const scopedTarget = await bookmarksCall('create', {
      parentId: targetFolder.id,
      title: `Curator Smoke Scoped ${timestamp}`,
      url: `https://example.com/curator-smoke-scoped-target-${timestamp}`,
    });

    return {
      sourceFolder: {
        id: String(sourceFolder.id),
        title: sourceFolder.title,
      },
      targetFolder: {
        id: String(targetFolder.id),
        title: targetFolder.title,
      },
      bookmarks: {
        search: {
          id: String(search.id),
          title: search.title,
          url: search.url,
        },
        edit: {
          id: String(edit.id),
          title: edit.title,
          url: edit.url,
          nextTitle: `Curator Smoke Edited ${timestamp}`,
          nextUrl: `https://example.com/curator-smoke-edited-${timestamp}`,
        },
        move: {
          id: String(move.id),
          title: move.title,
          url: move.url,
        },
        remove: {
          id: String(remove.id),
          title: remove.title,
          url: remove.url,
        },
        scopedSource: {
          id: String(scopedSource.id),
          title: scopedSource.title,
          url: scopedSource.url,
        },
        scopedTarget: {
          id: String(scopedTarget.id),
          title: scopedTarget.title,
          url: scopedTarget.url,
        },
      },
    };
  }, { timestamp });
}

async function getBookmark(worker, id) {
  return worker.evaluate(async (id) => {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, (items) => {
        const error = chrome.runtime.lastError;
        if (error) {
          resolve(null);
          return;
        }
        resolve(items?.[0] || null);
      });
    });
  }, id);
}

async function assertBookmark(worker, id, predicate, message) {
  const bookmark = await getBookmark(worker, id);
  if (!predicate(bookmark)) {
    fail(message);
  }
}

async function clickPopupMenuAction(page, bookmarkId, action) {
  await page.locator(`[data-open-menu="${bookmarkId}"]`).click();
  await page.waitForSelector(`.action-menu [data-menu-action="${action}"][data-bookmark-id="${bookmarkId}"]`, {
    timeout: 10000,
  });
  await page.locator(`.action-menu [data-menu-action="${action}"][data-bookmark-id="${bookmarkId}"]`).click();
}

async function waitForPopupSearchResult(page, bookmarkId) {
  await page.waitForSelector(`[data-open-bookmark="${bookmarkId}"]`, { timeout: 10000 });
}

async function waitForPopupSearchResultHidden(page, bookmarkId) {
  await page.waitForFunction((bookmarkId) => {
    return !document.querySelector(`[data-open-bookmark="${bookmarkId}"]`);
  }, bookmarkId);
}

async function smokePage(context, name, url, check) {
  const page = await context.newPage();
  const errors = [];

  page.on('pageerror', (error) => {
    errors.push(`${name}: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`${name} console: ${message.text()}`);
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const result = await check(page);
    return { ok: Boolean(result), errors };
  } finally {
    await page.close();
  }
}

async function run() {
  relaunchWithXvfbIfNeeded();

  if (!existsSync(resolve(extensionPath, 'manifest.json'))) {
    fail('dist/manifest.json is missing. Run `npm run build` before `npm run smoke:extension`.');
  }

  if (existsSync(userDataDir)) {
    rmSync(userDataDir, { recursive: true, force: true });
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
    const extensionId = await waitForExtensionId(context);
    const smokeData = await createSmokeBookmarks(worker);
    const urls = {
      popup: `chrome-extension://${extensionId}/src/popup/popup.html`,
      options: `chrome-extension://${extensionId}/src/options/options.html`,
      newtab: `chrome-extension://${extensionId}/src/newtab/newtab.html`,
    };

    const results = {
      popup: await smokePage(context, 'popup', urls.popup, async (page) => {
        await page.waitForSelector('#popup-app-shell #search-input', { timeout: 10000 });
        await page.locator('#search-input').fill(smokeData.bookmarks.search.title);
        await waitForPopupSearchResult(page, smokeData.bookmarks.search.id);

        await page.locator('#search-input').fill(smokeData.bookmarks.scopedSource.title);
        await waitForPopupSearchResult(page, smokeData.bookmarks.scopedSource.id);
        await waitForPopupSearchResult(page, smokeData.bookmarks.scopedTarget.id);
        await page.locator('#folder-filter-trigger').click();
        await page.waitForFunction(() => {
          const modal = document.querySelector('#filter-modal');
          return modal && !modal.classList.contains('hidden');
        });
        await page.locator('#filter-search-input').fill(smokeData.sourceFolder.title);
        await page.waitForSelector(`[data-select-filter-folder="${smokeData.sourceFolder.id}"]`, { timeout: 10000 });
        await page.locator(`[data-select-filter-folder="${smokeData.sourceFolder.id}"]`).click();
        await page.waitForFunction(() => document.querySelector('#filter-modal')?.classList.contains('hidden'));
        await waitForPopupSearchResult(page, smokeData.bookmarks.scopedSource.id);
        await waitForPopupSearchResultHidden(page, smokeData.bookmarks.scopedTarget.id);
        await page.locator('#clear-folder-filter').click();
        await waitForPopupSearchResult(page, smokeData.bookmarks.scopedTarget.id);
        await page.locator('#search-input').focus();
        await page.keyboard.press('ArrowDown');
        await page.waitForFunction(() => {
          return document.querySelector('.result-card.active')?.getAttribute('data-result-index') === '1';
        });
        await page.locator('#natural-search-toggle').click();
        await page.waitForFunction(() => {
          const modal = document.querySelector('#ai-provider-prompt-modal');
          return modal && !modal.classList.contains('hidden');
        });
        await page.locator('#cancel-ai-provider-prompt').click();
        await page.waitForFunction(() => document.querySelector('#ai-provider-prompt-modal')?.classList.contains('hidden'));

        await page.locator('#search-input').fill(smokeData.bookmarks.edit.title);
        await page.waitForSelector(`[data-open-menu="${smokeData.bookmarks.edit.id}"]`, { timeout: 10000 });
        await clickPopupMenuAction(page, smokeData.bookmarks.edit.id, 'edit');
        await page.waitForFunction(() => {
          const modal = document.querySelector('#edit-modal');
          return modal && !modal.classList.contains('hidden');
        });
        await page.locator('#edit-title-input').fill(smokeData.bookmarks.edit.nextTitle);
        await page.locator('#edit-url-input').fill(smokeData.bookmarks.edit.nextUrl);
        await page.locator('#save-edit').click();
        await page.waitForFunction(() => document.querySelector('#edit-modal')?.classList.contains('hidden'));
        await assertBookmark(
          worker,
          smokeData.bookmarks.edit.id,
          (bookmark) => bookmark?.title === smokeData.bookmarks.edit.nextTitle && bookmark?.url === smokeData.bookmarks.edit.nextUrl,
          'Popup edit workflow did not persist the updated bookmark title and URL.',
        );

        await page.locator('#search-input').fill(smokeData.bookmarks.move.title);
        await page.waitForSelector(`[data-open-menu="${smokeData.bookmarks.move.id}"]`, { timeout: 10000 });
        await clickPopupMenuAction(page, smokeData.bookmarks.move.id, 'move');
        await page.waitForFunction(() => {
          const modal = document.querySelector('#move-modal');
          return modal && !modal.classList.contains('hidden');
        });
        await page.locator('#move-search-input').fill(smokeData.targetFolder.title);
        await page.waitForSelector(`[data-select-folder="${smokeData.targetFolder.id}"]`, { timeout: 10000 });
        await page.locator(`[data-select-folder="${smokeData.targetFolder.id}"]`).click();
        await page.waitForFunction(() => document.querySelector('#move-modal')?.classList.contains('hidden'));
        await assertBookmark(
          worker,
          smokeData.bookmarks.move.id,
          (bookmark) => String(bookmark?.parentId || '') === smokeData.targetFolder.id,
          'Popup move workflow did not move the bookmark to the target folder.',
        );

        await page.locator('#search-input').fill(smokeData.bookmarks.remove.title);
        await page.waitForSelector(`[data-open-menu="${smokeData.bookmarks.remove.id}"]`, { timeout: 10000 });
        await clickPopupMenuAction(page, smokeData.bookmarks.remove.id, 'delete');
        await page.waitForFunction(() => {
          const modal = document.querySelector('#delete-modal');
          return modal && !modal.classList.contains('hidden');
        });
        await page.locator('#confirm-delete').click();
        await page.waitForFunction(() => document.querySelector('#delete-modal')?.classList.contains('hidden'));
        await assertBookmark(
          worker,
          smokeData.bookmarks.remove.id,
          (bookmark) => bookmark === null,
          'Popup delete workflow did not remove the bookmark.',
        );

        const settingsPagePromise = context.waitForEvent('page', { timeout: 10000 });
        await page.locator('#open-settings').click();
        const settingsPage = await settingsPagePromise;
        await settingsPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
        const settingsUrl = new URL(settingsPage.url());
        if (settingsUrl.pathname !== '/src/options/options.html') {
          fail(`Popup settings action opened unexpected URL: ${settingsPage.url()}`);
        }
        await settingsPage.close();

        return true;
      }),
      options: await smokePage(context, 'options', urls.options, async (page) => {
        await page.waitForSelector('.options-shell [data-section-link="dashboard"]', { timeout: 10000 });
        await page.locator('[data-section-link="backup"]').first().click();
        await page.waitForFunction(() => !document.querySelector('[data-section-panel="backup"]')?.hasAttribute('hidden'));
        await page.locator('[data-nav-group-trigger="availability-tools"]').click();
        await page.waitForFunction(() => document.querySelector('[data-nav-group-trigger="availability-tools"]')?.getAttribute('aria-expanded') === 'true');
        await page.locator('[data-section-link="availability"]').first().click();
        await page.waitForFunction(() => !document.querySelector('[data-section-panel="availability"]')?.hasAttribute('hidden'));
        await page.locator('#availability-scope-trigger').click();
        await page.waitForFunction(() => {
          const modal = document.querySelector('#scope-modal-backdrop');
          return modal && !modal.classList.contains('hidden') && modal.getAttribute('aria-hidden') === 'false';
        });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('#scope-modal-backdrop')?.classList.contains('hidden'));
        await page.locator('[data-section-link="general"]').first().click();
        await page.waitForFunction(() => !document.querySelector('[data-section-panel="general"]')?.hasAttribute('hidden'));
        await page.locator('#ai-model-picker-trigger').click();
        await page.waitForFunction(() => {
          const modal = document.querySelector('#ai-model-picker-modal-backdrop');
          return modal && !modal.classList.contains('hidden') && modal.getAttribute('aria-hidden') === 'false';
        });
        await page.locator('#cancel-ai-model-picker-modal').click();
        await page.waitForFunction(() => document.querySelector('#ai-model-picker-modal-backdrop')?.classList.contains('hidden'));
        return page.locator('#ai-model-picker-trigger').isVisible();
      }),
      newtab: await smokePage(context, 'newtab', urls.newtab, async (page) => {
        await page.waitForSelector('#newtab-root', { timeout: 10000 });
        await page.locator('#newtab-settings-trigger').click();
        await page.waitForFunction(() => {
          const drawer = document.querySelector('#newtab-settings-drawer');
          return drawer && drawer.classList.contains('open') && drawer.getAttribute('aria-hidden') === 'false';
        });
        await page.locator('[data-settings-group-tab="appearance"]').click();
        await page.waitForFunction(() => {
          const panel = document.querySelector('[data-settings-group="appearance"]');
          return panel && !panel.hasAttribute('hidden') && panel.getAttribute('aria-hidden') === 'false';
        });
        await page.locator('[data-settings-group-tab="source"]').click();
        await page.locator('#folder-candidates-toggle').click();
        await page.waitForFunction(() => {
          const toggle = document.querySelector('#folder-candidates-toggle');
          const panel = document.querySelector('#folder-candidates-panel');
          return toggle?.getAttribute('aria-expanded') === 'true' && panel && !panel.hasAttribute('hidden');
        });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => {
          const drawer = document.querySelector('#newtab-settings-drawer');
          return drawer && !drawer.classList.contains('open') && drawer.getAttribute('aria-hidden') === 'true';
        });
        await page.locator('#newtab-dashboard-trigger').click();
        await page.waitForFunction(() => {
          const overlay = document.querySelector('#newtab-dashboard-overlay');
          return overlay && !overlay.hasAttribute('hidden') && overlay.getAttribute('aria-hidden') === 'false';
        });
        return page.locator('#newtab-settings-trigger').isVisible();
      }),
    };

    // Structural + responsive layout invariants on a clean render of each surface
    // (spec Sections 2A.11 / 2A.12). Catches "renders without errors but the page
    // STRUCTURE broke, components overlap/overflow, or it isn't responsive".
    const layoutFailures = [];
    // popup is a fixed-size surface (Chrome sizes the popup), so a single shot.
    {
      const page = await context.newPage();
      try {
        await page.setViewportSize({ width: 400, height: 600 });
        await page.goto(urls.popup, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
        await page.waitForSelector('#search-input', { timeout: 10000 });
        await page.waitForTimeout(300);
        layoutFailures.push(...(await auditLayout(page, 'popup')));
      } finally {
        await page.close();
      }
    }
    // options + newtab are full-page, window-resizable surfaces: sweep the responsive
    // breakpoint matrix (structure where it applies; no overlap/overflow/off-screen).
    for (const name of ['options', 'newtab']) {
      const page = await context.newPage();
      try {
        layoutFailures.push(...(await auditResponsive(page, name, urls[name])));
      } finally {
        await page.close();
      }
    }

    const errors = Object.values(results).flatMap((result) => result.errors).concat(layoutFailures);
    const summary = {
      extensionId,
      smokeBookmarkId: smokeData.bookmarks.search.id,
      results: Object.fromEntries(Object.entries(results).map(([key, value]) => [key, value.ok])),
      errors,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (errors.length > 0 || Object.values(results).some((result) => !result.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
