<p align="center">
  <img src="src/assets/icon128.png" alt="Curator Bookmark" width="96" height="96">
</p>

<h1 align="center">Curator Bookmark</h1>

<p align="center">
  本地优先的 Chrome 书签管理扩展 — 查找、整理、清理和重新组织你的浏览器书签
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome%20Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/TypeScript-ES2022-3178c6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/github/v/release/shangy1yi/curator-bookmarks" alt="GitHub Release">
</p>

---

## 功能特性

**书签弹窗管理** — 在扩展弹窗中浏览、搜索、编辑、移动和删除书签，支持模糊搜索和当前网页快速收藏。
<details>

  <summary>查看书签仪表盘截图</summary>

  

  <p align="center">

    <img src="docs/images/popup-preview.png" alt="书签弹窗管理视图" width="60%">

  </p>

</details>

**书签仪表盘** — 在全屏视觉化管理页中以密集卡片查看全部书签。支持搜索、批量选择、批量移动/删除、拖拽到文件夹快速移动，以及拖拽到删除区后确认移入回收站。
<details>

  <summary>查看书签仪表盘截图</summary>

  

  <p align="center">

    <img src="docs/images/dashboard-preview.png" alt="书签仪表盘全屏卡片视图" width="100%">
    <img src="docs/images/dashboard-preview2.png" alt="书签仪表盘全屏卡片视图2" width="100%">

  </p>

</details>

**书签新标签页** — 接管 Chrome 新标签页，将书签文件夹展示为可视化图标入口。支持自定义布局预设、时钟、搜索栏和背景。
<details>

  <summary>查看书签仪表盘截图</summary>

  

  <p align="center">

    <img src="docs/images/newtabs-preview.png" alt="书签新标签页视图" width="100%">

  </p>

</details>

**书签检测与清理** — 检测不可访问书签、处理重定向、清理重复书签，配合历史记录、忽略规则和回收站保障操作可追溯。

**AI 标签与命名** — 配置 OpenAI 兼容的 AI 服务，读取网页内容后生成结构化标签、主题、别名和摘要，并基于页面语义优化书签标题、推荐收藏位置。

**本地语义搜索** — Popup 和仪表盘搜索会结合标题、URL、路径、AI 标签、手动标签、别名、摘要和中文拼音首字母进行本地加权匹配，例如用 `bd` 找到百度相关书签。

**Popup 自然语言搜索** — Popup 搜索框旁的 `AI` 按钮可开启自然语言搜索，用于理解“帮我找上周收藏的那个 React 表格教程”这类带意图、时间和同义表达的查询。配置 AI 渠道后会调用 OpenAI 兼容接口改写查询；AI 未配置或不可用时，会回退到本地时间解析、停用词清理和同义词扩展。

**标签数据管理** — 标签库保存在本地，可导出、导入和清空。仪表盘支持手动修改标签、清除 AI 标签、单独重新生成 AI 标签，手动标签会优先用于展示和搜索。

## 安装

### 下载发行版

1. 前往 [Releases](https://github.com/shangy1yi/curator-bookmarks/releases) 下载最新 `curator-bookmarks-*.zip`
2. 解压 zip 文件
3. 打开 `chrome://extensions/`，开启右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择解压后的 `dist` 文件夹

### 从源码构建

需要 Node.js 18+。

```bash
npm install
npm run build
```

然后按上述步骤 3-4 加载 `dist` 文件夹。

## 开发

```bash
npm run dev          # Vite 开发模式（HMR）
npm run typecheck    # TypeScript 类型检查
npm test             # 运行测试
npm run validate     # 完整校验（类型检查 + 测试 + 版本检查 + 构建）
npm run pack:zip     # 构建并打包 release zip
```

## 隐私

Curator 将数据留在本地：

- 书签、历史、忽略规则、回收站和 AI 设置存储在 `chrome.storage.local`
- API Key 仅保存在扩展本地存储中
- 仅在用户主动触发检测、AI 分析、智能分类或开启 Popup 自然语言搜索时，才会访问外部服务
- 启用 Jina Reader 远程解析时，目标网页 URL 会发送给 Jina Reader

## 技术栈

| 类别 | 技术 |
|---|---|
| 语言 | TypeScript (ES2022) |
| 构建 | Vite + @crxjs/vite-plugin |
| 扩展格式 | Chrome Manifest V3 |
| 运行时依赖 | 无 |
| UI | 原生 DOM 操作 |

## 许可

[MIT](LICENSE)
