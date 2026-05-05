# 仓库多维度审查报告

## 一、执行摘要

- 仓库类型：Chrome Manifest V3 书签管理扩展。
- 主要技术栈：TypeScript、Vite、`@crxjs/vite-plugin`、Chrome Extension APIs、Node test runner、Playwright。
- 主工作区：`/mnt/g/coding/chromebookmark`，当前仍在 `main`，未合并本轮改动。
- 集成 worktree：`/mnt/g/coding/worktrees/goal-r3-audit-remediation-20260505`
- 集成分支：`integration/goal-r3-audit-remediation-20260505`
- 基线：`main@1c727d2` / `v1.4.24`
- 当前集成提交：`e3f88a9 Merge goal r4 search performance`
- 当前版本文件：`package.json`、`src/manifest.json`、`dist/manifest.json` 均为 `1.4.24`。

本轮在独立集成 worktree 中继续执行多 agent 审查与修复，重点覆盖数据安全、搜索性能、AI 请求取消、Options 初始化负载、New Tab 固定布局、Popup 智能分类恢复路径与回收站恢复安全。所有改动已停留在集成分支，等待你手动测试后再决定是否合并到 `main`。

## 二、严重问题总览

- [高] 功能：完整恢复预览按 URL 去重，无法准确提示同 URL 多位置实例缺失
  - 位置：`src/shared/backup.ts` / `buildBackupRestorePreview`
  - 影响：同一 URL 位于多个文件夹时，预览可能低估需要复制恢复的书签实例数量。
  - 建议：用 URL + 文件夹路径实例键判断缺失，并明确完整恢复覆盖的本地集合范围。
  - 处理：已完成，预览改为按书签实例统计，文案明确集合类本地数据覆盖语义。

- [高] 功能：回收站批量恢复依赖旧 `folderMap`，父文件夹状态可能过期
  - 位置：`src/options/sections/recycle.ts` / `restoreSelectedRecycleEntries`
  - 影响：父文件夹仍存在但缓存过期时，恢复可能落到书签栏根目录，造成位置偏移。
  - 建议：恢复前重新读取当前书签树，基于实时文件夹集合决定目标父级。
  - 处理：已完成，新增实时 `loadCurrentFolderIds()`，并补回归测试。

- [中] 性能：Popup 打开后预热完整快照全文索引
  - 位置：`src/popup/popup.ts`
  - 影响：用户只打开 popup 或做普通轻量搜索时，也可能触发 IndexedDB 全文读取和索引扩展。
  - 建议：保留轻量索引首屏，只有真实搜索触发时再 warmup 全文快照。
  - 处理：已完成，全文快照 warmup 改为有查询后触发，并使用 run id 防止过期写回。

- [中] 性能：Options 初始化时等待全文快照 search map hydration
  - 位置：`src/options/options.ts`
  - 影响：开启全文搜索后，Options 初始 hydration 会读取大量全文快照，即使用户不在 Dashboard 或没有输入搜索。
  - 建议：Dashboard 可见且存在文本查询时再按需加载全文 map。
  - 处理：已完成，初始化只构建轻量 map，Dashboard 查询按需 hydration，完成后仅在 Dashboard 当前可见时渲染。

- [中] 性能：New Tab 和 Dashboard 搜索对所有命中结果全量排序
  - 位置：`src/newtab/content-state.ts`、`src/shared/dashboard-model.ts`
  - 影响：大书签库下，普通建议只需要前 N 条却仍分配并排序全部命中项。
  - 建议：遍历时保留 bounded top-K，再对 top-K 排序。
  - 处理：已完成，New Tab 建议使用 bounded top-K；Dashboard 新增 `filterAndSortDashboardItems(..., { limit })`。

- [中] 功能：AI 智能分析停止后请求仍可能继续完成并合并结果
  - 位置：`src/options/options.ts`、`src/options/shared-options/state.ts`
  - 影响：用户点击停止后，未完成的 metadata fetch 或 AI batch 仍可能继续消耗请求并污染本轮结果。
  - 建议：为整轮分析引入 `AbortController`，停止时 abort，并在关键异步边界检查 signal。
  - 处理：已完成，AI 命名运行持有 abort controller，停止会中断后续 fetch/批处理。

