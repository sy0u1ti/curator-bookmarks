import {
  Button,
  CollapsiblePanel,
  CollapsibleRoot,
  CollapsibleTrigger,
  AiProviderCard,
  AiTaskStatus,
  Input,
  PopoverPopup,
  PopoverPortal,
  PopoverPositioner,
  PopoverRoot,
  SwitchControl
} from '../../ui'

const featureSwitches = [
  {
    id: 'ai-auto-analyze-bookmarks',
    label: '自动分析',
    statusId: 'ai-auto-analyze-status',
    status: '未开启',
    help: '添加网页书签后，自动分析内容并归类到合适文件夹。状态会在 popup 和扩展图标上轻量提示。'
  },
  {
    id: 'ai-allow-remote-parser',
    label: '开启 Jina Reader 远程解析 URL',
    statusId: 'ai-remote-parser-status',
    status: '未开启',
    help: '开启后，弹窗智能分类、书签智能分析和自动分析会同时使用本地抽取内容和 Jina Reader 解析内容。第三方服务会接收目标 URL，请谨慎用于隐私页面。'
  },
  {
    id: 'inbox-auto-move-to-recommended-folder',
    label: '自动移动到推荐文件夹',
    statusId: 'inbox-workflow-status',
    status: 'Inbox 开启',
    help: '快捷键收藏会先进入 Inbox / 待整理；AI 置信度足够时自动移动到推荐文件夹。'
  },
  {
    id: 'inbox-tag-only-no-auto-move',
    label: '只打标签，不自动移动',
    help: '开启后，快捷键收藏仍保存到 Inbox / 待整理，只生成标签和摘要，不移动文件夹。'
  }
]

const aiProviderSteps = [
  ['1', '填写密钥', '先填 API Key；Base URL 在高级选项'],
  ['2', '获取模型', '读取可用列表'],
  ['3', '选择模型', '用于命名与分类'],
  ['4', '测试连接', '确认模型可用'],
  ['5', '保存', '同步到 AI 功能']
]

const availabilityDecisionMetrics = [
  ['本次范围', 'availability-decision-scope', '全部书签'],
  ['扫描进度', 'availability-decision-progress', '0 / 0'],
  ['新增异常', 'availability-decision-new', '0'],
  ['持续异常', 'availability-decision-persistent', '0'],
  ['已恢复', 'availability-decision-recovered', '0'],
  ['忽略过滤', 'availability-decision-ignored', '0']
]

const availabilityFilters = [
  ['all', '全部', true],
  ['failed', '高置信', false],
  ['review', '低置信 / 待确认', false],
  ['redirected', '重定向', false],
  ['new', '新增', false],
  ['persistent', '持续', false],
  ['recovered', '已恢复', false],
  ['ignored', '已忽略过滤', false]
] as const

const availabilitySelectionActions = [
  ['availability-selection-retest', '重新测试', '重新测试可用性检测已选书签', 'secondary'],
  ['availability-selection-promote', '移入高置信异常', '将可用性检测已选书签移入高置信异常', 'secondary'],
  ['availability-selection-demote', '移入低置信异常', '将可用性检测已选书签移入低置信异常', 'secondary'],
  ['availability-selection-move', '批量移动到文件夹', '批量移动可用性检测已选书签到文件夹', 'secondary'],
  ['availability-selection-ignore-bookmark', '忽略所选书签', '忽略可用性检测所选书签', 'secondary'],
  ['availability-selection-ignore-domain', '忽略所选域名', '忽略可用性检测所选域名', 'secondary'],
  ['availability-selection-ignore-folder', '忽略所选文件夹', '忽略可用性检测所选文件夹', 'secondary'],
  ['availability-selection-delete', '批量删除所选', '批量删除可用性检测已选书签', 'danger']
] as const

const aiDecisionMetrics = [
  ['可处理', 'ai-eligible'],
  ['已建议', 'ai-suggested'],
  ['待确认', 'ai-manual-review'],
  ['无需改名', 'ai-unchanged'],
  ['高置信', 'ai-high-confidence'],
  ['中置信', 'ai-medium-confidence'],
  ['低置信', 'ai-low-confidence'],
  ['失败', 'ai-failed']
]

function HelpTooltip({ copy }: { copy: string }) {
  return (
    <span className="ai-help-tooltip" tabIndex={0} aria-label={copy} data-tooltip={copy}>
      ?
    </span>
  )
}

