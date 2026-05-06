# Curator Performance Optimization Result

Date: 2026-05-06

## Summary

This branch keeps existing product behavior and focuses on lower-risk memory,
rendering and lifecycle improvements. No user-visible feature was added, no
heavy dependency was introduced, and the branch has not been merged into
`main`.

Branch and worktree:

- Branch: `agent/curator-performance-optimization`
- Worktree: `/mnt/g/coding/worktrees/curator-performance-optimization`
- Base commit: `76e9ed9`
- Package/version checked: `1.4.27`
- Main merge status: not merged into `main`

The original pre-change baseline was captured while the worktree was based on
`a4db1f4` (`v1.4.27`). After rebase, `a4db1f4..76e9ed9` only changes
`.gitignore` and removes `Work documentation.md`; extension source and package
inputs are unchanged, so the source baseline remains comparable.

## Changes

Changed files:

- `README.md` (whitespace-only hygiene fix needed by `npm run review:goal`)
- `src/newtab/favicon-cache.ts`
- `src/newtab/newtab.ts`
- `src/options/options.css`
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
- `GOAL_FINAL_AUDIT_REPORT.md`

## Proven Improvements

The patch set provides these concrete improvements:

1. New Tab favicon accent cache updates can mutate one entry in place instead
   of cloning the whole cache object for every favicon load.
2. New Tab favicon accent cache still normalizes at persistence and pruning
   boundaries, preserving the existing cap and max-age semantics.
3. New Tab favicon accent extraction keeps the existing first 48 tile coverage.
4. New Tab non-high-priority favicon accent extraction is deferred through
   `requestIdleCallback` with a timeout fallback.
5. New Tab favicon extraction skips disconnected images and tiles before canvas
   work.
6. New Tab adaptive search layout removes a duplicate
   `getBoundingClientRect()` call for the same slot.
7. New Tab vertical-center collision handling no longer writes
   `--primary-collision-offset-y: 0px` immediately before layout reads.
8. New Tab search suggestion caches now have a 2 minute TTL.
9. New Tab search suggestion caches still retain the existing 24-entry LRU cap.
10. New Tab search suggestion caches delete rejected promises.
11. New Tab `pagehide` cleanup clears long-lived timers.
12. New Tab `pagehide` cleanup cancels pending animation frames.
13. New Tab `pagehide` cleanup removes bookmark and folder drag ghosts.
14. New Tab `pagehide` cleanup releases active background object URLs and video
    backgrounds.
15. New Tab `pagehide` cleanup clears local and natural suggestion caches.
16. New Tab `pagehide` cleanup flushes a pending favicon accent save before
    unload.
17. New Tab `pagehide` cleanup unloads the embedded dashboard iframe.
18. Popup current-page bookmark matching now uses a duplicate-key `Map` lookup
    instead of scanning all bookmarks.
19. Popup rebuilds the duplicate-key map when the base bookmark index refreshes.
20. Popup rebuilds the duplicate-key map after full-text warmup swaps in the
    enriched bookmark index.
21. Popup search result cache has a 5 minute TTL in addition to its entry cap.
22. Popup natural-search plan cache has a 5 minute TTL in addition to its entry
    cap.
23. Popup releases the filtered-bookmark derived array when the search query is
    cleared.
24. Popup smart-classifier progress animates with `transform: scaleX(...)`
    instead of `width`.
25. Popup smart-classifier progress no longer reads layout widths to preserve
    progress.
26. Popup smart-classifier loading state reuses the existing loading card DOM and
    updates only the changing label, step and progress target.
27. Popup `pagehide` cleanup aborts natural-search work.
28. Popup `pagehide` cleanup removes the storage-change listener.
29. Popup `pagehide` cleanup clears search timers, toast timers and transient
    render HTML.
30. Popup `pagehide` cleanup clears search caches before process teardown.
31. Dashboard drag preview movement writes only `transform`.
32. Dashboard drag preview no longer writes `left` on every pointer move.
33. Dashboard drag preview no longer writes `top` on every pointer move.
34. Dashboard drag preview `will-change` is scoped to `transform`.
35. Dashboard drop hover stores the previous hover card and toggles only old/new
    cards.
36. Dashboard drop hover avoids querying every folder card on unchanged pointer
    updates.
37. Dashboard favicon warmup no longer builds one joined string across all
    visible items.
38. Dashboard favicon warmup avoids lossy hash signatures and reuses a queue only
    when the exact visible-items array reference is unchanged.
39. Dashboard favicon warmup stops when the panel is hidden.
40. Dashboard favicon warmup clears its active item reference when stopped.
41. Service worker auto-analyze queue chooses the next runnable item with one
    pass instead of `filter().sort()`.
42. Service worker next wake time is found with one pass instead of
    `map().filter().sort()`.