- [中] 功能/UX：Popup 自然语言搜索切换查询后旧 AI 请求可能回写
  - 位置：`src/popup/popup.ts`、`src/popup/state.ts`
  - 影响：用户快速改词、清空或关闭自然语言模式后，旧 AI plan 可能晚到并影响新查询状态。
  - 建议：每次自然语言搜索使用独立 abort controller，清空/切换/新查询时取消旧请求。
  - 处理：已完成，自然语言 AI plan 请求和 timeout fetch 均接入外部 signal，过期 abort 不再渲染错误。

- [中] UI/UX：New Tab 固定列布局在窄视口可能横向溢出或压缩不自然
  - 位置：`src/newtab/icon-settings.ts`、`src/newtab/newtab.ts`、`src/newtab/newtab.css`
  - 影响：用户设置固定列后，在小屏或窄窗口下卡片网格可能超出可用宽度。
  - 建议：按视口和 tile 宽度动态限制固定列数，CSS 使用容器内 100% 网格。
  - 处理：已完成，新增 `getResponsiveFixedIconColumns()`，固定模式在窄视口自动收敛列数。

- [中] UX：New Tab 文件夹拖拽排序保存失败时缺少回滚和明确反馈
  - 位置：`src/newtab/newtab.ts`、`src/newtab/newtab.css`
  - 影响：保存失败可能让界面顺序与实际设置不一致，用户不知道是否成功。
  - 建议：记录拖拽前顺序，保存失败恢复原顺序并显示状态。
  - 处理：已完成，保存成功/失败均显示状态；失败恢复拖拽前 sections 和 settings。

- [低] UX：Popup 智能分类错误/授权状态缺少直达 AI 设置入口
  - 位置：`src/popup/popup.ts`、`src/popup/popup.css`
  - 影响：配置错误或缺权限时，用户需要自己寻找 Options 中的 AI 渠道设置。
  - 建议：错误卡和授权卡直接提供 `AI 设置` 入口。
  - 处理：已完成，新增 `AI 设置` 按钮，跳转 `options.html#general:ai-provider`。

## 三、性能审查结果

1. Popup 快照全文 warmup 已从首屏移动到真实搜索路径。
   - 位置：`src/popup/popup.ts`
   - 影响范围：popup 打开速度、IndexedDB 读取、普通搜索前的后台开销。
   - 验证：`popup full text snapshot warmup is triggered by real searches instead of startup` 通过。
   - 是否需要 benchmark/profile：建议在 1000+ 快照库中做 Chrome Performance 对比；当前有静态和单元回归。

2. Options 全文快照 hydration 改为 Dashboard 查询按需触发。
   - 位置：`src/options/options.ts`
   - 影响范围：Options 初始加载、Dashboard 搜索。
   - 验证：初始化不触发全文 hydration，Dashboard 查询触发并回渲染。
   - 是否需要 benchmark/profile：建议用大量快照的真实库观察 Options 首屏耗时。

3. New Tab 搜索建议使用 bounded top-K 排序。
   - 位置：`src/newtab/content-state.ts`
   - 影响范围：New Tab 搜索建议、普通关键词查询。
   - 验证：exact、prefix、URL、folder、多词结果与全量排序前 N 一致。
   - 是否需要 benchmark/profile：大书签库下建议 profile；当前算法避免全量命中数组排序。

4. Dashboard 模型增加 bounded filter+sort helper。
   - 位置：`src/shared/dashboard-model.ts`
   - 影响范围：Dashboard 后续大列表接入 top-N 过滤排序的基础能力。
   - 验证：bounded top-N 与 `filterDashboardItems + sortDashboardItems + slice` 一致。
   - 是否需要 benchmark/profile：UI 层接入后再做真实 Dashboard profile。

## 四、UI 审查结果

1. New Tab 固定列布局已适配窄视口。
   - 页面/组件位置：New Tab 图标布局设置与书签网格。
   - 现象描述：固定列数不再硬撑宽度，窄视口会动态减少有效列数。
   - 对用户的影响：减少横向滚动和卡片挤压。
   - 严重程度：中
   - 改进状态：已完成，含 `getResponsiveFixedIconColumns()` 和 CSS 约束测试。

