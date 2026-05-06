# Curator Performance Final Audit

Date: 2026-05-06

## 一、范围

- Worktree: `/mnt/g/coding/worktrees/curator-performance-optimization`
- Branch: `agent/curator-performance-optimization`
- Base commit: `76e9ed9`
- Rule check: no `main` merge, no user-visible feature addition, no heavyweight dependency addition.

## 二、交付物

- Code changes are on `agent/curator-performance-optimization`.
- Baseline doc: `docs/performance/curator-performance-baseline.md`.
- Result doc: `docs/performance/curator-performance-result.md`.
- The result doc includes changed files, verification commands, known risks, manual verification steps and a 100-point evidence matrix.

## 三、质量门禁

Latest recorded gates:

- `npm ci`: passed.
- `npm run typecheck`: passed.
- Targeted performance regression tests: passed, 106 tests, 106 passed.
- `npm test`: passed, 431 tests, 431 passed.
- `npm run lint`: passed.
- `npm run check:version`: passed, `1.4.27`.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run review:goal`: passed, 727 checks, 727 passed.

## 四、基线说明

The branch was rebased from `a4db1f4` to `76e9ed9`. The diff between those commits only changes `.gitignore` and removes `Work documentation.md`, so the extension source and package inputs behind the baseline remain comparable.

## 五、内存治理

- New Tab favicon accent cache avoids full-object cloning for the common update path.
- New Tab and Popup search caches now age out entries instead of relying only on entry counts.
- New Tab and Popup clear transient timers, animation frames, cache state and detached UI state on `pagehide`.
- Service Worker queue and suppression structures avoid unnecessary temporary arrays and have explicit release/cap behavior.

## 六、渲染与动效治理

- Popup progress animation uses compositor-friendly `transform: scaleX`.
- Dashboard drag preview uses transform-only movement and `will-change: transform`.
- Dashboard hover state toggles only the previous and next target cards.
- New Tab layout paths remove duplicate rect reads and reset-before-read invalidation.

## 七、行为保持

- Search ranking inputs and prepared indexes remain in use.
- AI tags, summaries, aliases and pinyin initials remain available to search.
- Favicon accent coverage still targets the first 48 New Tab tiles.
- Service Worker suppression still suppresses recent self-triggered saves while pruning stale state.

## 八、未自动化事项

Chrome Task Manager memory and frame timing were not reliably collectable from this WSL shell. A Windows Chrome remote-debugging attempt confirmed Chrome `144.0.7559.133`, but the WSL UNC profile did not activate the Curator new-tab override reliably. The docs therefore record manual verification steps and do not fabricate process memory numbers.

## 九、优化了哪些项目

- New Tab favicon accent cache mutation, pruning and idle extraction.
- New Tab search suggestion cache TTL, LRU retention and unload cleanup.
- Popup current-page bookmark lookup, search cache lifecycle and unload cleanup.
- Popup smart classifier loading/progress rendering.
- Options dashboard drag preview, drop hover and favicon warmup lifecycle.
- Service Worker auto-analyze queue scanning, tree context release and suppression cap.

## 十、创新了什么功能

No user-visible feature was added. The implementation is limited to internal lifecycle, cache and rendering optimizations that preserve existing behavior.

## 十一、需要手动测试的重点

- Chrome Task Manager New Tab memory immediately after first paint.
- Chrome Task Manager New Tab memory after 1 minute idle.
- Repeated New Tab open/close memory trend.
- Popup local weighted search, including pinyin initials, tags, summaries and aliases.
- Popup smart classifier loading progress.
- Options dashboard folder switching, scrolling, drag/drop hover and favicon fallback/cache behavior.
- Inbox save and auto-analysis duplicate suppression.

## 十二、最终结论

The branch is ready for human Chrome verification and should remain unmerged until the manual memory and interaction checklist is accepted.