43. Service worker auto-analyze tree context is released at the end of each queue
    processing pass.
44. Service worker auto-classification suppression pruning still removes expired
    entries on write and read.
45. Service worker auto-classification suppression storage now has an 80-entry
    cap.
46. Service worker suppression cap evicts the soonest-expiring entries first.

## 100-Point Evidence Matrix

This matrix is intentionally evidence-based. It does not claim measured Chrome
Task Manager memory reductions because those numbers could not be captured
reliably from this WSL shell.

| # | Area | Evidence |
| ---: | --- | --- |
| 1 | New Tab memory | `upsertFaviconAccentCacheEntryInPlace` mutates a single favicon cache entry. |
| 2 | New Tab memory | Favicon cache pruning remains bounded by `FAVICON_ACCENT_CACHE_LIMIT`. |
| 3 | New Tab memory | Favicon cache age pruning remains bounded by `FAVICON_ACCENT_CACHE_MAX_AGE_MS`. |
| 4 | New Tab memory | Rejected suggestion promises are removed from cache. |
| 5 | New Tab memory | Local suggestion cache entries include `updatedAt`. |
| 6 | New Tab memory | Natural suggestion cache entries include `updatedAt`. |
| 7 | New Tab memory | Suggestion caches prune entries older than `SEARCH_SUGGESTION_CACHE_TTL_MS`. |
| 8 | New Tab memory | Suggestion caches retain the existing `SEARCH_SUGGESTION_CACHE_LIMIT`. |
| 9 | New Tab memory | `cleanupNewTabRuntime` clears `clockTimer`. |
| 10 | New Tab memory | `cleanupNewTabRuntime` clears search-settings timers. |
| 11 | New Tab memory | `cleanupNewTabRuntime` clears icon-settings timer. |
| 12 | New Tab memory | `cleanupNewTabRuntime` clears time-settings timer. |
| 13 | New Tab memory | `cleanupNewTabRuntime` clears settings-save status timer. |
| 14 | New Tab memory | `cleanupNewTabRuntime` clears folder-reorder status timer. |
| 15 | New Tab memory | `cleanupNewTabRuntime` clears bookmark-change refresh timer. |
| 16 | New Tab memory | `cleanupNewTabRuntime` clears dashboard-frame ready timer. |
| 17 | New Tab memory | `cleanupNewTabRuntime` clears bookmark drag long-press timer. |
| 18 | New Tab memory | `cleanupNewTabRuntime` clears folder drag long-press timer. |
| 19 | New Tab memory | `cleanupNewTabRuntime` cancels resize layout frame. |
| 20 | New Tab memory | `cleanupNewTabRuntime` cancels vertical-center collision frame. |
| 21 | New Tab memory | `cleanupNewTabRuntime` cancels deferred render frame. |
| 22 | New Tab memory | `cleanupNewTabRuntime` removes bookmark drag ghost. |
| 23 | New Tab memory | `cleanupNewTabRuntime` removes folder drag ghost. |
| 24 | New Tab memory | `cleanupNewTabRuntime` clears active background object URL. |
| 25 | New Tab memory | `cleanupNewTabRuntime` clears video background. |
| 26 | New Tab memory | `cleanupNewTabRuntime` clears local suggestion cache. |
| 27 | New Tab memory | `cleanupNewTabRuntime` clears natural suggestion cache. |
| 28 | New Tab memory | `cleanupNewTabRuntime` flushes pending favicon accent save. |
| 29 | New Tab memory | `cleanupNewTabRuntime` removes dashboard iframe `src`. |
| 30 | New Tab memory | `pagehide` binds the New Tab cleanup path. |
| 31 | New Tab smoothness | Favicon extraction checks image connection before canvas work. |
| 32 | New Tab smoothness | Favicon extraction checks tile connection before canvas work. |
| 33 | New Tab smoothness | Low-priority favicon extraction is idle-scheduled. |
| 34 | New Tab smoothness | Favicon extraction keeps high-priority icons immediate. |
| 35 | New Tab smoothness | Search offset bounds reuse the same slot rect. |
| 36 | New Tab smoothness | Vertical collision handling removes reset-before-read layout invalidation. |
| 37 | New Tab search | Local suggestions still use the prepared popup search index. |
| 38 | New Tab search | Natural suggestions still use the prepared search index. |
| 39 | New Tab search | Cache hits are refreshed in LRU order. |
| 40 | New Tab search | Cache miss code path remains promise-based and behavior-compatible. |
| 41 | Popup memory | Current-page lookup uses `bookmarkDuplicateKeyMap.get`. |
| 42 | Popup memory | Duplicate-key map is built once per refresh. |
| 43 | Popup memory | Duplicate-key map is rebuilt after full-text warmup. |
| 44 | Popup memory | Linear `state.allBookmarks.find` current-page lookup was removed. |
| 45 | Popup memory | Empty search clears `filteredBookmarksCacheKey`. |
| 46 | Popup memory | Empty search clears `filteredBookmarksCache`. |
| 47 | Popup memory | `cleanupPopupRuntime` aborts natural search. |
| 48 | Popup memory | `cleanupPopupRuntime` removes auto-analyze storage listener. |
| 49 | Popup memory | `cleanupPopupRuntime` clears search timer. |
| 50 | Popup memory | `cleanupPopupRuntime` clears view notice. |
| 51 | Popup memory | `cleanupPopupRuntime` clears edit discard guard. |
| 52 | Popup memory | `cleanupPopupRuntime` clears toast timers. |
| 53 | Popup memory | `cleanupPopupRuntime` clears toast state. |
| 54 | Popup memory | `cleanupPopupRuntime` clears content render HTML. |
| 55 | Popup memory | `cleanupPopupRuntime` clears search caches. |
| 56 | Popup memory | `pagehide` binds the Popup cleanup path. |
| 57 | Popup search | Search result cache expiration remains covered by tests. |
| 58 | Popup search | Natural plan cache expiration remains covered by tests. |
| 59 | Popup smoothness | Smart progress writes CSS custom property scale. |
| 60 | Popup smoothness | Smart progress CSS uses `transform: scaleX`. |
| 61 | Popup smoothness | Smart progress avoids layout width reads. |
| 62 | Popup smoothness | Loading card DOM reuse avoids full replacement while loading. |
| 63 | Dashboard memory | Warmup active items use array identity instead of a generated string key. |
| 64 | Dashboard memory | Warmup no longer has `getDashboardFaviconWarmupKey`. |
| 65 | Dashboard memory | Warmup no longer has `updateDashboardFaviconWarmupHash`. |
| 66 | Dashboard memory | Warmup no longer maps visible items into a key array. |
| 67 | Dashboard memory | Warmup no longer joins visible items into one large string. |
| 68 | Dashboard memory | Warmup stops when the dashboard panel is hidden. |
| 69 | Dashboard memory | Warmup clears active item reference on stop. |
| 70 | Dashboard memory | Warmup clears active item reference on cache reset. |
| 71 | Dashboard smoothness | Drag preview pointer movement writes `transform`. |
| 72 | Dashboard smoothness | Drag preview pointer movement does not write `style.left`. |
| 73 | Dashboard smoothness | Drag preview pointer movement does not write `style.top`. |
| 74 | Dashboard smoothness | Drag preview CSS uses `will-change: transform`. |
| 75 | Dashboard smoothness | Drop hover skips work when the same connected card stays active. |
| 76 | Dashboard smoothness | Drop hover removes active class only from the previous card. |
| 77 | Dashboard smoothness | Drop hover adds active class only to the next card. |
| 78 | Dashboard smoothness | Drop hover uses `CSS.escape` for the direct card query. |
| 79 | Service worker memory | Queue runnable selection avoids building a filtered array. |
| 80 | Service worker memory | Queue runnable selection avoids sorting runnable entries. |
| 81 | Service worker memory | Next-wake lookup avoids mapping queue entries. |
| 82 | Service worker memory | Next-wake lookup avoids filtering wake times. |
| 83 | Service worker memory | Next-wake lookup avoids sorting wake times. |
| 84 | Service worker memory | Tree context is released after queue processing finishes. |
| 85 | Service worker memory | Suppression map prunes expired entries on suppress writes. |
| 86 | Service worker memory | Suppression map prunes expired entries on suppress reads. |
| 87 | Service worker memory | Suppression map has an explicit 80-entry limit. |
| 88 | Service worker memory | Suppression over-cap pruning removes soonest-expiring entries. |
| 89 | Test evidence | `tests/newtab-favicon-cache.test.ts` covers cache mutation and pruning. |
| 90 | Test evidence | `tests/newtab-content-state.test.ts` covers suggestion cache TTLs. |
| 91 | Test evidence | `tests/newtab-content-state.test.ts` covers New Tab cleanup. |
| 92 | Test evidence | `tests/newtab-content-state.test.ts` covers layout read/write ordering. |
| 93 | Test evidence | `tests/popup-search-empty-state.test.js` covers duplicate-key lookup. |
| 94 | Test evidence | `tests/popup-search-empty-state.test.js` covers Popup cleanup. |
| 95 | Test evidence | `tests/popup-search-empty-state.test.js` covers transform progress. |
| 96 | Test evidence | `tests/dashboard-selection-a11y.test.ts` covers transform-only drag preview. |
| 97 | Test evidence | `tests/dashboard-selection-a11y.test.ts` covers warmup identity reuse. |
| 98 | Test evidence | `tests/service-worker-save-guards.test.ts` covers one-pass queue helpers. |
| 99 | Test evidence | `tests/service-worker-save-guards.test.ts` covers tree-context release. |
| 100 | Test evidence | `tests/service-worker-save-guards.test.ts` covers suppression map capacity. |