2. New Tab 文件夹拖拽排序反馈更完整。
   - 页面/组件位置：New Tab 文件夹标题拖拽排序。
   - 现象描述：成功保存显示成功状态；保存失败会恢复拖拽前顺序并提示失败原因。
   - 对用户的影响：避免“看起来成功但设置没保存”的不确定感。
   - 严重程度：中
   - 改进状态：已完成。

3. Popup 智能分类失败和授权卡增加 AI 设置入口。
   - 页面/组件位置：Popup 智能分类错误态、权限态。
   - 现象描述：错误/授权状态中新增 `AI 设置` 动作。
   - 对用户的影响：配置或权限问题可直接修复，不需要在 Options 中手动寻找。
   - 严重程度：低
   - 改进状态：已完成。

## 五、功能审查结果

1. 备份恢复预览语义已修正。
   - 文件路径 + 相关逻辑：`src/shared/backup.ts` / `buildBackupRestorePreview`
   - 问题描述：旧逻辑按 URL 判断缺失，无法区分同 URL 的不同文件夹实例。
   - 复现路径或触发条件：备份中同一 URL 存在于 Folder A 和 Folder B，当前仅存在其中一个实例。
   - 可能后果：预览低估复制数量，用户误判完整恢复影响。
   - 严重程度：高
   - 修复状态：已修复，并补 `restore preview counts missing bookmark instances by URL and folder path`。

2. 回收站恢复目标文件夹改用实时书签树。
   - 文件路径 + 相关逻辑：`src/options/sections/recycle.ts` / `restoreSelectedRecycleEntries`
   - 问题描述：旧逻辑依赖 `availabilityState.folderMap`，该缓存可能过期。
   - 复现路径或触发条件：打开 Options 后文件夹树变化，再恢复回收站条目。
   - 可能后果：书签恢复到书签栏根目录，而非原父文件夹。
   - 严重程度：高
   - 修复状态：已修复，并补 `restores recycle entry to current parent folder even when cached folder map is stale`。

3. AI 命名运行支持停止后取消未完成请求。
   - 文件路径 + 相关逻辑：`src/options/options.ts` / `runAiNamingSuggestions`、`stopAiNamingRun`
   - 问题描述：停止只能设置状态，无法中断已经启动的异步请求。
   - 复现路径或触发条件：批量分析过程中点击停止。
   - 可能后果：继续消耗 AI 请求，旧结果合入停止后的 UI。
   - 严重程度：中
   - 修复状态：已修复，整轮分析接入 `AbortController`。

4. Popup 自然语言搜索防止旧 AI plan 回写。
   - 文件路径 + 相关逻辑：`src/popup/popup.ts` / `runNaturalSearch`、`requestNaturalSearchAiPlan`
   - 问题描述：切换查询或模式后旧 fetch 仍可能完成。
   - 复现路径或触发条件：自然语言搜索中快速改词、清空、关闭自然语言模式。
   - 可能后果：结果和错误状态与当前查询不一致。
   - 严重程度：中
   - 修复状态：已修复，请求、timeout fetch、状态回写均接入 abort 约束。

## 六、人性化体验审查结果

1. 用户场景：大书签库中频繁打开 Popup 查找书签。
   - 当前体验问题：首屏可能承担全文快照 warmup 成本。
   - 为什么会造成困扰：用户感知到打开慢，但多数场景不需要全文读取。
   - 推荐改进方式：按查询触发全文 warmup。
   - 优先级：P1
   - 处理状态：已完成。

2. 用户场景：在 Options 中查看设置或非 Dashboard 页面。
   - 当前体验问题：全文快照 map 可能在初始化时加载。
   - 为什么会造成困扰：页面启动开销与当前任务无关。
   - 推荐改进方式：Dashboard 可见且有查询时再加载。
   - 优先级：P1
   - 处理状态：已完成。

