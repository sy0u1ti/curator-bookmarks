# Curator Performance Optimization Result

Date: 2026-05-06

## Summary

This work keeps existing product behavior and focuses on lower-risk memory, rendering and lifecycle improvements. No user-visible feature was added.

Branch and worktree:

- Branch: `agent/curator-performance-optimization`
- Worktree: `/mnt/g/coding/worktrees/curator-performance-optimization`
- Base commit: `a4db1f4`
- Main merge status: not merged into `main`

## Changes

Changed files:

- `src/newtab/favicon-cache.ts`
- `src/newtab/newtab.ts`
- `src/options/sections/dashboard.ts`
- `src/popup/popup.css`
- `src/popup/popup.ts`
- `src/popup/state.ts`
- `src/service-worker/service-worker.ts`
- `tests/dashboard-selection-a11y.test.ts`
- `tests/newtab-content-state.test.ts`
- `tests/newtab-favicon-cache.test.ts`
- `tests/popup-search-empty-state.test.js`
- `tests/service-worker-save-guards.test.ts`
- `docs/performance/curator-performance-baseline.md`
- `docs/performance/curator-performance-result.md`

## Proven Improvements

The patch set provides these concrete improvements:

1. New Tab favicon accent cache no longer clones and normalizes the whole cache on every favicon load.
2. New Tab favicon cache writes now mutate one entry and normalize at persistence boundaries.
3. New Tab favicon accent extraction keeps the existing 48 tile coverage but separates high-priority work from deferred work.
4. New Tab non-high-priority favicon accent extraction now runs through `requestIdleCallback` with a timeout fallback.
5. New Tab favicon extraction skips work when the image or tile is no longer connected.
6. New Tab adaptive search layout removes a duplicate `getBoundingClientRect()` call for the same slot.
7. New Tab vertical-center collision handling no longer writes `--primary-collision-offset-y: 0px` immediately before reading layout.
8. Popup search result cache now has a 5 minute TTL in addition to its entry cap.
9. Popup natural-search plan cache now has a 5 minute TTL in addition to its entry cap.
10. Popup releases the filtered-bookmark derived array when the search query is cleared.
11. Popup smart-classifier progress now animates with `transform: scaleX(...)` instead of `width`.
12. Popup smart-classifier progress no longer reads layout widths to preserve progress.
13. Dashboard favicon warmup key no longer builds one large joined string over every visible item.
14. Dashboard favicon warmup key now uses a compact count, first/last and rolling hash signature.
15. Service worker auto-classification suppression map now prunes expired entries on write and read.
16. Popup smart-classifier loading state reuses the existing loading card DOM and updates only label, step and progress target while loading.

## Build Artifact Snapshot After Changes

Final `npm run build` largest artifacts:

| Artifact | Size | Gzip |
| --- | ---: | ---: |
| `dist/assets/options.html-CEVTIGhY.js` | 366.56 kB | 102.72 kB |
| `dist/assets/search-C34TaqIt.js` | 312.32 kB | 142.61 kB |
| `dist/assets/newtab.html-DUdLpGmH.js` | 175.56 kB | 50.41 kB |
| `dist/assets/options-iAJeHId1.css` | 109.62 kB | 18.55 kB |
| `dist/assets/popup.html-CFURxgld.js` | 104.52 kB | 29.59 kB |
| `dist/assets/service-worker.ts-ilyTfRvu.js` | 46.40 kB | 14.89 kB |

`dist/` total size: `1.5M`.

No `.map` files were emitted by the normal production build.

## Verification

Commands run after implementation:

- `npm run test:build && node --test .tmp-test/tests/newtab-content-state.test.js .tmp-test/tests/newtab-favicon-cache.test.js .tmp-test/tests/popup-search-empty-state.test.js .tmp-test/tests/service-worker-save-guards.test.js .tmp-test/tests/dashboard-selection-a11y.test.js`: passed, 110 tests
- `npm run typecheck`: passed
- `npm test`: passed, 430 tests, 430 passed, 0 skipped
- `npm run lint`: passed
- `npm run build`: passed
- `npm run check:version`: passed
- `git diff --check`: passed

The targeted tests cover:

- favicon accent cache mutation and pruning
- favicon extraction budget and idle scheduling
- New Tab layout read/write ordering
- Popup cache TTL and filtered-array release
- Popup transform-based smart progress
- Dashboard favicon warmup key allocation reduction
- Service worker suppression map pruning without active suppression capacity eviction

## Agent Review Artifacts

The required roles were run as separate read-only review passes and their outputs were folded into this patch set:

- Profiler Agent: identified New Tab retained state, favicon accent extraction, Popup search/rendering, Options dashboard and Service Worker suppression hot spots.
- Runtime Memory Agent: recommended reducing favicon cache cloning, adding Popup cache TTLs, releasing derived filtered arrays, pruning Service Worker suppression entries and avoiding large Dashboard warmup keys.
- Rendering / Animation Agent: recommended transform-based Popup progress, New Tab layout read/write cleanup and Dashboard render allocation reductions.
- Regression Review Agent: found untracked docs and behavior-risk items. The docs are now part of the worktree deliverables, favicon accent coverage remains at 48 tiles, Service Worker suppression no longer evicts active entries by capacity, and Popup loading progress reuses the existing loading card DOM instead of replacing it every render.

## Manual Verification Needed

Automated tests do not measure real Chrome process memory or frame timing. Before release, manually verify:

1. New Tab opens normally and shows selected folders.
2. Chrome Task Manager New Tab memory immediately after first paint.
3. Chrome Task Manager New Tab memory after 1 minute idle.
4. Repeated New Tab open/close memory trend.
5. Popup opens normally.
6. Popup local weighted search still ranks expected bookmarks.
7. Popup pinyin initials, tags, summaries and aliases still match search.
8. Popup smart classifier loading progress still animates.
9. Options page opens normally.
10. Dashboard folder switching, scrolling and favicon fallback/cache behavior remain correct.
11. Dead-link/availability checks still return results.
12. Inbox save and auto-analysis still avoid duplicate self-triggered analysis after saving.

## Known Risks

- Chrome Task Manager memory could not be collected automatically from the WSL shell. The docs provide reproducible manual steps instead of fabricated values.
- The New Tab favicon accent extraction still covers the same first 48 tiles as before, but lower-priority extraction is delayed to idle time. Cached accents still apply immediately; new uncached accents may appear slightly later for lower-priority icons.
- The dashboard favicon warmup key uses a rolling hash signature. It includes count and first/last item data to reduce collision risk; collisions are theoretically possible but low-risk and would only delay a warmup restart until the next visible set change.

## Next Step

Load `dist/` in Chrome and run the manual checklist above before approving any merge. Do not merge this branch into `main` until manual memory and interaction checks are accepted.