function AiSwitch({
  id,
  label
}: {
  id: string
  label?: string
}) {
  return (
    <span className="ai-switch">
      <SwitchControl
        id={id}
        aria-label={label}
        className="ai-switch-control"
        thumbClassName="ai-switch-thumb"
        syncInputState
        unstyled
      />
    </span>
  )
}

function ScopePickerButton({
  id,
  labelId,
  label,
  ariaLabel
}: {
  id: string
  labelId: string
  label: string
  ariaLabel: string
}) {
  return (
    <Button id={id} className="scope-picker-trigger" type="button" aria-label={ariaLabel}>
      <span id={labelId}>{label}</span>
      <span className="scope-picker-caret" aria-hidden="true" />
    </Button>
  )
}

export function GeneralPanel() {
  return (
    <section id="general" className="options-panel" data-section-panel="general" aria-labelledby="general-title" hidden>
      <p className="options-section-label">General</p>
      <h1 id="general-title">通用设置</h1>

      <AiProviderCard
        className="options-group ai-provider-card ai-feature-settings-card"
        title={<h2 className="ai-settings-subtitle">功能设置</h2>}
        headerClassName="ai-feature-settings-head"
        iconName="Sparkles"
        bodyClassName="ai-provider-layout"
      >
          {featureSwitches.map((item) => (
            <div className="ai-feature-switch-row" key={item.id}>
              <div className="ai-feature-switch-copy">
                <div className="ai-feature-title-row">
                  <strong>
                    {item.label} <HelpTooltip copy={item.help} />
                  </strong>
                  {item.statusId ? (
                    <span id={item.statusId} className="options-chip muted ai-inline-status">
                      {item.status}
                    </span>
                  ) : null}
                </div>
              </div>
              <AiSwitch id={item.id} label={item.label} />
            </div>
          ))}
      </AiProviderCard>

      <AiProviderCard
        className="options-group ai-naming-settings-card"
        title={
          <div>
            <strong>网页内容索引</strong>
            <p id="content-snapshot-status" className="ai-settings-subtitle">用于让本地搜索和 AI 分类记住网页摘要，不是备份网页。</p>
          </div>
        }
        status={<span className="options-chip muted">本地内容记忆</span>}
        headerClassName="ai-feature-settings-head"
        iconName="ArchiveRestore"
        bodyClassName="ai-provider-layout"
      >
        <label className="ai-feature-switch-row" htmlFor="content-snapshot-enabled">
          <span className="ai-feature-switch-copy">
            <strong>保存网页内容索引</strong>
            <span className="ai-feature-secondary">新增网页书签后保存标题、摘要和链接信息，让本地搜索/AI 分类更容易找到它。</span>
          </span>
          <AiSwitch id="content-snapshot-enabled" label="保存网页内容索引" />
        </label>
        <label className="ai-feature-switch-row" htmlFor="content-snapshot-full-text">
          <span className="ai-feature-switch-copy">
            <strong>增强：记住正文，搜索更准</strong>
            <span className="ai-feature-secondary">适合长文档和教程。开启后会保存可提取的正文，并把正文纳入本地搜索。</span>
          </span>
          <AiSwitch id="content-snapshot-full-text" label="增强：记住正文，搜索更准" />
        </label>
        <CollapsibleRoot className="ai-advanced-details content-snapshot-advanced">
          <CollapsibleTrigger className="ai-advanced-summary">高级说明</CollapsibleTrigger>
          <CollapsiblePanel className="ai-advanced-body">
            <p className="ai-advanced-note">
              默认只保存摘要、标题和链接信息。开启增强后，正文只保存在本机，较长正文会放到浏览器的大数据存储区以减少普通设置占用。
            </p>
          </CollapsiblePanel>
        </CollapsibleRoot>
      </AiProviderCard>

      <div className="options-group ai-provider-card">
        <div className="ai-provider-head">
          <div className="ai-provider-copy">
            <h2 className="ai-settings-subtitle">快捷键</h2>
            <p className="ai-provider-notice">为打开搜索、智能分类和切换自动分析设置快捷键。</p>
            <p className="ai-provider-subtitle">Chrome 只允许在扩展快捷键页修改绑定。</p>
          </div>
          <span id="shortcut-status" className="options-chip muted">读取中</span>
        </div>
        <p id="shortcut-status-detail" className="shortcut-status-detail hidden" />
        <div id="shortcut-list" className="shortcut-list">
          <div className="detect-empty">正在读取当前快捷键绑定…</div>
        </div>
        <div className="shortcut-actions">
          <Button id="open-shortcuts-settings" className="options-button small" size="sm" type="button" aria-label="打开 Chrome 扩展快捷键设置">打开快捷键设置</Button>
          <Button id="copy-shortcuts-url" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="复制 Chrome 扩展快捷键设置地址">复制设置地址</Button>
          <Button id="refresh-shortcuts" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="刷新扩展快捷键绑定状态">刷新状态</Button>
        </div>
      </div>

      <AiProviderCard
        id="ai-provider-settings"
        className="options-group ai-provider-card"
        title={<h2 className="ai-settings-subtitle">自定义 AI 渠道</h2>}
        description={
          <>
            <p id="ai-provider-notice-text" className="ai-provider-notice">填写 API Key 后，系统将获取可用模型并用于书签智能分析。</p>
            <p className="ai-provider-subtitle">API Key 仅保存在本地，不会上传到 Curator Bookmark 服务器。</p>
          </>
        }
        status={<span id="ai-config-status" className="options-chip muted">待配置</span>}
        headerClassName="ai-provider-head"
        copyClassName="ai-provider-copy"
        iconName="Bot"
        bodyClassName="ai-provider-layout"
      >
          <ol className="ai-provider-flow" aria-label="AI 渠道配置流程">
            {aiProviderSteps.map(([index, title, copy]) => (
              <li className="ai-flow-step" key={index}>
                <span className="ai-flow-index">{index}</span>
                <strong>{title}</strong>
                <p>{copy}</p>
              </li>
            ))}
          </ol>

          <label className="ai-provider-field" htmlFor="ai-api-key">
            <span>API Key</span>
            <Input id="ai-api-key" className="ai-provider-input" type="password" spellCheck={false} autoComplete="off" placeholder="未保存 API Key" unstyled />
          </label>

          <label className="ai-provider-check ai-provider-check-switch" htmlFor="ai-reveal-api-key">
            <span>显示密码</span>
            <AiSwitch id="ai-reveal-api-key" label="显示密码" />
          </label>

          <div className="ai-provider-field" role="group" aria-label="AI 模型">
            <span>模型</span>
            <div className="ai-model-field-controls">
              <div id="ai-model-selector-host" className="ai-model-selector-host" />
              <Button id="ai-fetch-models" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="从自定义 AI 渠道获取模型列表">获取模型</Button>
            </div>
          </div>

          <p id="ai-fetch-models-status" className="ai-provider-connectivity muted hidden" />
          <p id="ai-connectivity-copy" className="ai-provider-connectivity muted hidden" />

          <CollapsibleRoot id="ai-advanced-settings" className="ai-advanced-details">
            <CollapsibleTrigger className="ai-advanced-summary">Base URL 与接口选项</CollapsibleTrigger>
            <CollapsiblePanel className="ai-advanced-body">
              <div className="ai-settings-grid ai-settings-grid-advanced">
                <label className="ai-settings-field" htmlFor="ai-base-url">
                  <span>自定义 API 接口地址</span>
                  <Input id="ai-base-url" className="ai-provider-input" type="url" spellCheck={false} autoComplete="off" placeholder="https://api.openai.com/v1" unstyled />
                </label>

                <div className="ai-settings-field">
                  <span>接口类型</span>
                  <div id="ai-api-style-control" className="ai-provider-select-host" />
                </div>

                <label className="ai-settings-field hidden" htmlFor="ai-timeout-ms">
                  <span>请求超时 (ms)</span>
                  <Input id="ai-timeout-ms" className="ai-provider-input" type="number" min="5000" max="120000" step="1000" inputMode="numeric" placeholder="30000" unstyled />
                </label>

                <label className="ai-settings-field" htmlFor="ai-batch-size">
                  <span>每批最大请求数</span>
                  <Input id="ai-batch-size" className="ai-provider-input" type="number" min="1" max="20" step="1" inputMode="numeric" placeholder="6" unstyled />
                </label>
              </div>

              <p className="ai-provider-field-tip">
                支持搜索预设、自定义和已拉取的模型；若目标服务使用自定义模型 ID，可在{' '}
                <Button id="ai-manage-models" className="ai-inline-action" type="button" aria-label="打开自定义模型列表设置" unstyled>设置更多模型</Button>
                {' '}里追加。
              </p>
            </CollapsiblePanel>
          </CollapsibleRoot>

          <div className="ai-provider-actions">
            <span id="ai-save-status" className="ai-provider-save-state muted">待配置</span>
            <div className="ai-provider-action-buttons">
              <Button id="ai-test-connection" className="options-button" type="button" aria-label="测试自定义 AI 渠道连接">测试连接</Button>
              <Button id="ai-save-settings" className="options-button hidden" type="button" aria-label="保存自定义 AI 渠道设置">保存设置</Button>
            </div>
          </div>
      </AiProviderCard>
    </section>
  )
}