3. 用户场景：在 New Tab 固定列布局下切换到窄屏或小窗口。
   - 当前体验问题：固定列数可能和真实宽度冲突。
   - 为什么会造成困扰：卡片拥挤、溢出或需要横向滚动。
   - 推荐改进方式：固定布局仍根据视口自适应有效列数。
   - 优先级：P1
   - 处理状态：已完成。

4. 用户场景：智能分类失败或需要 AI 服务授权。
   - 当前体验问题：错误卡只给重试和手动路径，配置入口不够直达。
   - 为什么会造成困扰：用户不知道该去哪里修复 API Key/Base URL/模型问题。
   - 推荐改进方式：错误态和授权态提供 AI 设置入口。
   - 优先级：P2
   - 处理状态：已完成。

## 七、子任务拆分与集成记录

- `agent/goal-r3-data-safety` / `8deb46f`
  - 实现思路：修正备份恢复预览的书签实例语义，强化集合覆盖提示；回收站恢复前读取实时文件夹树。
  - 影响范围：`src/shared/backup.ts`、`src/options/sections/recycle.ts`、相关测试。
  - 测试方式：`tests/backup.test.ts`、`tests/recycle.test.ts`、完整 `npm run validate`。

- `agent/goal-r3-popup-performance` / `886f796`
  - 实现思路：Popup 搜索全文快照 warmup 改为真实查询触发。
  - 影响范围：`src/popup/popup.ts`、`src/popup/state.ts`、popup 搜索测试。
  - 测试方式：focused popup 搜索测试、完整 `npm run validate`。

- `agent/goal-r3-ai-settings-ui` / `385c7a6`
  - 实现思路：智能分类错误态和权限态增加 AI 设置入口。
  - 影响范围：`src/popup/popup.ts`、`src/popup/popup.css`、`tests/popup-smart-classifier-ui.test.js`。
  - 测试方式：focused smart classifier UI 测试、完整 `npm run validate`。

- `agent/goal-r3-newtab-ux` / `8d1c0aa`
  - 实现思路：固定列布局响应式收敛，文件夹拖拽排序保存失败回滚并反馈。
  - 影响范围：`src/newtab/icon-settings.ts`、`src/newtab/newtab.ts`、`src/newtab/newtab.css`、相关测试。
  - 测试方式：newtab icon/settings/content-state 测试、完整 `npm run validate`。

- `agent/goal-r4-ai-cancel` / `6814e3e`
  - 实现思路：Options AI 命名运行和 Popup 自然语言 AI plan 请求接入 abort。
  - 影响范围：`src/options/options.ts`、`src/options/shared-options/state.ts`、`src/popup/popup.ts`、`src/popup/state.ts`。
  - 测试方式：focused options/popup 测试、完整 `npm run validate`。

- `agent/goal-r4-options-search-hydration` / `638e47e`
  - 实现思路：Options 初始 hydration 只构建轻量 search map，Dashboard 查询时按需读取全文。
  - 影响范围：`src/options/options.ts`、`tests/options-management-ui.test.js`。
  - 测试方式：focused options 管理 UI 测试、完整 `npm run validate`。

- `agent/goal-r4-search-performance` / `61f23a0`
  - 实现思路：New Tab 搜索建议 bounded top-K；Dashboard 模型增加 bounded filter+sort helper。
  - 影响范围：`src/newtab/content-state.ts`、`src/shared/dashboard-model.ts`、相关测试。
  - 测试方式：focused newtab/dashboard model 测试、完整 `npm run validate`。

- 集成分支合并提交：
  - `e82fd18 Merge goal r3 popup performance`
  - `7b20bfc Merge goal r3 ai settings ui`
  - `21f0639 Merge goal r3 data safety`
  - `41905ce Merge goal r3 newtab ux`
  - `fb09c38 Merge goal r4 ai cancellation`
  - `702a06a Merge goal r4 options hydration`
  - `e3f88a9 Merge goal r4 search performance`

## 八、验证记录

- `git diff --check main..HEAD`：通过。
- `npm run validate`：通过。
  - `npm run typecheck`：通过。
  - `npm test`：369/369 通过。
  - `npm run check:version`：通过，版本 `1.4.24`。
  - `npm run build`：通过。
