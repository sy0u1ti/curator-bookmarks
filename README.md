# Curator Bookmark

Curator Bookmarks 是一个本地优先的 Chrome 原生书签管理扩展，用来更快地查找、整理、清理和重新组织浏览器书签。

## 核心功能

### 书签弹窗管理

在扩展弹窗中浏览和搜索 Chrome 书签，快速完成编辑、移动、删除和当前网页收藏。

### 书签新标签页

扩展会接管 Chrome 新标签页，并把名为“标签页”的书签文件夹展示为可视化入口。新标签页支持书签图标展示、排序、添加、编辑，以及时间、搜索栏和背景等基础个性化设置。
为用户提供书签与新标签页相结合的全新便捷体验。

### 书签检测与清理

设置页提供面向书签库的整理工具，用于检测不可访问书签、处理重定向地址、清理重复书签，并通过历史、忽略规则和回收站保留可追踪的整理记录。

### AI 书签整理

支持配置 OpenAI 兼容的 AI 服务，用于批量优化书签标题、为当前网页推荐收藏位置，以及在新增书签后自动分析并归类到合适文件夹。


## 隐私与权限

Curator 尽量把数据留在本地：

- 书签、历史、忽略规则、回收站和 AI 设置保存在 `chrome.storage.local`。
- `API Key` 仅保存在当前扩展的本地存储中。
- 只有在你主动进行检测、AI 分析或智能分类时，才会请求访问相关网站或 AI 服务地址。
- 启用 Jina Reader 远程解析后，目标网页 URL 会发送给 Jina Reader；请谨慎用于隐私页面。

扩展会使用 Chrome 书签、存储、新标签页覆盖、通知、favicon、导航检测和按需站点访问等权限，以支持书签管理、新标签页展示、可用性检测和 AI 整理。

## 安装与加载

### 方式一：下载发行版

这是最方便的安装方式，不需要安装 Node.js，也不需要自己构建。

1. 打开 [GitHub Releases](https://github.com/shangy1yi/curator-bookmarks/releases)
2. 下载最新版本里的 `curator-bookmarks-*.zip`
3. 解压 zip 文件
4. 打开 `chrome://extensions/`
5. 打开右上角的“开发者模式”
6. 点击“加载已解压的扩展程序”
7. 选择解压后的 `dist` 文件夹

### 方式二：从源码构建

适合需要本地开发或修改源码的情况。需要 Node.js 18+。

1. 安装依赖：

```bash
npm install
```

2. 构建扩展：

```bash
npm run build
```

构建完成后会生成 `dist` 目录。

3. 打开 `chrome://extensions/`
4. 打开右上角的“开发者模式”
5. 点击“加载已解压的扩展程序”
6. 选择项目根目录下的 `dist` 文件夹

## 开发命令

```bash
# 启动 Vite 开发模式
npm run dev

# 类型检查
npm run typecheck

# 运行测试
npm test

# 完整校验：类型检查、测试、版本一致性检查、构建
npm run validate

# 构建并打包 release zip
npm run pack:zip
```
