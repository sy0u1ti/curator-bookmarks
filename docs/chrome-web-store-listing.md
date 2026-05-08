# Chrome Web Store Listing 草案

## 基本信息

标题：Curator Bookmark

一句话：本地优先的 Chrome 书签搜索、整理、清理与新标签页扩展。

短描述：用本地搜索、自然语言解析、回收站、备份、重复/死链清理和可选 AI 辅助整理管理 Chrome 书签。

## 详细描述

Curator Bookmark 帮助用户在浏览器本地管理大量书签：快速搜索、批量整理、检测死链与重定向、查找重复书签、恢复误删记录，并把新标签页变成自选书签入口。

核心能力：

- Popup 和 Dashboard 本地书签搜索，支持站点、文件夹、类型、时间和排除条件。
- 新标签页展示自选书签来源、Speed Dial、健康提醒、背景和时间组件。
- 重复书签、死链/重定向、文件夹清理和回收站恢复。
- 完整备份导出/导入；不会导出 API Key、Cookie、浏览器密码或网页正文缓存。
- 可选 OpenAI-compatible AI 渠道，用于命名、分类、标签、摘要和自然语言查询改写。

## 权限说明

- `bookmarks`：读取、创建、编辑、移动、排序和删除 Chrome 书签。
- `storage`：保存扩展设置、标签索引、检测历史、回收站、审计日志和新标签页配置。
- `activeTab`：用户主动收藏或智能分类当前页面时读取当前标签页信息。
- `favicon`：显示书签网站图标。
- `notifications`：后台任务完成或停止时显示通知。
- `alarms`：Manifest V3 service worker 休眠后继续处理已启用任务。
- `webNavigation` / `webRequest`：用于死链检测、重定向证据和后台导航状态。
- `host_permissions` `http://*/*`、`https://*/*`：用于用户主动运行的死链/重定向检测、内容提取、用户配置的 AI 服务请求和可选 Jina Reader 请求。

AI 未配置或关闭时，扩展不会主动向 AI 服务发送请求。Jina Reader 默认关闭。所有外部请求摘要会写入本地审计日志。

## 隐私字段

数据处理：

- 书签标题、URL、文件夹结构和排序：本地处理，用于书签管理。
- 扩展设置、标签、检测历史、回收站和审计日志：保存在本地扩展存储或 IndexedDB。
- AI API Key：仅保存在本地扩展存储；请求 AI 服务时作为认证信息发送给用户配置的服务。
- 可选 AI/Jina 数据：只有用户配置并主动使用相关功能时才发送。

不收集：

- 不使用开发者自有服务器同步书签。
- 不出售用户数据。
- 不使用远程遥测统计使用行为。
- 不加载或执行远程 JavaScript/Wasm 代码。

## 截图清单

1. Popup 本地搜索与自然语言搜索。
2. Dashboard 视觉化管理与批量选择。
3. 书签健康中心。
4. 新标签页自选来源和 Speed Dial。
5. AI 设置向导与隐私/权限中心。
6. 回收站与备份恢复预览。

## 审核测试说明

1. 加载扩展后打开新标签页，确认可看到首次使用引导，可跳过 AI。
2. 打开 Options 的“隐私与权限中心”，检查 host permissions、AI、Jina 和死链检测说明。
3. 在 Popup 搜索已有书签，确认不配置 AI 也能搜索。
4. 在 Options 打开 Dashboard，测试筛选、选择、批量移动/删除入口。
5. 打开“重复书签”“文件夹清理”“回收站”，确认删除文案为移入回收站或需要确认。
6. 运行死链检测时确认用户主动触发，完成后生成本地检测历史和审计日志。

## 发布门禁

发布前运行：

```bash
npm run release:check
```

该命令串联 typecheck、Node 测试、版本检查、构建、打包、bundle budget、关键性能预算和扩展 smoke E2E。
CI 使用 `.github/workflows/release-check.yml` 运行同一门禁，并上传 release zip、性能结果和 E2E 结果 JSON 供审查。