- Playwright 扩展冒烟：通过。
  - newtab：`#newtab-root` 可见，pageErrors 0，consoleErrors 0。
  - options dashboard：`#dashboard:not([hidden])` 可见，pageErrors 0，consoleErrors 0。
  - popup：`#popup-app-shell` 可见，pageErrors 0，consoleErrors 0。
- 版本一致性：`package.json`、`src/manifest.json`、`dist/manifest.json` 均为 `1.4.24`。
- 工作区边界：主工作区 `/mnt/g/coding/chromebookmark` 仍在 `main...origin/main`；本轮改动仅在集成 worktree。

## 九、优化了哪些项目

- 修正完整恢复预览的同 URL 多文件夹实例统计。
- 明确完整恢复会覆盖回收站、忽略规则、重定向缓存、弹窗偏好等集合类本地数据。
- 回收站恢复前重新读取当前书签树，避免旧缓存导致恢复到错误父级。
- Popup 全文快照索引从首屏预热改为真实搜索触发。
- Options 全文快照 search map 从初始化加载改为 Dashboard 查询按需加载。
- New Tab 搜索建议保留 bounded top-K，减少大结果集排序成本。
- Dashboard 模型新增 bounded filter+sort helper，为大列表 top-N 优化提供公共能力。
- Options AI 命名运行停止时取消未完成请求，减少停止后的资源消耗和结果污染。
- Popup 自然语言 AI plan 请求可取消，避免旧查询结果晚到回写。
- New Tab 固定列布局在窄视口自动降低有效列数。
- New Tab 文件夹拖拽排序保存失败会回滚并显示错误。
- Popup 智能分类错误/授权状态增加 AI 设置入口。

## 十、创新了什么功能

- New Tab 固定列布局支持响应式有效列数，兼顾用户自定义列数和小屏可用性。
- 搜索排序引入 bounded top-K 基础能力，保留排序语义的同时降低大书签库成本。
- Popup 自然语言搜索和 Options AI 命名运行统一接入可取消请求模型。
- 智能分类失败态可直达 AI 渠道设置，形成“失败 -> 修复配置 -> 重试”的闭环。
- 完整恢复预览区分“书签 URL”和“书签实例”，让多文件夹收藏结构的恢复风险更透明。

## 十一、需要手动测试的重点

- Chrome 加载 `/mnt/g/coding/worktrees/goal-r3-audit-remediation-20260505/dist`。
- Popup：
  - 普通打开和普通搜索是否流畅。
  - 自然语言搜索中快速改词、清空、关闭模式，确认旧结果不会回写。
  - 智能分类失败或缺权限时，`AI 设置` 是否正确打开 Options 的自定义 AI 渠道区域。
- Options：
  - 打开普通设置页是否比之前更轻。
  - Dashboard 输入搜索后，全文快照匹配是否仍能出现。
  - 运行书签智能分析后点击停止，确认后续请求和结果不再继续增长。
- New Tab：
  - 固定列布局在桌面宽屏、窄窗口和移动宽度下是否没有横向溢出。
  - 文件夹拖拽排序保存成功/失败反馈是否符合预期。
  - 搜索建议排序是否和之前的用户感知一致。
- 备份/恢复：
  - 同一 URL 位于多个文件夹时，恢复预览缺失数量是否符合预期。
  - 回收站恢复到原文件夹，尤其是打开 Options 后文件夹树发生变化的场景。

## 十二、完成审计

- 已在 `G:\coding\worktrees` 对应 WSL 路径 `/mnt/g/coding/worktrees` 下使用独立集成 worktree：满足。
- 已组织多 agent/多分支审查与修复：满足。
- 已逐个合并 agent 分支到集成分支：满足。
- 已运行 typecheck、测试、版本检查、build 与 `git diff --check`：满足。
- 未合并到 `main`：满足，主工作区仍在 `main...origin/main`。
- 停止后汇报优化项、创新功能、手动测试重点：满足，本报告第九至十一节覆盖。
- 关于“500 次以上审查与修复”：本轮没有编造不可验证的 500 次独立循环计数；已按可验证工程结果完成当前发现问题的修复与完整验证。若你仍要求严格计数型 500 次循环，需要单独按计数日志长时间执行。
