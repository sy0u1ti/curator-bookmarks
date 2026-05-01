<p align="center">
  <img src="src/assets/icon128.png" alt="Curator Bookmark" width="96" height="96">
</p>

<h1 align="center">Curator Bookmark</h1>

<p align="center">
  本地优先的 Chrome 书签管理扩展，用于搜索、整理、备份、清理和重新组织浏览器书签。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome%20Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
  <img src="https://img.shields.io/badge/TypeScript-ES2022-3178c6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/github/v/release/sy0u1ti/curator-bookmarks" alt="GitHub Release">
</p>

---

## 功能概览

### Popup 书签管理

- 在扩展弹窗中浏览书签栏、展开文件夹、打开、编辑、移动和删除书签。

- 支持当前网页快速收藏和智能分类。

<p align="center">
  <img src="https://github.com/sy0u1ti/picx-images-hosting/raw/master/image.9kgsh3xs35.png" alt="popup">
</p>



### 搜索与高级语法

- Popup 和书签仪表盘都支持本地搜索，匹配标题、URL、域名、文件夹路径、AI 标签、手动标签、别名、摘要和中文拼音首字母。

- Popup 可切换自然语言搜索；配置 AI 渠道后可用 AI 改写查询，未配置或不可用时回退到本地解析。

### 零负担收藏 Inbox

- 快捷键直接收藏当前网页到 `Inbox / 待整理`。

- 后台自动分析网页内容、生成标签和摘要，并移动到推荐文件夹。

### 书签仪表盘

- 在全屏仪表盘中用卡片方式查看、筛选和批量处理书签。

- 支持批量选择、批量移动、批量删除到回收站，以及拖拽到目标文件夹。

- 支持编辑手动标签、清除 AI 标签和单条重新生成 AI 标签。

<p align="center">
  <img src="https://github.com/sy0u1ti/picx-images-hosting/raw/master/image.2h8x1hwct6.webp" alt="仪表盘">
  <img src="https://github.com/sy0u1ti/picx-images-hosting/raw/master/image.7pwi0e0vk.webp" alt="仪表盘2">
</p>
  
### 书签管理

- 死链检测

- 重定向更新可批量把书签 URL 更新为最终落地地址

- 重复书签检测

- 扫描空文件夹、深层低价值文件夹、多层单一路径、同名文件夹和超大文件夹

### AI功能

- 支持 OpenAI 兼容的 Responses API 和 Chat Completions API。

- AI生成摘要、主题、标签、别名、标题建议和推荐收藏位置。

  
### 书签新标签页

- 接管 Chrome 新标签页，展示自选的书签文件夹。

- 支持自定义图标、拖拽排序、背景图片/视频/颜色、时间日期、搜索栏和图标布局。

- 书签加新标签页的全新体验

  
  
  

## 安装

### 首次使用

1. 安装并加载扩展后，打开新标签页。
2. 如果新标签页提示没有书签来源，点击 **打开设置**。
3. 在 **书签来源** 中选择要展示的文件夹，或点击 **新增书签来源文件夹** 创建专用文件夹。
4. 回到新标签页后，可继续调整搜索栏、背景、时间日期和图标布局。

  

### 下载发行版

  

1. 前往 [Releases](https://github.com/sy0u1ti/curator-bookmarks/releases) 下载最新 `curator-bookmarks-*.zip`

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

npm run dev          # Vite 开发模式

npm run typecheck    # TypeScript 类型检查

npm test             # 运行测试

npm run validate     # 类型检查 + 测试 + 版本检查 + 构建

npm run pack:zip     # 构建并打包 release zip

```

  
  
  

## 许可

  

[MIT](LICENSE)
