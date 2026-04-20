# 在 AI 智能命名界面增加「获取模型」按钮并改造模型选择器为弹窗

## Context

目前 `AI 智能命名` 界面的「模型」字段是一个原生 `<select id="ai-model-select">`，选项由 `AI_NAMING_PRESET_MODELS`（预设）+ 用户通过 `设置更多模型` 弹窗手动录入的 `customModels` 组合而成。用户希望：

1. 在该界面新增「获取模型」按钮：读取已填写的 `baseUrl` + `apiKey`，调用 `GET {baseUrl}/models` 动态拉取后端实际支持的模型列表。
2. 把「模型」字段的原生下拉替换成**按钮触发的模态弹窗**（和现有「筛选文件夹」弹窗 `#scope-modal-backdrop` 视觉一致），弹窗内支持搜索与点选拉取到的模型。
3. 弹窗 UX 与 [scope-modal](src/options/options.html#L720-L735) / [`renderScopeModal`](src/options/options.ts#L2791) 保持一致：`.options-modal-backdrop` + `.options-modal.options-modal-wide` + `.options-search` + `.modal-results` + `.scope-folder-card`。

> 说明：这是一次可视化交互升级 + 新增接口调用，不改变已有的批量命名、持久化格式（除新增一个可选字段）、权限流。

## 参考的现有实现 / 可复用

- 弹窗骨架：[options.html:720-735](src/options/options.html#L720-L735)（`#scope-modal-backdrop`）
- 弹窗渲染：[`renderScopeModal`](src/options/options.ts#L2791)、[`buildScopeFolderCard`](src/options/options.ts#L2853)
- 弹窗状态机：[`openScopeModal`](src/options/options.ts#L3516) / [`closeScopeModal`](src/options/options.ts#L3545) / [`managerState.scopeModalOpen`](src/options/shared-options/state.ts#L124)
- 显隐工具：[`setModalHidden`](src/options/shared-options/utils.ts#L39)
- 带超时的 fetch：[`fetchWithRequestTimeout`](src/options/options.ts#L1081)
- 现有 AI 端点构造：[`getAiNamingEndpoint`](src/options/options.ts#L2712)
- AI 配置归一化：[`normalizeAiNamingSettings`](src/options/options.ts#L205) / [`createDefaultAiNamingSettings`](src/options/shared-options/state.ts#L28)
- 动态权限：[`ensureAiNamingProviderPermission`](src/options/options.ts#L1826)（`optional_host_permissions`）
- 搜索归一化：`normalizeText`（`src/shared/text.ts`）
- 持久化 key：`STORAGE_KEYS.aiNamingSettings` → `saveAiNamingSettings`

## 设计方案

### 1. 配置与状态

- `src/options/shared-options/constants.ts`
  - 保留 `AI_NAMING_MANAGE_MODELS_VALUE`（依旧用作「设置更多模型」入口，移入弹窗底部按钮）。
  - 新增常量 `AI_NAMING_MODELS_ENDPOINT_SUFFIX = 'models'`（若后续要独立调整）。
- `src/options/shared-options/state.ts`
  - `createDefaultAiNamingSettings()` 增加 `fetchedModels: []`。
  - `managerState` 增加：
    - `aiModelPickerModalOpen: false`
    - `aiModelPickerSearchQuery: ''`
  - `aiNamingState` 增加：
    - `fetchingModels: false`
    - `lastFetchModelsError: ''`
    - `lastFetchModelsAt: 0`

### 2. Settings 归一化与持久化（options.ts）

- `normalizeAiNamingSettings` 中解析 `fetchedModels`，复用 `normalizeAiNamingCustomModels` 的同款去重/截断逻辑（可抽一个通用 `normalizeModelIdList` 放在当前文件内，避免跨文件改动）。上限放宽到 200（fetched 可能较多）。
- `serializeAiNamingSettings` 输出 `fetchedModels`。
- `getAiNamingModelOptions` 合并顺序：预设 → customModels → fetchedModels → 当前值 →「设置更多模型」入口（不再用 `<select>`，改为渲染卡片，但合并逻辑保留，用于搜索匹配）。

### 3. HTML（options.html）

两处改动：

**A. AI 模型字段区（约 L310-L319）**

- 把 `<select id="ai-model-select" class="ai-provider-select"></select>` 替换为：
  ```html
  <button id="ai-model-picker-trigger" class="scope-picker-trigger" type="button" aria-label="选择 AI 模型">
    <span id="ai-model-picker-label">gpt-5-mini</span>
    <span class="scope-picker-caret" aria-hidden="true"></span>
  </button>
  ```
- 在同一字段组中追加一个「获取模型」按钮：
  ```html
  <button id="ai-fetch-models" class="options-button secondary small" type="button">获取模型</button>
  ```
  位置：紧邻模型触发按钮下方/旁边（复用 `.ai-provider-hint` 区），与「设置更多模型」并列。
- 补充一个状态行 `<p id="ai-fetch-models-status" class="ai-provider-connectivity muted"></p>` 用于展示拉取状态/错误。

**B. 模态弹窗（追加到 L735 之后，与 scope-modal 同级）**

```html
<div id="ai-model-picker-modal-backdrop" class="options-modal-backdrop hidden" aria-hidden="true">
  <section class="options-modal options-modal-wide" role="dialog" aria-modal="true" aria-labelledby="ai-model-picker-modal-title">
    <button id="close-ai-model-picker-modal" class="options-modal-close" type="button" aria-label="关闭 AI 模型弹窗">×</button>
    <p class="options-section-label">AI Models</p>
    <h2 id="ai-model-picker-modal-title">选择 AI 模型</h2>
    <p id="ai-model-picker-modal-copy" class="options-modal-copy">输入关键字筛选，点击卡片即可选中。可点击「获取模型」从 API 拉取最新列表。</p>
    <label class="options-search">
      <span class="options-search-label">搜索模型</span>
      <input id="ai-model-picker-search-input" class="options-search-input" type="search" placeholder="搜索模型 ID">
    </label>
    <div id="ai-model-picker-results" class="detect-results modal-results" role="listbox">
      <div class="detect-empty">尚未获取模型列表，下方可点击「获取模型」拉取。</div>
    </div>
    <div class="options-modal-actions ai-model-modal-actions">
      <div class="ai-model-picker-footer-start">
        <button id="ai-model-picker-fetch" class="options-button secondary" type="button">获取模型</button>
        <button id="ai-model-picker-manage" class="options-button secondary" type="button">设置更多模型</button>
      </div>
      <button id="cancel-ai-model-picker-modal" class="options-button secondary" type="button">关闭</button>
    </div>
  </section>
</div>
```

### 4. DOM 注册（shared-options/dom.ts）

删除：`dom.aiModelSelect`。

新增：
- `dom.aiModelPickerTrigger`、`dom.aiModelPickerLabel`
- `dom.aiFetchModels`、`dom.aiFetchModelsStatus`
- `dom.aiModelPickerModalBackdrop`、`dom.aiModelPickerModalCopy`
- `dom.aiModelPickerSearchInput`、`dom.aiModelPickerResults`
- `dom.closeAiModelPickerModal`、`dom.cancelAiModelPickerModal`
- `dom.aiModelPickerFetchButton`、`dom.aiModelPickerManageButton`

### 5. 逻辑（options.ts）

**新增函数**（全部写在 options.ts 内，贴近现有 `openScopeModal` / `renderScopeModal` 的写法以减少审查负担）：

- `openAiModelPickerModal()`：校验未 running / applying；重置搜索；打开并 focus 搜索框。
- `closeAiModelPickerModal()`：关闭并清空搜索。
- `renderAiModelPickerModal()`：
  - `setModalHidden(...)`；
  - 合并候选：预设 + customModels + fetchedModels + 当前值（去重后），按搜索词过滤；
  - 使用 `.scope-folder-card` 样式渲染单行卡片，单行显示模型 ID；当前选中项 `.current`；
  - 同时在顶部展示 `fetchedModels.length` / `lastFetchModelsAt` 的摘要；
  - 错误态：拉取报错在 copy 行展示。
- `handleAiModelPickerResultsClick(event)`：从 `data-ai-model-id` 取值，更新 `aiNamingManagerState.settings.model` → `syncAiNamingSettingsDraftFromDom({ markDirty: true })` → 关闭弹窗 → `renderAiNamingSection()`。
- `handleFetchAiModels()`：
  1. `syncAiNamingSettingsDraftFromDom()` 拿到最新 `baseUrl/apiKey`；
  2. 若缺 `apiKey` 或 `baseUrl` → 设置 `lastFetchModelsError` 并返回（不抛权限请求）；
  3. `ensureAiNamingProviderPermission({ interactive: true })`，失败则提示「未授权该 Origin」；
  4. `fetchingModels = true`，渲染；
  5. `const url = getAiModelsEndpoint(settings)`；`fetchWithRequestTimeout(url, { method: 'GET', headers: { Authorization: 'Bearer ...' } }, timeoutMs)`；
  6. 解析：`payload.data`（OpenAI 规范）或 `payload.models`（一些兼容实现），取每项 `id`/`name`；去重；
  7. 写入 `aiNamingManagerState.settings.fetchedModels` → `saveAiNamingSettings()`；
  8. `lastFetchModelsAt = Date.now()`，清错误；
  9. 若当前 `settings.model` 不在合并候选中，**保持不变**（用户可能故意填自定义 ID）。
- `getAiModelsEndpoint(settings)`：
  ```ts
  const base = String(settings.baseUrl || '').replace(/\/+$/, '')
  if (base.endsWith('/models')) return base
  return `${base}/models`
  ```
- `renderAiModelPickerTrigger()`：更新 `dom.aiModelPickerLabel.textContent = settings.model || AI_NAMING_DEFAULT_MODEL`，`disabled` 跟随 `running / applying`。
- `renderAiFetchModelsStatus()`：展示 loading / 上次时间 / 错误。

**删除/改写**：

- 删除 `handleAiModelSelectChange`、`renderAiNamingModelOptions`（向 select 填 option 的逻辑）。
- `getAiNamingModelOptions` 保留但改造为**只返回 model ID 列表**（供弹窗候选合并），不再包含 `AI_NAMING_MANAGE_MODELS_VALUE` 哨兵（该功能改为弹窗内底部按钮）。
- `syncAiNamingSettingsDraftFromDom` 不再从 `dom.aiModelSelect.value` 取 model；改为从 `aiNamingManagerState.settings.model`（由弹窗选中写入）。其它字段保持不变。
- `renderAiNamingSection` 里把原对 `aiModelSelect` 的调用替换成 `renderAiModelPickerTrigger()` + 若弹窗开着则 `renderAiModelPickerModal()`。

**事件绑定（bindEvents）**：

```ts
dom.aiModelPickerTrigger?.addEventListener('click', openAiModelPickerModal)
dom.aiFetchModels?.addEventListener('click', handleFetchAiModels)
dom.aiModelPickerSearchInput?.addEventListener('input', (event) => {
  managerState.aiModelPickerSearchQuery = event.target.value
  renderAiModelPickerModal()
})
dom.aiModelPickerResults?.addEventListener('click', handleAiModelPickerResultsClick)
dom.closeAiModelPickerModal?.addEventListener('click', closeAiModelPickerModal)
dom.cancelAiModelPickerModal?.addEventListener('click', closeAiModelPickerModal)
dom.aiModelPickerFetchButton?.addEventListener('click', handleFetchAiModels)
dom.aiModelPickerManageButton?.addEventListener('click', () => { closeAiModelPickerModal(); openAiModelModal() })
dom.aiModelPickerModalBackdrop?.addEventListener('click', (event) => {
  if (event.target === dom.aiModelPickerModalBackdrop) closeAiModelPickerModal()
})
```

`handleKeydown` Esc 分支新增 `aiModelPickerModalOpen` 判定。

### 6. CSS（options.css）

多数复用已有类。新增少量：

- `.ai-model-picker-footer-start { display: flex; gap: 10px; }` —— 让底部「获取模型 / 设置更多模型」与「关闭」两端对齐。
- （可选）`.ai-model-card { padding: 12px 16px; }` —— 若觉得单行模型卡片比文件夹卡片更紧凑，新增一个轻量变体；否则直接复用 `.scope-folder-card`。

## 需要修改的关键文件

- [src/options/options.html](src/options/options.html)（L310-L319 替换 select；L735 后追加弹窗）
- [src/options/options.ts](src/options/options.ts)（删除 select 相关函数；新增 8 个模型弹窗/拉取函数；更新 `bindEvents` / `handleKeydown` / `normalizeAiNamingSettings` / `serializeAiNamingSettings` / `renderAiNamingSection`）
- [src/options/shared-options/dom.ts](src/options/shared-options/dom.ts)（增删 DOM 引用）
- [src/options/shared-options/state.ts](src/options/shared-options/state.ts)（`managerState` / `aiNamingState` / `createDefaultAiNamingSettings` 扩展）
- [src/options/options.css](src/options/options.css)（少量样式）

## 验证

1. `npm run typecheck`（项目 `// @ts-nocheck` 覆盖 options.ts，所以主要确保 dom.ts 等无类型问题）。
2. `npm run build`（vite 构建通过，产物落到 `dist/`）。
3. 用户在 Chrome 里手动加载 `dist/` 回归（符合项目 memory 约定：Claude 负责 build 通过，UI 由用户回归）：
   - 打开 `Options → AI 命名`；
   - 不填 apiKey/baseUrl 点「获取模型」→ 出现缺参提示；
   - 填入正确 apiKey/baseUrl，点「获取模型」→ 状态行显示「已拉取 N 个模型 · HH:MM」；
   - 点模型触发按钮 → 弹窗风格和「筛选文件夹」一致：背景模糊 + 居中卡片 + 搜索框 + 可滚动卡片列表；
   - 搜索关键字能实时过滤；点击卡片后模型触发按钮 label 更新；
   - 点「保存 AI 配置」→ 刷新页面，模型依然选中，且 `fetchedModels` 被保留；
   - 「设置更多模型」弹窗仍可从模型弹窗底部按钮进入，手动录入 custom models 会与 fetchedModels 合并展示。
