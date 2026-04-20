# obsidian-bookmark

黑曜书签 — Chrome 本地书签管理扩展

## 构建方法

### 1. 下载源码
在 GitHub 页面点击 **Code → Download ZIP**，下载并解压项目。

### 2. 安装 Node.js
建议安装 **Node.js 18+**。

检查是否安装成功：

```bash
node -v
npm -v
```

### 3. 进入项目目录

```bash
cd obsidian-bookmark
```

### 4. 安装依赖

```bash
npm install
```

### 5. 构建项目

```bash
npm run build
```

构建完成后会生成 `dist` 文件夹。

## 在 Chrome 中加载扩展

1. 打开 `chrome://extensions/`
2. 打开右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目根目录下的 `dist` 文件夹

## 开发模式

```bash
npm run dev
```
