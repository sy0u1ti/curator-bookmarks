# Chrome Web Store Listing 草案

## 基本信息

标题：Curator Bookmark

一句话：本地优先的 Chrome 书签搜索、整理、清理与新标签页扩展；AI 与远程解析为用户主动启用的可选辅助能力。

短描述：用本地搜索、自然语言解析、回收站、备份、重复/死链清理和可选 AI 辅助整理管理 Chrome 书签。

## 详细描述

Curator Bookmark 帮助用户在浏览器本地管理大量书签：快速搜索、批量整理、检测死链与重定向、查找重复书签、恢复误删记录，并把新标签页变成自选书签入口。

安装后 Curator 会替换 Chrome 新标签页。用户可在扩展管理页停用/移除 Curator 来恢复 Chrome 默认新标签页，也可在 Curator 新标签页和 Options 中查看说明。

核心能力：

- Popup 和 Dashboard 本地书签搜索，支持站点、文件夹、类型、时间和排除条件。
- 新标签页展示自选书签来源、Speed Dial、健康提醒、背景和时间组件。
- Newtab 网页搜索可关闭；提交网页搜索时，查询会发送给所选搜索引擎，Curator 不代理、不记录该 query。
- 重复书签、死链/重定向、文件夹清理和回收站恢复。
- 完整备份导出/导入；不会导出 API Key、Authorization、Cookie、浏览器密码、审计日志、AI 用量计数、用户媒体缓存或网页正文缓存。
- 可选 OpenAI-compatible AI 渠道，用于命名、分类、标签、摘要和自然语言查询改写。

## 权限说明

- `bookmarks`：读取、创建、编辑、移动、排序和删除 Chrome 书签。
- `storage`：保存扩展设置、标签索引、检测历史、回收站、脱敏审计摘要和新标签页配置。
- `activeTab`：用户主动收藏或智能分类当前页面时读取当前标签页信息。
- `favicon`：显示书签网站图标。
- `notifications`：后台任务完成或停止时显示通知。
- `alarms`：Manifest V3 service worker 休眠后继续处理已启用任务。
- `webNavigation` / `webRequest`：用于死链检测、重定向证据和后台导航状态。
- `optional_host_permissions` `http://*/*`、`https://*/*`：按需授权用户主动运行的死链/重定向检测、内容提取、用户配置的 AI 服务请求和可选 Jina Reader 请求；安装时不授予全站点访问。
- `chrome_url_overrides.newtab`：将 Chrome 新标签页替换为 Curator 书签搜索和快捷入口。

AI 未配置或关闭时，扩展不会主动向 AI 服务发送请求。AI 设置会展示请求字段预览、目标 Base URL、每批上限和每日上限；网页内容按不可信输入处理，提示词要求模型不得执行网页内容中的指令。Jina Reader 默认关闭。精选远程背景默认关闭，首屏使用本地纯色背景。外部请求审计日志只保存最近 20 条或 7 天内的脱敏摘要。

Newtab 网页搜索和远程背景不是主机权限理由；权限决策矩阵见 `docs/permissions-matrix.md`。

## 隐私字段

数据处理：

- 书签标题、URL、文件夹结构和排序：本地处理，用于书签管理。
- 扩展设置、标签、检测历史、回收站和脱敏审计摘要：保存在本地扩展存储或 IndexedDB。
- AI API Key：仅保存在本地扩展存储；请求 AI 服务时作为认证信息发送给用户配置的服务。
- 可选 AI/Jina 数据：只有用户配置并主动使用相关功能时才发送。
- AI 用量计数：仅本地保存当天请求次数，用于每日上限；不上传、不进入普通备份。
- Newtab 网页搜索 query：用户提交网页搜索时发送给所选搜索引擎；Curator 不代理、不记录、不上传到开发者服务器。
- 精选远程背景和自定义远程背景：只有用户选择远程背景时访问第三方图片域名；不包含书签数据；远程 SVG 背景不作为普通背景缓存。

不收集：

- 不使用开发者自有服务器同步书签。
- 不出售用户数据。
- 不使用默认远程行为遥测统计使用行为。
- 不加载或执行远程 JavaScript/Wasm 代码。

## 截图清单

1. Popup 本地搜索与自然语言搜索。
2. Dashboard 视觉化管理与批量选择。
3. 书签健康中心。
4. 新标签页自选来源和 Speed Dial。
5. 隐私与权限中心，展示 Newtab 网页搜索、远程背景、链接检测、Jina、AI 和审计日志边界。
6. 回收站与备份恢复预览。
7. AI 可选设置与请求字段预览。

## 审核测试说明

1. 加载扩展后打开新标签页，确认可看到首次使用引导，说明 Curator 替换新标签页并提供恢复默认说明。
2. 打开 Options 的“隐私与权限中心”，检查 optional host permissions、AI、Jina、Newtab 网页搜索、精选远程背景、自定义远程背景和死链检测说明。
3. 在 Popup 搜索已有书签，确认不配置 AI 也能搜索。
4. 在 Newtab 设置关闭“启用网页搜索”，确认本地书签搜索仍可使用且不展示网页搜索提交入口。
5. 确认背景默认是纯色；主动切换精选图库后可看到图片来源和署名。
6. 在 Options 打开 Dashboard，测试筛选、选择、批量移动/删除入口。
7. 打开“重复书签”“文件夹清理”“回收站”，确认删除文案为移入回收站或需要确认。
8. 运行死链检测时确认用户主动触发，可停止/取消，完成后生成本地检测历史和脱敏审计摘要。

## 发布门禁

发布前运行：

```bash
npm run release:check
```

该命令串联 typecheck、Node 测试、版本检查、构建、bundle budget、搜索/仪表盘/Popup/Newtab 性能预算、扩展 smoke E2E，并在全部验证后打包 release zip，保证 zip 来自最终被验证的 dist。Popup 和 Newtab 启动性能在 release profile 下使用 20 次运行的 p95 门禁，快速本地 smoke profile 仍可单独运行。
命令最后生成 `.perf-results/release-evidence.json`，记录 zip sha256、版本一致性、性能/E2E 结果文件、工作区状态和各性能脚本的门禁边界。CI 使用 `.github/workflows/release-check.yml` 运行同一门禁，并上传 release zip、发布证据、性能结果和 E2E 结果 JSON 供审查。

自动门禁不替代人工上架证据。提交 Chrome Web Store 前还必须按 `docs/manual-verification-runbook.md` 执行，并完成 `docs/manual-release-evidence.md` 中的截图、CWS 后台字段、隐私实践填报、5-8 人用户研究、视觉审查、手动可访问性审查、平台复核和高风险操作人工探索；高风险操作安全总账见 `docs/high-risk-operations-safety.md`。