export function AvailabilityPanel() {
  return (
    <section id="availability" className="options-panel" data-section-panel="availability" aria-labelledby="availability-title">
      <p className="options-section-label">Availability</p>
      <h1 id="availability-title">书签可用性检测</h1>

      <div className="options-group">
        <div className="option-row">
          <div className="option-copy">
            <strong>检测范围</strong>
            <p id="availability-scope-copy">当前范围：全部书签。你可以切换到某个文件夹，只检测该文件夹及其子层级里的书签。</p>
          </div>
          <ScopePickerButton id="availability-scope-trigger" labelId="availability-scope-label" label="全部书签" ariaLabel="选择检测范围" />
        </div>
      </div>

      <div className="detect-toolbar">
        <div className="detect-permission-card">
          <div className="detect-permission-meta">
            <span id="availability-permission-badge" className="options-chip muted">多层校验</span>
            <strong>检测方式</strong>
          </div>
          <p id="availability-permission-copy">点击开始检测时会按当前范围的目标网站申请可选主机权限；授权后执行后台导航、失败重试和网络探测。检测过程中会短暂创建并自动关闭后台标签页。</p>
        </div>

        <div className="detect-toolbar-actions">
          <div className="availability-settings-anchor">
            <Button id="availability-settings-trigger" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-expanded="false" aria-controls="availability-settings-popover">
              检测设置
            </Button>
            <PopoverRoot open triggerId="availability-settings-trigger">
              <PopoverPortal keepMounted container={null}>
                <PopoverPositioner
                  className="availability-settings-positioner"
                  anchor={() => document.getElementById('availability-settings-trigger')}
                >
                  <PopoverPopup
                    id="availability-settings-popover"
                    className="availability-settings-popover hidden"
                    aria-labelledby="availability-settings-title"
                    initialFocus={false}
                    finalFocus={false}
                  >
                    <div className="availability-settings-head">
                      <strong id="availability-settings-title">检测设置</strong>
                      <span id="availability-settings-status" className="options-inline-status muted" />
                    </div>
                    <label className="availability-setting-field" htmlFor="availability-concurrency-input">
                      <span>并发数</span>
                      <Input id="availability-concurrency-input" className="availability-setting-input" type="number" inputMode="numeric" min="1" max="6" step="1" unstyled />
                    </label>
                    <label className="availability-setting-field" htmlFor="availability-timeout-input">
                      <span>超时时长（秒）</span>
                      <Input id="availability-timeout-input" className="availability-setting-input" type="number" inputMode="numeric" min="5" max="120" step="5" unstyled />
                    </label>
                    <p className="availability-settings-note">单域名仍会自动限流；遇到超时或 HTTP 429 会降速。</p>
                    <div className="availability-settings-actions">
                      <Button id="availability-settings-reset" className="options-button secondary small" size="sm" type="button" variant="secondary">恢复默认</Button>
                      <Button id="availability-settings-save" className="options-button small" size="sm" type="button">保存设置</Button>
                    </div>
                  </PopoverPopup>
                </PopoverPositioner>
              </PopoverPortal>
            </PopoverRoot>
          </div>
          <Button id="availability-action" className="options-button" type="button">开始检测全部书签</Button>
          <Button id="availability-pause-action" className="options-button secondary small hidden" size="sm" type="button" variant="secondary" disabled>暂停检测</Button>
          <Button id="availability-stop-action" className="options-button secondary small hidden" size="sm" type="button" variant="secondary" disabled>停止本次检测</Button>
        </div>
      </div>

      <div className="availability-decision-panel" aria-label="可用性检测决策概览">
        <div className="availability-decision-header">
          <div>
            <strong>决策面板</strong>
            <p className="detect-results-subtitle">异常项可直接忽略书签、域名或文件夹；确认失效后再移动或删除。</p>
          </div>
          <span id="availability-decision-duration" className="option-value">未开始</span>
        </div>
        <div className="decision-progress-row">
          <div className="decision-progress-meta">
            <span className="summary-label">检测进度</span>
            <strong id="availability-progress-text">未开始</strong>
          </div>
          <div className="decision-progress-body">
            <div className="detect-progress-track" aria-hidden="true">
              <span id="availability-progress-bar" className="detect-progress-bar" />
            </div>
            <p id="availability-status-copy" className="detect-status-copy">仅检测 `http/https` 书签，其它协议会自动跳过。</p>
          </div>
        </div>
        <div className="availability-decision-grid">
          {availabilityDecisionMetrics.map(([label, id, value]) => (
            <div key={id}>
              <span className="summary-label">{label}</span>
              <strong id={id}>{value}</strong>
            </div>
          ))}
        </div>
        <div id="availability-filter-bar" className="availability-filter-bar" role="toolbar" aria-label="筛选可用性检测结果">
          {availabilityFilters.map(([filter, label, pressed]) => (
            <Button
              className="options-button secondary small"
              size="sm"
              type="button"
              variant="secondary"
              data-availability-filter={filter}
              aria-pressed={pressed}
              key={filter}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div id="availability-selection-group" className="options-group detect-selection-group hidden">
        <div className="detect-results-header">
          <div>
            <strong id="availability-selection-count">0 条已选择</strong>
            <p className="detect-results-subtitle">可对当前低/高置信异常执行批量移动、忽略或删除。</p>
          </div>
          <Button id="availability-clear-selection" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空可用性检测已选书签">清空选择</Button>
        </div>
        <div className="detect-toolbar-actions wrap-start">
          {availabilitySelectionActions.map(([id, label, ariaLabel, variant]) => (
            <Button
              id={id}
              className={`options-button ${variant} small`}
              size="sm"
              type="button"
              variant={variant}
              aria-label={ariaLabel}
              key={id}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong id="availability-review-title">低置信异常</strong>
            <p id="availability-review-subtitle" className="detect-results-subtitle">导航失败但证据不足以直接判定为高置信异常，建议人工确认</p>
          </div>
          <div className="detect-results-actions">
            <Button id="availability-select-all-review" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="全选低置信异常书签">全选本区</Button>
            <span id="availability-review-count" className="option-value">0 条低置信异常</span>
          </div>
        </div>
        <div id="availability-review-results" className="detect-results">
          <div className="detect-empty">开始检测后，这里会展示低置信异常书签。</div>
        </div>
        <div id="availability-review-pagination" className="results-pagination hidden" aria-label="低置信异常分页" />
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong id="availability-failed-title">高置信异常</strong>
            <p id="availability-last-run" className="detect-results-subtitle">尚未执行检测</p>
          </div>
          <div className="detect-results-actions">
            <Button id="availability-select-all-failed" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="全选高置信异常书签">全选本区</Button>
            <Button id="delete-failed-bookmarks" className="options-button danger small" size="sm" type="button" variant="danger" aria-label="批量删除高置信异常书签" disabled>批量删除</Button>
            <span id="availability-error-count" className="option-value">0 条异常</span>
          </div>
        </div>
        <div id="availability-results" className="detect-results">
          <div className="detect-empty">开始检测后，这里会展示高置信失效的书签。</div>
        </div>
        <div id="availability-failed-pagination" className="results-pagination hidden" aria-label="高置信异常分页" />
      </div>
    </section>
  )
}

export function AiAnalysisPanel() {
  return (
    <section id="ai" className="options-panel" data-section-panel="ai" aria-labelledby="ai-title" hidden>
      <p className="options-section-label">Smart Bookmark Analysis</p>
      <h1 id="ai-title">书签智能分析</h1>

      <div className="options-group">
        <div className="option-row">
          <div className="option-copy">
            <strong>分析范围</strong>
            <p id="ai-scope-copy">当前范围：全部书签。你可以切换到某个文件夹，只处理该文件夹及其子层级里的 `http/https` 书签。</p>
          </div>
          <ScopePickerButton id="ai-scope-trigger" labelId="ai-scope-label" label="全部书签" ariaLabel="选择书签智能分析范围" />
        </div>
      </div>

      <div className="detect-toolbar">
        <div className="detect-permission-card">
          <div className="detect-permission-meta">
            <span id="ai-run-badge" className="options-chip muted">书签智能分析</span>
            <strong>执行方式</strong>
          </div>
          <p id="ai-status-copy">保存通用 AI 渠道后，系统会先读取网页内容，再分批生成书签智能分析建议并同步网页内容索引。建议生成后，你可以先预览并手动选择要应用的标题。</p>
        </div>

        <div className="detect-toolbar-actions">
          <a id="ai-config-link" className="options-button secondary small ai-config-link" href="#general:ai-provider" data-section-link="general">配置 API Key</a>
          <Button id="ai-action" className="options-button" type="button">开始分析并生成建议</Button>
          <Button id="ai-pause-action" className="options-button secondary small hidden" size="sm" type="button" variant="secondary" disabled>暂停生成</Button>
          <Button id="ai-stop-action" className="options-button secondary small hidden" size="sm" type="button" variant="secondary" disabled>停止本次生成</Button>
        </div>
      </div>

      <AiTaskStatus
        status="idle"
        className="availability-decision-panel ai-decision-panel"
        label="执行进度"
        title={<strong id="ai-progress-text">未开始</strong>}
        titleId="ai-progress-text"
        description={<p id="ai-progress-copy" className="detect-status-copy">先读取书签指向的网页内容，再把结果分批发送给 AI 模型生成书签智能分析建议。</p>}
        progress={0}
        progressId="ai-progress-bar"
        progressClassName="detect-progress-track"
        statusNode={<span id="ai-decision-status" className="option-value">未开始</span>}
        aria-label="书签智能分析决策概览"
      >
        <div className="availability-decision-header">
          <div>
            <strong>决策面板</strong>
            <p className="detect-results-subtitle">先查看可直接应用的建议，再处理待确认、低置信和失败项。</p>
          </div>
        </div>
        <div className="availability-decision-grid ai-decision-grid">
          {aiDecisionMetrics.map(([label, id]) => (
            <div key={id}>
              <span className="summary-label">{label}</span>
              <strong id={id}>0</strong>
            </div>
          ))}
        </div>
      </AiTaskStatus>

      <div id="ai-selection-group" className="options-group detect-selection-group hidden">
        <div className="detect-results-header">
          <div>
            <strong id="ai-selection-count">0 条已选择</strong>
            <p className="detect-results-subtitle">只会应用状态为“建议改名”的条目；“待确认”与“失败”结果需要先人工判断。</p>
          </div>
          <div className="detect-results-actions">
            <Button id="ai-select-all" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="全选书签智能分析结果">全选</Button>
            <Button id="ai-select-high-confidence" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="全选书签智能分析高置信结果">全选高置信</Button>
            <Button id="ai-clear-selection" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空书签智能分析已选建议">清空选择</Button>
            <Button id="ai-move-selection-to-suggested" className="options-button secondary small double-confirm-action" size="sm" type="button" variant="secondary" aria-label="将书签智能分析已选建议移动至推荐文件夹">移动至推荐文件夹</Button>
            <Button id="ai-apply-selection" className="options-button small" size="sm" type="button" aria-label="应用书签智能分析已选建议">应用所选建议</Button>
          </div>
        </div>
      </div>

      <div className="options-group detect-results-group">
        <div className="detect-results-header">
          <div>
            <strong>书签智能分析</strong>
            <p id="ai-results-subtitle" className="detect-results-subtitle">在通用设置中配置 AI 渠道后，开始分析并生成建议，这里会展示当前标题、建议标题、标签、置信度与原因。</p>
          </div>
          <span id="ai-result-count" className="option-value">0 条结果</span>
        </div>
        <div className="detect-results-header ai-results-filter-row">
          <div className="detect-results-actions wrap-start">
            <Input id="ai-filter-query" className="options-search-input compact" type="search" spellCheck={false} placeholder="筛选文件夹或域名" aria-label="筛选书签智能分析结果" unstyled />
            <div id="ai-results-filter-controls" className="ai-results-filter-controls" />
            <Button id="ai-clear-filters" className="options-button secondary small" size="sm" type="button" variant="secondary" aria-label="清空书签智能分析筛选条件">清空筛选</Button>
          </div>
        </div>
        <div id="ai-results" className="detect-results">
          <div className="detect-empty">保存 AI 渠道并开始分析后，这里会展示书签智能分析结果。</div>
        </div>
        <div id="ai-results-pagination" className="results-pagination hidden" aria-label="AI 标签与命名结果分页" />
      </div>
    </section>
  )
}
