# Curator Design System

## Tokens

- 背景：`--bg`、`--surface-0`、深色透明层用于扩展页面和新标签页。
- 文本：`--text-strong`、`--text`、`--text-muted`、`--text-dim`。
- 状态：success、warning、danger、muted 通过 `options-chip`、metric card 和按钮语义表达。
- 圆角：工具面板和卡片保持 8px 左右，复杂弹窗可使用现有 `--radius-lg` / `--radius-xl`。
- 动效：使用现有 `--ease-standard` 和短时淡入；大列表滚动路径避免昂贵模糊、`:has()` 和 scroll-position will-change。

## Components

- Button：主要操作用 `.options-button`，危险操作用 `.danger`，次级操作用 `.secondary`。
- Chip / Tag：用于权限状态、AI 状态、检测状态和轻量指标。
- EmptyState：必须说明原因和下一步，不只显示“暂无数据”。
- PermissionCard：隐私与权限中心使用 `.privacy-permission-card`，包含权限、用途和保护链路。
- DecisionCard：健康中心、重复检测和可用性检测先展示影响范围，再提供操作。
- ConfirmDialog：批量移动、删除、恢复和清理统一使用确认弹窗；永久删除必须二次确认。
- BookmarkPathBreadcrumb：路径展示使用已有 dashboard breadcrumb 和 folder path helpers。

## States

- loading：使用 skeleton、dot matrix loader 或简短状态文字。
- empty：说明为什么为空，并提供可执行入口。
- error：展示原因和恢复动作。
- success：展示结果摘要和后续入口。

## Writing

- AI、权限、外部请求必须说明发送字段、目标服务和关闭方式。
- 删除类文案默认写“移入回收站”；永久删除必须明确不可恢复。
- 不把 AI 作为本地功能前置条件。