## Build Artifact Snapshot After Changes

Final `npm run build` largest artifacts:

| Artifact | Size | Gzip |
| --- | ---: | ---: |
| `dist/assets/options.html-v_8ycis8.js` | 366.19 kB | 102.59 kB |
| `dist/assets/search-C34TaqIt.js` | 312.32 kB | 142.61 kB |
| `dist/assets/newtab.html-CqXVMRL6.js` | 176.56 kB | 50.71 kB |
| `dist/assets/options-C5-_XJyi.css` | 109.62 kB | 18.55 kB |
| `dist/assets/popup.html-DbV-i5xI.js` | 105.13 kB | 29.74 kB |
| `dist/assets/service-worker.ts-D04rWSTG.js` | 46.67 kB | 14.98 kB |

`dist/` total size: `1.5M`.

No `.map` files were emitted by the normal production build.

## Verification

Commands run after implementation:

- `npm ci`: passed
- `npm run typecheck`: passed
- `npm run test:build && node --test .tmp-test/tests/newtab-content-state.test.js .tmp-test/tests/popup-search-empty-state.test.js .tmp-test/tests/service-worker-save-guards.test.js .tmp-test/tests/dashboard-selection-a11y.test.js`: passed, 106 tests, 106 passed
- `npm test`: passed, 431 tests, 431 passed
- `npm run lint`: passed
- `npm run check:version`: passed, `1.4.27`
- `npm run build`: passed
- `git diff --check`: passed
- `npm run review:goal`: passed, 727 checks, 727 passed

