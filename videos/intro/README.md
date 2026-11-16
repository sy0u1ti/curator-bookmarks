# 让收藏，回到日常

Curator 1.6 的 96 秒介绍短片，1920 × 1080、30 fps。用纸白、墨黑、书页和中英文字体讲述收藏如何回到阅读与工作。无口播，配有本项目生成的音乐。

[观看成片](../../assets/readme/curator-intro.mp4)

## 预览与导出

在本目录执行：

```sh
npm ci
npm run dev
```

使用 Ego 打开 `http://127.0.0.1:4316/`。播放器可以播放、暂停或跳到任一分镜。点击 **渲染画面**，等待状态显示“渲染完成”，随后执行：

```sh
npm run export
```

导出需要 PATH 中的 FFmpeg 和 FFprobe。最终视频位于仓库的 `assets/readme/curator-intro.mp4`；含配乐的高码率版本、无声画面和检查报告位于 `.tmp/curator-intro/`。导出脚本验证分辨率、2880 个画面帧、时长和立体声音轨，并将 MP4 的索引移至文件头以支持渐进播放。

浏览器渲染使用 `@remotion/web-renderer`，复用 Ego，不启动额外的 Chromium。渲染后的画面通过本机 Vite 服务保存，不会上传。音乐在导出时合入，播放器预览时会同步播放。

## 修改

- [storyboard.md](storyboard.md)：叙事、分镜和功能边界。
- [src/Film.tsx](src/Film.tsx)：12 个镜头及转场，动画只由 Remotion 帧号驱动。
- [src/design.ts](src/design.ts)：尺寸、帧率、时间轴、颜色与字体。
- [public/assets](public/assets)：1.6 构建的真实界面，使用隔离演示数据；阅读页面和书页是叙事图形。
- [scripts/score.mjs](scripts/score.mjs)：确定性的原创配乐，80 BPM，无外部采样；`npm run score` 可重建。

字体随工程本地载入：Noto Sans SC、Noto Serif SC 和 Source Sans 3 的 WOFF2 子集；各自的 OFL 许可证位于 `public/fonts/`。新增中文文案时，用装有 `fonttools` 与 `brotli` 的 Python 重新生成子集：

```sh
python scripts/subset-fonts.py --font-dir <字体源文件目录>
```

目录中需有 `NotoSansSC-VF.ttf`、`NotoSerifSC-VF.ttf` 和 `SourceSans3-Regular.ttf`。已有文案的预览与导出不需要 Python 或系统字体。

Remotion 依赖固定为同一版本；视频工程独立于扩展构建，不进入扩展安装包。

```sh
npm run typecheck
npm run build
```
