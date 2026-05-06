# Curator Performance Baseline

Date: 2026-05-06

## Scope

This baseline was captured before applying the performance changes on the required worktree branch.

- Worktree: `/mnt/g/coding/worktrees/curator-performance-optimization`
- Branch: `agent/curator-performance-optimization`
- Base commit: `a4db1f4`
- Package manager: `npm` with `package-lock.json`
- Framework: vanilla TypeScript DOM code
- Build tool: Vite 6.4.2 with `@crxjs/vite-plugin`
- Extension entries: New Tab, Popup, Options, MV3 Service Worker
- Data sources: Chrome bookmarks API, `chrome.storage.local`, IndexedDB content/full-text stores, local tag index, favicon/background caches

## Environment

- Node: `v24.15.0`
- npm: `11.12.1`
- Chrome version available from Windows install: `144.0.7559.133`
- Chrome Task Manager memory values were not automatically collectible from this WSL shell. No memory numbers are fabricated here.

## Initial Quality Gates

Initial commands run on the fresh worktree:

- `npm ci`: passed
- `npm run typecheck`: passed
- `npm test`: passed, 424 tests total, 419 passed, 5 skipped
- `npm run build`: passed

The initial skipped tests were build-artifact checks that depend on `dist/` being present during the test run.

## Initial Build Artifact Snapshot

Initial `npm run build` largest artifacts:

| Artifact | Size | Gzip |
| --- | ---: | ---: |
| `dist/assets/options.html-BfPq4Yhg.js` | 366.27 kB | 102.60 kB |
| `dist/assets/search-C34TaqIt.js` | 312.32 kB | 142.61 kB |
| `dist/assets/newtab.html-BZ733WS2.js` | 175.04 kB | 50.24 kB |
| `dist/assets/options-iAJeHId1.css` | 109.62 kB | 18.55 kB |
| `dist/assets/popup.html-D58rptha.js` | 104.29 kB | 29.53 kB |
| `dist/assets/service-worker.ts-B7138zHV.js` | 46.34 kB | 14.88 kB |

Production sourcemaps were not emitted by the normal build.

## Hotspots Identified

Profiler review found these high-confidence hotspots:

- New Tab initial load retains full bookmark tree, extracted bookmark data, folder maps, visible/all bookmark maps, tag index, snapshot index, search index, favicon cache, activity and workspace state.
- New Tab favicon accent extraction can create canvases and read image pixels for many icons during startup.
- New Tab adaptive layout reads layout metrics repeatedly, and one path reset a CSS variable immediately before layout reads.
- Popup builds a rich local search index and uses caches that previously had entry caps but no TTL.
- Popup smart classifier progress used width animation and read layout to preserve progress across render passes.
- Dashboard favicon warmup computed a full joined string across all visible items to detect queue reuse.
- Service worker auto-classification suppression map had TTL reads but no write-time pruning or capacity cap.

## Manual Chrome Memory Baseline Steps

Use these steps to capture the memory numbers requested by the goal:

1. Run `npm run build`.
2. Open `chrome://extensions/`, enable Developer mode, load `dist/`.
3. Close other extension pages for a clean run.
4. Open a new tab handled by Curator.
5. Open Chrome Task Manager with `Shift+Esc`.
6. Record the row for Curator New Tab immediately after first meaningful paint.
7. Leave it idle for 1 minute and record memory again.
8. Open the Popup and Options pages and record their extension process rows.
9. In DevTools Performance, record typing in New Tab search, Popup search, dashboard folder switching, dashboard scroll and smart classifier loading.
10. In DevTools Memory, take heap snapshots before and after repeated open/close cycles.

The starting user-reported memory concern was about `Curator 新标签页` around `284,044K`; this report treats that as an external observation, not a reproduced measurement from this shell.