The targeted tests cover:

- New Tab suggestion cache TTLs, rejection cleanup and unload cleanup
- New Tab layout read/write ordering
- Popup duplicate-key current-page lookup, cache TTLs and unload cleanup
- Popup transform-based smart progress
- Dashboard transform-only drag preview and exact warmup array reuse
- Service worker one-pass queue selection, tree-context release and suppression
  map capacity

## Agent Review Artifacts

The required roles were run as separate review passes and their outputs were
folded into this patch set:

- Profiler Agent: identified New Tab retained state, favicon accent extraction,
  Popup search/rendering, Options dashboard and Service Worker suppression hot
  spots.
- Runtime Memory Agent: recommended reducing favicon cache cloning, adding
  cache lifetimes, releasing derived arrays, pruning Service Worker suppression
  entries and tightening page unload cleanup.
- Rendering / Animation Agent: recommended transform-based progress/drag
  animation, New Tab layout read/write cleanup and Dashboard hover allocation
  reductions.
- Regression Review Agent: flagged missing real Chrome memory/frame evidence and
  a dashboard warmup hash collision risk. The hash strategy was removed; the
  Chrome memory limitation is documented as manual verification rather than
  fabricated data.

## Manual Verification Needed

Automated tests do not measure real Chrome process memory or frame timing. A
Windows Chrome remote-debugging attempt confirmed Chrome
`144.0.7559.133`, but the WSL UNC profile did not reliably activate the Curator
new-tab override and could not produce trustworthy Chrome Task Manager memory
numbers. Before release, manually verify:

1. New Tab opens normally and shows selected folders.
2. Chrome Task Manager New Tab memory immediately after first paint.
3. Chrome Task Manager New Tab memory after 1 minute idle.
4. Repeated New Tab open/close memory trend.
5. Popup opens normally.
6. Popup local weighted search still ranks expected bookmarks.
7. Popup pinyin initials, tags, summaries and aliases still match search.
8. Popup smart classifier loading progress still animates.
9. Options page opens normally.
10. Dashboard folder switching, scrolling and favicon fallback/cache behavior
    remain correct.
11. Dead-link/availability checks still return results.
12. Inbox save and auto-analysis still avoid duplicate self-triggered analysis
    after saving.

## Known Risks

- Chrome Task Manager memory could not be collected automatically from this WSL
  shell. The baseline and result docs provide reproducible manual steps instead
  of fabricated values.
- New Tab favicon accent extraction still covers the same first 48 tiles as
  before, but lower-priority extraction is delayed to idle time. Cached accents
  still apply immediately; new uncached accents may appear slightly later for
  lower-priority icons.
- Dashboard favicon warmup now reuses a queue only when the visible `items`
  array reference is exactly the same. This removes collision risk from the
  earlier signature approach; if an upstream caller creates a new equivalent
  array, warmup may restart conservatively.

## Next Step

Load `dist/` in Chrome and run the manual checklist above before approving any
merge. Do not merge this branch into `main` until manual memory and interaction
checks are accepted.
