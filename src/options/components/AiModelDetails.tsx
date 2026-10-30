import { useRef, useState } from 'react'
import { Button } from '../../ui/base/Button'
import { Popover } from '../../ui/base/Popover'
import { SwitchControl } from '../../ui/base/Switch'
import { StatusButton } from '../../ui/actions/StatusButton'
import { actionFeedback, IDLE_ACTION_FEEDBACK } from '../../shared/action-feedback.js'
import { MODELS_DEV_ERROR_LABELS } from '../../shared/models-dev-cache.js'
import { requestModelsDevUpdate } from '../../shared/models-dev-client.js'
import { REASONING_EFFORT_LABELS, type ReasoningEffortId } from '../../shared/ai-reasoning.js'
import type { ModelsDevModel } from '../../shared/models-dev.js'
import type { AiProviderSettingsState } from './ai-provider-settings-types.js'

const SYNC_LABELS = { idle: '更新资料', pending: '更新中', success: '已更新', error: '更新失败' }
const MODALITY_LABELS: Record<string, string> = { text: '文本', image: '图片', audio: '音频', video: '视频', pdf: 'PDF' }
const integer = new Intl.NumberFormat('zh-CN')
const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 })

export function AiModelDetails({ state }: { state: AiProviderSettingsState }) {
  const [feedback, setFeedback] = useState(IDLE_ACTION_FEEDBACK)
  const [configuring, setConfiguring] = useState(false)
  const [localError, setLocalError] = useState('')
  const busy = useRef(false)
  const catalog = state.modelCatalog
  const model = catalog.match?.model
  const rows: Array<[string, string]> = []
  if (model) {
    rows.push(['匹配范围', catalog.match?.kind === 'provider' ? catalog.match.providerName ?? '当前渠道' : '仅模型，渠道未匹配'])
    if (model.context !== undefined) rows.push(['上下文', `${integer.format(model.context)} tokens`])
    if (model.output !== undefined) rows.push(['最大输出', `${integer.format(model.output)} tokens`])
    if (model.inputModalities?.length) rows.push(['输入', model.inputModalities.map((mode) => MODALITY_LABELS[mode] ?? mode).join(' / ')])
    if (model.outputModalities?.length) rows.push(['输出', model.outputModalities.map((mode) => MODALITY_LABELS[mode] ?? mode).join(' / ')])
    if (model.reasoning !== undefined || model.reasoningOptions) rows.push(['推理', reasoningLabel(model)])
    if (model.toolCall !== undefined) rows.push(['工具调用', model.toolCall ? '支持' : '不支持'])
    if (model.structuredOutput !== undefined) rows.push(['结构化输出', model.structuredOutput ? '支持' : '不支持'])
    if (model.releaseDate) rows.push(['发布', model.releaseDate])
    if (model.updatedDate) rows.push(['资料更新', model.updatedDate])
    if (model.knowledge) rows.push(['知识截止', model.knowledge])
  }
  const costs: Array<[string, string]> = []
  if (catalog.match?.kind === 'provider' && model?.cost) {
    for (const [key, label] of [['input', '输入'], ['output', '输出'], ['cacheRead', '缓存读取'], ['cacheWrite', '缓存写入']] as const) {
      const value = model.cost[key]
      if (value !== undefined) costs.push([label, price.format(value)])
    }
  }
  const error = localError || (catalog.lastError ? MODELS_DEV_ERROR_LABELS[catalog.lastError] : '')
  const refresh = async () => {
    if (busy.current) return
    busy.current = true
    setLocalError('')
    setFeedback(actionFeedback('pending'))
    const result = await requestModelsDevUpdate({ type: 'models-dev:refresh' })
    setFeedback(actionFeedback(result.ok ? 'success' : 'error'))
    if (result.ok === false) setLocalError(MODELS_DEV_ERROR_LABELS[result.error])
    busy.current = false
  }
  const configure = async (autoUpdate: boolean) => {
    if (busy.current) return
    busy.current = true
    setLocalError('')
    setConfiguring(true)
    const result = await requestModelsDevUpdate({ type: 'models-dev:configure', autoUpdate })
    if (result.ok === false) setLocalError(MODELS_DEV_ERROR_LABELS[result.error])
    setConfiguring(false)
    busy.current = false
  }

  return (
    <Popover
      id="ai-model-details"
      align="start"
      showArrow={false}
      sticky
      collisionPadding={12}
      keepMounted={false}
      title="模型资料"
      popupClassName="w-80 max-w-[calc(100vw-24px)]! max-h-[var(--available-height)] grid-rows-[auto_minmax(0,1fr)_auto] gap-3! overflow-y-auto overscroll-contain p-4!"
      triggerNativeButton
      trigger={<Button size="sm" variant="ghost" aria-label="查看模型资料">模型资料</Button>}
    >
      <div className="min-h-0 max-h-[min(480px,55vh)] overflow-y-auto overscroll-contain pr-1">
        {model ? (
          <>
            <p className="m-0 mb-3 break-words font-medium text-ds-text-primary">{model.name}</p>
            <DetailsRows rows={rows} />
            {costs.length ? (
              <div className="mt-4">
                <p className="m-0 mb-2 text-xs text-ds-text-secondary">渠道参考价 · 美元 / 百万 tokens</p>
                <DetailsRows rows={costs} />
              </div>
            ) : null}
          </>
        ) : (
          <p className="m-0 text-[13px] leading-relaxed text-ds-text-secondary">
            {!catalog.loaded ? '正在读取本地资料…' : catalog.checkedAt ? '未找到可可靠匹配的模型资料。' : '从 models.dev 获取模型资料。'}
          </p>
        )}
        {state.reasoningEffortNote ? <p className="m-0 mt-3 text-xs leading-relaxed text-ds-text-secondary">{state.reasoningEffortNote}</p> : null}
      </div>
      <div className="grid gap-3 border-t border-ds-border-subtle pt-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="models-dev-auto-update" className="text-[13px]">每日自动更新</label>
          <SwitchControl
            id="models-dev-auto-update"
            aria-label="每日从 models.dev 自动更新"
            checked={catalog.autoUpdate}
            disabled={configuring || feedback.status === 'pending'}
            onCheckedChange={(checked) => { void configure(checked) }}
          />
        </div>
        <p className="m-0 text-xs leading-relaxed text-ds-text-secondary">仅下载公开资料，不发送密钥、书签或渠道配置。</p>
        {error ? <p role="alert" className="m-0 text-xs leading-relaxed text-ds-danger-text">{error}</p> : null}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-xs leading-relaxed text-ds-text-secondary">
            <a href="https://models.dev" target="_blank" rel="noopener noreferrer" className="rounded-sm underline underline-offset-2 focus-visible:outline-ds-focus">models.dev</a>
            <p className="m-0" title={catalog.checkedAt ? new Date(catalog.checkedAt).toLocaleString('zh-CN') : undefined}>
              {catalog.checkedAt ? `检查于 ${new Date(catalog.checkedAt).toLocaleDateString('zh-CN')}` : '尚未同步'}
            </p>
          </div>
          <StatusButton
            size="sm"
            variant="secondary"
            icon="RefreshCw"
            labels={SYNC_LABELS}
            feedback={feedback}
            disabled={configuring}
            aria-label="从 models.dev 更新模型资料"
            onClick={() => { void refresh() }}
          />
        </div>
      </div>
    </Popover>
  )
}

function DetailsRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px] leading-relaxed">
      {rows.map(([label, value]) => (
        <div className="contents" key={label}>
          <dt className="text-ds-text-secondary">{label}</dt>
          <dd className="m-0 break-words text-right tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function reasoningLabel(model: ModelsDevModel): string {
  if (model.reasoning === false) return '不支持'
  if (!model.reasoningOptions) return model.reasoning ? '支持' : '未记录'
  if (!model.reasoningOptions.length) return '固定推理'
  return model.reasoningOptions.map((option) => {
    if (option.type === 'toggle') return '可开关'
    if (option.type === 'effort') return option.values.map((level) => Object.hasOwn(REASONING_EFFORT_LABELS, level) ? REASONING_EFFORT_LABELS[level as ReasoningEffortId] : level).join(' / ')
    return option.min !== undefined && option.max !== undefined
      ? `${integer.format(option.min)}–${integer.format(option.max)} tokens 预算` : '思考预算'
  }).join(' · ')
}
