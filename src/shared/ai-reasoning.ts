/**
 * 推理强度能力解析。
 *
 * 渠道 `/models` 返回能力元数据时以元数据为准；没有元数据时，再按模型 ID
 * 使用保守的能力规则。这样既能适配 OpenRouter / Anthropic 等会公开能力的渠道，
 * 也能兼容只返回模型 ID 的 OpenAI-compatible 服务。
 */

export type ReasoningEffortId =
  | 'default'
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'

export type ReasoningCapabilitySource = 'metadata' | 'model_rule' | 'fallback'

export const REASONING_EFFORT_LABELS: Record<ReasoningEffortId, string> = {
  default: '默认',
  none: '关闭',
  minimal: '极简',
  low: '轻度',
  medium: '中',
  high: '高',
  xhigh: '极高',
  max: '最高'
}

export const REASONING_EFFORT_HINTS: Record<ReasoningEffortId, string> = {
  default: '不发送推理参数，由渠道或模型决定',
  none: '关闭额外推理，延迟最低',
  minimal: '几乎不额外推理，最快最省',
  low: '少量推理，速度优先',
  medium: '推理与速度平衡',
  high: '充分推理，质量优先',
  xhigh: '更深度推理，质量更优但耗时更长',
  max: '最深度推理，质量与耗时均为最高'
}

const STRENGTH_ORDER: ReasoningEffortId[] = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
]
const CAPABILITY_LEVEL_ORDER: ReasoningEffortId[] = ['none', ...STRENGTH_ORDER]
const KNOWN_EFFORTS = new Set<ReasoningEffortId>([
  'default',
  'none',
  ...STRENGTH_ORDER
])

/** 可持久化的单模型能力，由模型列表接口的元数据提取。 */
export interface ModelReasoningCapability {
  /** 渠道显式声明的实际档位；不包含 default，支持关闭时可包含 none。 */
  levels: ReasoningEffortId[]
  /** 渠道在未显式指定时使用的档位。 */
  defaultEffort?: ReasoningEffortId
  /** true 表示该模型始终启用推理。 */
  mandatory?: boolean
}

export type ModelReasoningCapabilityMap = Record<string, ModelReasoningCapability>

export interface ModelReasoningProfile extends ModelReasoningCapability {
  /** 是否存在至少两个档位可供调节。 */
  supported: boolean
  /** 能力结论来自渠道元数据、模型规则还是兼容兜底。 */
  source: ReasoningCapabilitySource
  /** 面向用户的一句说明。 */
  note: string
  /** 厂商使用“开关/预算”等语义时，覆盖通用的档位文案。 */
  optionLabels?: Partial<Record<ReasoningEffortId, string>>
  optionHints?: Partial<Record<ReasoningEffortId, string>>
  /** 厂商声明的兼容别名；用于把旧存储值收敛到真正生效的档位。 */
  aliases?: Partial<Record<ReasoningEffortId, ReasoningEffortId>>
}

interface ReasoningRule {
  test: RegExp
  levels: ReasoningEffortId[]
  defaultEffort?: ReasoningEffortId
  mandatory?: boolean
  note: string
  optionLabels?: Partial<Record<ReasoningEffortId, string>>
  optionHints?: Partial<Record<ReasoningEffortId, string>>
  aliases?: Partial<Record<ReasoningEffortId, ReasoningEffortId>>
}

export interface ReasoningProviderContext {
  baseUrl?: unknown
  apiStyle?: unknown
}

export type ReasoningTransportKind =
  | 'flat_effort'
  | 'nested_effort'
  | 'anthropic_effort'
  | 'effort_with_thinking'
  | 'effort_with_enable_thinking'
  | 'effort_inside_thinking'
  | 'thinking_toggle'
  | 'minimax_adaptive'
  | 'enable_thinking'
  | 'fixed_with_budget'
  | 'fixed'
  | 'unsupported'

/** runtime 写请求体时使用；与设置页的 provider profile 来自同一套路由。 */
export interface ReasoningTransport {
  kind: ReasoningTransportKind
  effortField?: 'flat' | 'nested'
  budgetByEffort?: Partial<Record<ReasoningEffortId, number>>
}

interface ProviderReasoningMatch {
  profile?: ModelReasoningProfile
  transport: ReasoningTransport
  /** 未知的新型号可由 /models 的显式能力元数据接管。 */
  allowMetadataOverride?: boolean
}

const NONE: ReasoningEffortId[] = []
const MINIMAL_TO_HIGH: ReasoningEffortId[] = ['minimal', 'low', 'medium', 'high']
const LOW_TO_HIGH: ReasoningEffortId[] = ['low', 'medium', 'high']
const LOW_TO_XHIGH: ReasoningEffortId[] = ['low', 'medium', 'high', 'xhigh']
const LOW_TO_MAX: ReasoningEffortId[] = ['low', 'medium', 'high', 'xhigh', 'max']
const LOW_MEDIUM_HIGH_MAX: ReasoningEffortId[] = ['low', 'medium', 'high', 'max']
const HIGH_ONLY: ReasoningEffortId[] = ['high']
const LOW_HIGH: ReasoningEffortId[] = ['low', 'high']
const OFF_ON_LABELS: Partial<Record<ReasoningEffortId, string>> = {
  none: '关闭',
  high: '开启'
}
const OFF_ON_HINTS: Partial<Record<ReasoningEffortId, string>> = {
  none: '明确关闭厂商的思考模式',
  high: '明确开启厂商的思考模式；该模型不提供更细强度'
}
const FIXED_LABELS: Partial<Record<ReasoningEffortId, string>> = {
  high: '固定思考'
}
const REAL_HIGH_MAX_ALIASES: Partial<Record<ReasoningEffortId, ReasoningEffortId>> = {
  minimal: 'high',
  low: 'high',
  medium: 'high',
  xhigh: 'max'
}
const OFF_HIGH_MAX_ALIASES: Partial<Record<ReasoningEffortId, ReasoningEffortId>> = {
  minimal: 'none',
  low: 'high',
  medium: 'high',
  xhigh: 'max'
}

// 顺序敏感：具体型号必须排在系列规则之前。
const REASONING_RULES: ReasoningRule[] = [
  // 明确非推理 / 非文本模型。
  { test: /embedding|embed\b|whisper|dall-?e|tts|moderation|rerank|speech|voice/, levels: NONE, note: '非推理模型，无需强度设置' },
  { test: /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4(?![.\d])|gpt-3\.?5/, levels: NONE, note: 'GPT-4/3.5 系模型不支持推理强度' },
  { test: /moonshot-v1/, levels: NONE, note: '该模型不支持推理强度' },

  // OpenAI。none 是关闭推理，不计入“推理强度”滑块。
  { test: /gpt-5(?:\.0)?-pro|o[0-9]+-pro/, levels: HIGH_ONLY, defaultEffort: 'high', mandatory: true, note: '该 Pro 模型固定为高强度' },
  { test: /gpt-5\.5-pro/, levels: ['medium', 'high', 'xhigh'], defaultEffort: 'high', mandatory: true, note: 'GPT-5.5 Pro 支持中、高、极高 3 档；默认高' },
  { test: /gpt-5\.4-pro/, levels: ['medium', 'high', 'xhigh'], defaultEffort: 'medium', mandatory: true, note: 'GPT-5.4 Pro 支持中、高、极高 3 档；默认中' },
  { test: /gpt-5\.2-pro/, levels: ['default', 'medium', 'high', 'xhigh'], mandatory: true, note: 'GPT-5.2 Pro 支持中、高、极高；官方未声明默认档，默认时保持省略' },
  { test: /gpt-5\.3-pro/, levels: ['default', 'medium', 'high', 'xhigh'], mandatory: true, note: 'GPT-5.3 Pro 缺少可核验的精确默认档，默认时保持省略' },
  { test: /gpt-5\.6(?:[-._/]|$)/, levels: ['none', ...LOW_TO_MAX], defaultEffort: 'medium', note: 'GPT-5.6 支持关闭、轻度到最高共 6 档' },
  { test: /gpt-5\.2-codex(?:[-._/]|$)/, levels: ['default', ...LOW_TO_XHIGH], note: 'GPT-5.2 Codex 支持轻度到极高；官方未声明默认档，默认时保持省略' },
  { test: /gpt-5\.(?:2|4)(?:[-._/]|$)/, levels: ['none', ...LOW_TO_XHIGH], defaultEffort: 'none', note: '该 GPT-5 系模型支持关闭、轻度到极高；默认关闭额外推理' },
  { test: /gpt-5\.5(?:[-._/]|$)/, levels: ['none', ...LOW_TO_XHIGH], defaultEffort: 'medium', note: 'GPT-5.5 支持关闭、轻度到极高；默认中' },
  { test: /gpt-5\.3(?:[-._/]|$)/, levels: ['default', 'none', ...LOW_TO_XHIGH], note: 'GPT-5.3 缺少可核验的精确模型页，默认时保持省略而不猜测强度' },
  { test: /gpt-5\.1(?:[-._/]|$)/, levels: ['none', 'low', 'medium', 'high'], defaultEffort: 'none', note: 'GPT-5.1 支持关闭、轻度、中、高 4 档；默认关闭额外推理' },
  { test: /gpt-5(?:[-._/]|$)/, levels: MINIMAL_TO_HIGH, defaultEffort: 'medium', note: 'GPT-5 支持极简、轻度、中、高 4 档' },
  { test: /(?:^|\/)o[1-9](?:[.\-]|$)|(?:^|\/)o[1-9]-(?:mini|preview)/, levels: LOW_TO_HIGH, defaultEffort: 'medium', note: 'OpenAI o 系推理模型支持轻度、中、高 3 档' },

  // Anthropic Claude 原生 Models API 会返回精确 capability；以下规则供兼容渠道兜底。
  { test: /claude-(?:fable-5|mythos-5|opus-4[-.]?(?:7|8)|sonnet-5)|(?:fable|mythos)[-_. ]?5/, levels: LOW_TO_MAX, defaultEffort: 'high', note: '该 Claude 模型支持轻度到最高共 5 档' },
  { test: /claude-mythos-preview|mythos[-_. ]preview/, levels: LOW_MEDIUM_HIGH_MAX, defaultEffort: 'high', note: 'Claude Mythos Preview 支持轻度、中、高、最高 4 档' },
  { test: /claude-(?:opus-4[-.]?6|sonnet-4[-.]?6)/, levels: LOW_MEDIUM_HIGH_MAX, defaultEffort: 'high', note: '该 Claude 模型支持轻度、中、高、最高 4 档' },
  { test: /claude-opus-4[-.]?5/, levels: LOW_TO_HIGH, defaultEffort: 'high', note: 'Claude Opus 4.5 支持轻度、中、高 3 档' },
  { test: /claude-(?:sonnet|haiku)-4[-.]?5|claude-(?:opus|sonnet|haiku)-(?:3|4[-.]?[01])/, levels: NONE, note: '该 Claude 型号不支持 effort 推理强度' },
  { test: /claude|anthropic/, levels: LOW_TO_HIGH, defaultEffort: 'high', note: 'Claude 能力元数据不可用，按兼容档位显示轻度、中、高' },

  // Google Gemini OpenAI 兼容层的 reasoning_effort 映射。
  { test: /gemini-3\.1-pro/, levels: LOW_TO_HIGH, defaultEffort: 'high', note: 'Gemini 3.1 Pro 支持轻度、中、高 3 档' },
  { test: /gemini-3\.1-flash-lite-image/, levels: ['minimal', 'high'], defaultEffort: 'minimal', note: '该 Gemini 模型支持极简、高 2 档' },
  { test: /gemini-3\.1-flash-lite(?:[-._/]|$)/, levels: MINIMAL_TO_HIGH, defaultEffort: 'minimal', note: 'Gemini 3.1 Flash-Lite 支持极简、轻度、中、高 4 档' },
  { test: /gemini-3\.[56]-flash-lite/, levels: MINIMAL_TO_HIGH, defaultEffort: 'minimal', note: '该 Gemini Flash-Lite 模型支持极简到高共 4 档' },
  { test: /gemini-3\.[56]-flash/, levels: MINIMAL_TO_HIGH, defaultEffort: 'medium', note: '该 Gemini Flash 模型支持极简到高共 4 档' },
  { test: /gemini-3-flash/, levels: MINIMAL_TO_HIGH, defaultEffort: 'high', note: 'Gemini 3 Flash 支持极简到高共 4 档' },
  { test: /gemini-3-pro/, levels: LOW_HIGH, defaultEffort: 'high', note: 'Gemini 3 Pro 支持轻度、高 2 档' },
  { test: /gemini-2\.5-flash-lite/, levels: ['none', 'low', 'medium', 'high'], defaultEffort: 'none', note: 'Gemini 2.5 Flash-Lite 支持关闭、轻度、中、高；默认关闭' },
  { test: /gemini-2\.5-pro/, levels: ['default', 'low', 'medium', 'high'], note: 'Gemini 2.5 Pro 支持轻度、中、高；默认是动态思考' },
  { test: /gemini-2\.5-flash/, levels: ['default', 'none', 'low', 'medium', 'high'], note: 'Gemini 2.5 Flash 支持关闭、轻度、中、高；默认是动态思考' },
  { test: /gemini/, levels: NONE, note: '该 Gemini 版本不支持推理强度' },

  // 其他兼容模型。
  { test: /deepseek-(?:v4|reasoner|r1)/, levels: ['high', 'max'], defaultEffort: 'high', aliases: REAL_HIGH_MAX_ALIASES, note: 'DeepSeek V4 的真实强度只有高、最高 2 档' },
  { test: /deepseek/, levels: NONE, note: '该 DeepSeek 对话模型不支持推理强度' },
  { test: /grok.*non[-_.]?reasoning/, levels: NONE, note: '该 Grok 型号明确为 non-reasoning，不支持推理强度' },
  { test: /grok-4[._-]20.*reasoning/, levels: HIGH_ONLY, defaultEffort: 'high', mandatory: true, optionLabels: FIXED_LABELS, note: '该 Grok 4.20 reasoning 型号固定推理，厂家不提供可调强度' },
  { test: /grok-4\.5/, levels: LOW_TO_HIGH, defaultEffort: 'high', note: 'Grok 4.5 支持轻度、中、高 3 档' },
  { test: /grok-4\.3/, levels: ['default', 'none', 'low', 'medium', 'high'], note: 'Grok 4.3 支持关闭、轻度、中、高；厂商未公开默认档' },
  { test: /grok-4\.[0-9]|grok-4-(?:latest|fast)/, levels: LOW_TO_HIGH, defaultEffort: 'high', note: '该 Grok 推理模型支持轻度、中、高 3 档' },
  { test: /grok-3-mini/, levels: LOW_HIGH, defaultEffort: 'low', note: 'Grok 3 mini 仅支持轻度、高 2 档' },
  { test: /grok/, levels: NONE, note: '该 Grok 模型不支持推理强度' },
  { test: /glm-5\.2/, levels: ['none', 'high', 'max'], defaultEffort: 'max', aliases: OFF_HIGH_MAX_ALIASES, note: 'GLM-5.2 的真实档位为关闭、高、最高；默认最高' },
  { test: /glm/, levels: NONE, note: '该 GLM 版本使用思考开关而非强度' },
  { test: /qwen3[._-]?8-max-preview/, levels: ['low', 'medium', 'xhigh'], defaultEffort: 'xhigh', aliases: { minimal: 'low', high: 'xhigh', max: 'xhigh' }, note: 'Qwen 3.8 Max Preview 支持轻度、中、极高 3 档' },
  { test: /kimi-k3/, levels: ['low', 'high', 'max'], defaultEffort: 'max', mandatory: true, note: 'Kimi K3 支持轻度、高、最高 3 档，且不可关闭思考' },
  { test: /mistral-(?:small-(?:latest|2603)|medium-3-5)/, levels: ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'], note: '该 Mistral 模型支持关闭到极高；厂商未公开默认档' }
]

const FALLBACK_PROFILE: ModelReasoningProfile = {
  supported: true,
  levels: ['default', 'low', 'medium', 'high'],
  source: 'fallback',
  note: '渠道未公开该模型的档位，按兼容协议提供默认、轻度、中、高；若渠道拒绝会明确报错，不会偷偷退回默认'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

type KnownReasoningProvider =
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'deepseek'
  | 'dashscope'
  | 'zhipu'
  | 'minimax'
  | 'ark'
  | 'moonshot'
  | 'qianfan'
  | 'tencent_tokenhub'
  | 'tencent_hunyuan'
  | 'stepfun'
  | 'siliconflow'
  | 'vanchin'
  | 'gemini'
  | 'xai'
  | 'mistral'
  | 'generic'

function getProviderHostname(baseUrl: unknown): string {
  const value = String(baseUrl ?? '').trim()
  if (!value) {
    return ''
  }
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .split(/[/:?#]/, 1)[0]
      .toLowerCase()
  }
}

function isHostname(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function isTokenHubInternationalHost(baseUrl: unknown): boolean {
  const hostname = getProviderHostname(baseUrl)
  return (
    hostname === 'tokenhub-intl.tencentmaas.com' ||
    hostname === 'tokenhub-intl.tencentmaas.cn' ||
    hostname === 'tokenhub-intl.tencentcloudmaas.com' ||
    hostname === 'tokenhub-intl.tencentcloudmaas.cn'
  )
}

function getKnownReasoningProvider(baseUrl: unknown): KnownReasoningProvider {
  const hostname = getProviderHostname(baseUrl)
  if (isHostname(hostname, 'api.openai.com')) return 'openai'
  if (isHostname(hostname, 'api.anthropic.com')) return 'anthropic'
  if (isHostname(hostname, 'openrouter.ai')) return 'openrouter'
  if (isHostname(hostname, 'api.deepseek.com')) return 'deepseek'
  if (
    hostname.includes('dashscope') ||
    hostname.endsWith('.maas.aliyuncs.com')
  ) return 'dashscope'
  if (isHostname(hostname, 'open.bigmodel.cn') || isHostname(hostname, 'api.z.ai')) return 'zhipu'
  if (
    isHostname(hostname, 'api.minimaxi.com') ||
    isHostname(hostname, 'api.minimax.io') ||
    isHostname(hostname, 'api.minimax.chat')
  ) return 'minimax'
  if (isHostname(hostname, 'ark.cn-beijing.volces.com')) return 'ark'
  if (isHostname(hostname, 'api.moonshot.cn') || isHostname(hostname, 'api.moonshot.ai')) return 'moonshot'
  if (
    isHostname(hostname, 'qianfan.baidubce.com') ||
    isHostname(hostname, 'qianfan.bj.baidubce.com') ||
    isHostname(hostname, 'api.baiduqianfan.ai')
  ) return 'qianfan'
  if (
    isHostname(hostname, 'tokenhub.tencentmaas.com') ||
    isHostname(hostname, 'tokenhub.tencentmaas.cn') ||
    isHostname(hostname, 'tokenhub-intl.tencentmaas.com') ||
    isHostname(hostname, 'tokenhub-intl.tencentmaas.cn') ||
    isHostname(hostname, 'tokenhub-intl.tencentcloudmaas.com') ||
    isHostname(hostname, 'tokenhub-intl.tencentcloudmaas.cn') ||
    isHostname(hostname, 'api.lkeap.cloud.tencent.com')
  ) return 'tencent_tokenhub'
  if (isHostname(hostname, 'api.hunyuan.cloud.tencent.com')) return 'tencent_hunyuan'
  if (
    isHostname(hostname, 'api.stepfun.com') ||
    isHostname(hostname, 'api.stepfun.ai')
  ) return 'stepfun'
  if (
    isHostname(hostname, 'api.siliconflow.cn') ||
    isHostname(hostname, 'api.siliconflow.com')
  ) return 'siliconflow'
  if (isHostname(hostname, 'wanqing.streamlakeapi.com')) return 'vanchin'
  if (isHostname(hostname, 'generativelanguage.googleapis.com')) return 'gemini'
  if (isHostname(hostname, 'api.x.ai')) return 'xai'
  if (isHostname(hostname, 'api.mistral.ai')) return 'mistral'
  return 'generic'
}

function createProviderProfile({
  levels,
  defaultEffort,
  mandatory,
  note,
  optionLabels,
  optionHints,
  aliases
}: Omit<ModelReasoningProfile, 'supported' | 'source'>): ModelReasoningProfile {
  return {
    levels: levels.slice(),
    defaultEffort,
    mandatory,
    supported: levels.length > 1,
    source: 'model_rule',
    note,
    optionLabels,
    optionHints,
    aliases
  }
}

function makeProviderMatch(
  transport: ReasoningTransport,
  profile?: Omit<ModelReasoningProfile, 'supported' | 'source'>,
  allowMetadataOverride = false
): ProviderReasoningMatch {
  return {
    transport,
    profile: profile ? createProviderProfile(profile) : undefined,
    allowMetadataOverride
  }
}

function getEffortTransport(apiStyle: unknown): ReasoningTransport {
  return String(apiStyle) === 'responses'
    ? { kind: 'nested_effort' }
    : { kind: 'flat_effort' }
}

function getEffortWithThinkingTransport(apiStyle: unknown): ReasoningTransport {
  return {
    kind: 'effort_with_thinking',
    effortField: String(apiStyle) === 'responses' ? 'nested' : 'flat'
  }
}

function supportsDashscopeExtendedEffort(baseUrl: unknown): boolean {
  const hostname = getProviderHostname(baseUrl)
  return (
    hostname === 'dashscope.aliyuncs.com' ||
    hostname === 'dashscope-intl.aliyuncs.com' ||
    hostname.includes('cn-beijing') ||
    hostname.includes('ap-southeast-1')
  )
}

function getQwenBudgetMaximum(model: string): number | null {
  // Qwen 3.7 Max/Plus and their dated snapshots expose a 256K thinking
  // budget. Keep Max here as well as Plus; otherwise it falls through to
  // the generic 16K budget despite the model accepting the larger value.
  if (/qwen3[._-]?7-(?:max|plus)(?:[-._/]|$)/.test(model)) {
    return 262_144
  }
  // Qwen3.6-Max Preview publishes a 128K maximum thinking budget
  // (distinct from the 81,920 budget used by the 3.6/3.5 Plus models).
  if (/qwen3[._-]?6-max-preview(?:[-._/]|$)/.test(model)) {
    return 131_072
  }
  // Current Qwen3.5/3.6 open and hosted variants publish an 80K cap too.
  if (
    /qwen3[._-]?6-(?:35b-a3b|27b)(?:[-._/]|$)/.test(model) ||
    /qwen3[._-]?5-(?:397b-a17b|122b-a10b|27b|35b-a3b)(?:[-._/]|$)/.test(model) ||
    /qwen3-vl-(?:plus|flash|235b-a22b|32b|30b-a3b|8b)(?:[-._/]|$)/.test(model)
  ) {
    return 81_920
  }
  if (
    /qwen3[._-]?(?:5|6)-(?:plus|flash)|qwen3-max(?:-(?:preview|2026-01-23))?(?:[-._/]|$)/.test(model) ||
    isSnapshotAtOrAfter(model, 'qwen-plus', '2025-04-28') ||
    isSnapshotAtOrAfter(model, 'qwen-flash', '2025-07-28') ||
    /qwen-(?:turbo|omni-turbo)(?:[-._/]|$)/.test(model)
  ) {
    return 81_920
  }
  // The open Qwen3 checkpoints expose rounded 38K/30K maximum budgets.
  if (
    /qwen3[._-]?(?:235b-a22b|32b|30b-a3b|14b|8b|4b|1[._-]?7b|0[._-]?6b)(?:[-._/]|$)/.test(model) ||
    /qwen3[._-]?next-80b-a3b(?:[-._/]|$)/.test(model) ||
    /qwen3[._-]?turbo(?:[-._/]|$)/.test(model)
  ) {
    return /qwen3[._-]?(?:1[._-]?7b|0[._-]?6b)/.test(model) ? 30_720 : 38_912
  }
  return null
}

function getQwenFixedThinkingBudget(model: string): number | null {
  // These IDs are thinking-only, but the official Chat API still accepts a
  // real thinking_budget cap.  Keep the toggle off the wire and expose only
  // budget choices; Responses is rejected by the caller below.
  if (
    /qwen3[._-]?(?:235b-a22b|30b-a3b)(?:[-._/]|$).*thinking/.test(model) ||
    /qwen3[._-]?next-80b-a3b-thinking(?:[-._/]|$)/.test(model) ||
    /qwen3-vl-(?:235b-a22b|32b|30b-a3b|8b)-thinking(?:[-._/]|$)/.test(model)
  ) {
    return 81_920
  }
  return null
}

function isDashscopeQwenNonThinkingModel(model: string): boolean {
  return /qwen3[._-].*-instruct(?:[-._/]|$)/.test(model)
}

function supportsQwenThinkingBudget(model: string): boolean {
  return /qwen3[._-]?(?:5|6|7)|qwen3-vl|qwen3-\d+(?:[._-]\d+)?b|qwen3-(?:max|plus|flash|turbo)|qwen-(?:plus|flash|turbo|omni-turbo)/.test(model)
}

function isSnapshotAtOrAfter(model: string, prefix: string, cutoff: string): boolean {
  if (model === prefix || model === `${prefix}-latest`) {
    return true
  }
  const match = model.match(new RegExp(`^${prefix}-(\\d{4}-\\d{2}-\\d{2})(?:[-._/]|$)`))
  return Boolean(match?.[1] && match[1] >= cutoff)
}

function isDashscopeQwenReasoningModel(model: string): boolean {
  return (
    /qwen3[._-]?8-max-preview/.test(model) ||
    /qwen3-vl-(?:plus|flash)(?:[-._/]|$)/.test(model) ||
    /qwen3[._-]?7-(?:max|plus)/.test(model) ||
    /qwen3[._-]?6-(?:max|plus|flash|\d+b)/.test(model) ||
    /qwen3[._-]?5-(?:plus|flash|\d+b)/.test(model) ||
    /qwen3-max(?:-2026-01-23|-preview)?(?:-us)?$/.test(model) ||
    /qwen3-\d+(?:[._-]\d+)?b(?:[-._/]|$)/.test(model) ||
    /qwen3-vl-(?:plus|flash)/.test(model) ||
    isSnapshotAtOrAfter(model, 'qwen-plus', '2025-04-28') ||
    isSnapshotAtOrAfter(model, 'qwen-flash', '2025-07-28') ||
    /qwen-(?:turbo|omni-turbo)(?:[-._/]|$)/.test(model)
  )
}

/**
 * DashScope's OpenAI-compatible Responses endpoint has its own, explicit
 * model allow-list.  It is not a generic router for the other models exposed
 * by Chat Completions, so keep non-listed models out of the reasoning adapter
 * instead of guessing that their Chat-only controls also work on Responses.
 */
function isDashscopeResponsesModel(model: string): boolean {
  return (
    /^qwen3[._-]8-max-preview$/.test(model) ||
    /^qwen3[._-]7-max(?:-2026-(?:05-20|06-08))?$/.test(model) ||
    /^qwen3-max(?:-2026-01-23)?$/.test(model) ||
    /^qwen3[._-]7-plus(?:-2026-05-26)?$/.test(model) ||
    /^qwen3[._-]6-plus(?:-2026-04-02)?$/.test(model) ||
    /^qwen3[._-]5-plus(?:-2026-(?:02-15|04-20))?$/.test(model) ||
    /^qwen3[._-]6-flash(?:-2026-04-16)?$/.test(model) ||
    /^qwen3[._-]5-flash(?:-2026-02-23)?$/.test(model) ||
    /^qwen3[._-]6-35b-a3b$/.test(model) ||
    /^qwen3[._-]5-(?:397b-a17b|122b-a10b|35b-a3b|27b)$/.test(model) ||
    /^qwen-(?:plus|flash)$/.test(model) ||
    /^qwen3-coder-(?:plus|flash)$/.test(model) ||
    /^qwen3[._-]5-ocr$/.test(model) ||
    /^qwen-(?:plus|flash)-character$/.test(model)
  )
}

/**
 * Qwen3-Omni-Flash is a hybrid-thinking Chat model, but it is not listed by
 * Bailian's OpenAI-compatible Responses model table.  Unlike the text Qwen3
 * families, the documented control is only enable_thinking; thinking_budget
 * is not documented for this model.
 */
function isDashscopeQwenOmniFlash(model: string): boolean {
  return /qwen3[._-]?omni-flash(?:[-._/]|$)/.test(model)
}

function isSiliconFlowChinaHost(baseUrl: unknown): boolean {
  return isHostname(getProviderHostname(baseUrl), 'api.siliconflow.cn')
}

/**
 * SiliconFlow's documented enable_thinking allowlist differs between the
 * China and international gateways. Keep the lists separate: sharing the
 * union makes a valid-looking UI emit fields that one regional API does not
 * advertise for that model.
 */
function isSiliconFlowBudgetToggleModel(model: string, chinaGateway: boolean): boolean {
  if (chinaGateway) {
    return (
      /^qwen\/qwen3-(?:8b|14b|32b|30b-a3b)(?:[-._/]|$)/.test(model) ||
      /^qwen\/qwen3[._-]?5-(?:397b-a17b|122b-a10b|35b-a3b|27b|9b|4b)(?:[-._/]|$)/.test(model) ||
      /^(?:pro\/)?deepseek-ai\/deepseek-v3(?:[._-]?2|[._-]?1-terminus)(?:[-._/]|$)/.test(model)
    )
  }
  return (
    /^qwen\/qwen3-(?:235b-a22b|8b|14b|32b|30b-a3b)(?:[-._/]|$)/.test(model) ||
    /^deepseek-ai\/deepseek-v3(?:[._-]?1(?:-terminus)?|[._-]?2(?:-exp)?)(?:[-._/]|$)/.test(model)
  )
}

function isSiliconFlowToggleModel(model: string, chinaGateway: boolean): boolean {
  if (/^tencent\/hunyuan-a13b-instruct(?:[-._/]|$)/.test(model)) {
    return true
  }
  if (chinaGateway) {
    return (
      /^pro\/zai-org\/glm-(?:5|4[._-]?7)(?:[-._/]|$)/.test(model) ||
      /^zai-org\/glm-(?:4[._-]?6|4[._-]?5v)(?:[-._/]|$)/.test(model)
    )
  }
  return /^zai-org\/glm-(?:5v-turbo|4[._-]6v|4[._-]5v)(?:[-._/]|$)/.test(model)
}

function getProviderReasoningMatch(
  modelValue: unknown,
  context: ReasoningProviderContext = {}
): ProviderReasoningMatch | null {
  const model = getReasoningCapabilityKey(modelValue)
  const provider = getKnownReasoningProvider(context.baseUrl)
  const apiStyle = String(context.apiStyle) === 'responses' ? 'responses' : 'chat_completions'

  if (provider === 'openai') {
    if (/gpt-5(?:\.\d+)?-pro(?:[-._/]|$)/.test(model) && apiStyle !== 'responses') {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: 'OpenAI GPT-5 Pro 型号仅支持 Responses API；Chat Completions 不发送推理字段' }
      )
    }
    return { transport: getEffortTransport(apiStyle) }
  }
  if (provider === 'anthropic') {
    return { transport: { kind: 'anthropic_effort' } }
  }
  if (provider === 'openrouter') {
    return { transport: { kind: 'nested_effort' } }
  }

  if (provider === 'siliconflow') {
    const chinaGateway = isSiliconFlowChinaHost(context.baseUrl)
    if (apiStyle === 'responses') {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: 'SiliconFlow 官方当前仅声明 Chat Completions 推理参数，不支持 Responses 推理映射' }
      )
    }
    if (/^deepseek-ai\/deepseek-v4-flash(?:[-._/]|$)/.test(model)) {
      // reasoning_effort for V4 Flash is currently documented by the China
      // API only. Do not copy that field to the international gateway.
      if (!chinaGateway) {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: 'SiliconFlow .com 当前未公开 DeepSeek V4 Flash 的 reasoning_effort，停止猜测字段' },
          true
        )
      }
      return makeProviderMatch(
        { kind: 'flat_effort' },
        {
          levels: ['high', 'max'],
          defaultEffort: 'high',
          mandatory: true,
          aliases: REAL_HIGH_MAX_ALIASES,
          note: 'SiliconFlow DeepSeek V4 Flash 使用顶层 reasoning_effort，真实档位为高、最高'
        }
      )
    }
    if ((chinaGateway
      ? /^(?:pro\/)?deepseek-ai\/deepseek-r1(?:[-._/]|$)/
      : /^deepseek-ai\/deepseek-r1(?:[-._/]|$)/
    ).test(model)) {
      return makeProviderMatch(
        {
          kind: 'fixed_with_budget',
          budgetByEffort: { low: 1_024, medium: 8_192, high: 32_768 }
        },
        {
          levels: ['default', 'low', 'medium', 'high'],
          mandatory: true,
          optionLabels: {
            default: '厂家默认',
            low: '1K 预算',
            medium: '8K 预算',
            high: '32K 预算'
          },
          optionHints: {
            default: '省略 thinking_budget，保持 SiliconFlow 默认思维链预算',
            low: 'thinking_budget=1024',
            medium: 'thinking_budget=8192',
            high: 'thinking_budget=32768'
          },
          note: 'SiliconFlow DeepSeek-R1 固定思考，但支持通过 thinking_budget 调整真实思维链预算'
        }
      )
    }
    if (isSiliconFlowBudgetToggleModel(model, chinaGateway)) {
      return makeProviderMatch(
        {
          kind: 'enable_thinking',
          budgetByEffort: { low: 1_024, medium: 8_192, high: 32_768 }
        },
        {
          levels: ['default', 'none', 'low', 'medium', 'high'],
          optionLabels: {
            default: '厂家默认',
            none: '关闭',
            low: '1K 预算',
            medium: '8K 预算',
            high: '32K 预算'
          },
          optionHints: {
            default: '省略推理参数，保持 SiliconFlow 当前模型默认行为',
            none: 'enable_thinking=false',
            low: 'enable_thinking=true，thinking_budget=1024',
            medium: 'enable_thinking=true，thinking_budget=8192',
            high: 'enable_thinking=true，thinking_budget=32768'
          },
          note: 'SiliconFlow 该混合思考模型使用 enable_thinking，并支持真实 thinking_budget（最大 32K）'
        }
      )
    }
    if (isSiliconFlowToggleModel(model, chinaGateway)) {
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['default', 'none', 'high'],
          optionLabels: { default: '厂家默认', ...OFF_ON_LABELS },
          optionHints: {
            default: '省略 enable_thinking，保持 SiliconFlow 当前模型默认行为',
            ...OFF_ON_HINTS
          },
          note: 'SiliconFlow 该模型只公开 enable_thinking 开关，未公开离散强度'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该 SiliconFlow 型号未声明可调推理参数，已停止猜测字段' },
      true
    )
  }

  if (provider === 'vanchin') {
    if (apiStyle === 'responses') {
      return makeProviderMatch(
        { kind: 'unsupported' },
        {
          levels: NONE,
          note: '万擎 Responses 使用不透明的 ep-* 推理点 ID；只有渠道显式元数据声明 effort 档位后才发送 reasoning.effort'
        },
        true
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '万擎 Chat 的 model 必须是 ep-* 推理点 ID，无法从 ID 识别底层模型；不按别名猜测 enable_thinking' }
    )
  }

  if (provider === 'deepseek') {
    if (apiStyle === 'responses') {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: 'DeepSeek 官方直连仅提供 Chat Completions，不支持 Responses API' }
      )
    }
    if (/deepseek-v4-(?:pro|flash)/.test(model)) {
      return makeProviderMatch(
        { kind: 'effort_with_thinking', effortField: 'flat' },
        {
          levels: ['none', 'high', 'max'],
          defaultEffort: 'high',
          note: 'DeepSeek 官方接口真实支持关闭、高、最高；低/中会被厂家按高处理',
          aliases: REAL_HIGH_MAX_ALIASES
        }
      )
    }
    if (/deepseek-reasoner/.test(model)) {
      return makeProviderMatch(
        { kind: 'effort_with_thinking', effortField: 'flat' },
        {
          levels: ['high', 'max'],
          defaultEffort: 'high',
          mandatory: true,
          aliases: REAL_HIGH_MAX_ALIASES,
          note: 'deepseek-reasoner 是即将下线的兼容别名，对应 DeepSeek V4 Flash 思考模式，支持高、最高'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该 DeepSeek 型号不支持可调推理强度' },
      true
    )
  }

  if (provider === 'dashscope') {
    if (apiStyle === 'responses' && !isDashscopeResponsesModel(model)) {
      return makeProviderMatch(
        { kind: 'unsupported' },
        {
          levels: NONE,
          note: '该型号不在百炼 Responses API 官方 Qwen 支持列表中，不发送推理参数'
        }
      )
    }
    if (
      /qwen3[._-]?7-max-(?:preview|2026-05-17)(?:[-._/]|$)/.test(model)
    ) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '该 Qwen thinking-only 型号未列入百炼 Responses 支持列表' }
        )
      }
      return makeProviderMatch(
        { kind: 'fixed_with_budget', budgetByEffort: { high: 262_144 } },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: { high: '256K 预算' },
          optionHints: { high: 'thinking_budget=262144；思考模式固定开启' },
          note: '该 Qwen thinking-only 型号固定开启思考，Chat 支持真实 256K thinking_budget'
        }
      )
    }
    if (isDashscopeQwenNonThinkingModel(model)) {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: '该 Qwen instruct 型号不支持思考预算或推理强度' },
        true
      )
    }
    if (/qwq|qvq-(?:max|plus)|qwen3-vl-.*[-._]thinking(?:[-._]|$)|qwen.*[-._]thinking(?:[-._]|$)/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '该 Qwen 固定思考型号未列入百炼 Responses 支持列表' }
        )
      }
      const fixedBudget = getQwenFixedThinkingBudget(model)
      if (fixedBudget) {
        return makeProviderMatch(
          {
            kind: 'fixed_with_budget',
            budgetByEffort: { low: 4_096, medium: 16_384, high: fixedBudget }
          },
          {
            levels: ['low', 'medium', 'high'],
            defaultEffort: 'high',
            mandatory: true,
            optionLabels: {
              low: '4K 预算',
              medium: '16K 预算',
              high: `${Math.round(fixedBudget / 1024)}K 预算`
            },
            optionHints: {
              low: 'thinking_budget=4096；思考模式固定开启',
              medium: 'thinking_budget=16384；思考模式固定开启',
              high: `thinking_budget=${fixedBudget}；思考模式固定开启`
            },
            note: `该 Qwen thinking-only 型号固定开启思考，Chat 支持真实 thinking_budget，最大 ${Math.round(fixedBudget / 1024)}K`
          }
        )
      }
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '该 Qwen 型号为固定思考模型，厂家不提供可调档位'
        }
      )
    }
    if (isDashscopeQwenOmniFlash(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: 'Qwen3-Omni-Flash 未列入百炼 Responses 支持列表' }
        )
      }
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'none',
          optionLabels: OFF_ON_LABELS,
          optionHints: {
            none: 'enable_thinking=false',
            high: 'enable_thinking=true（该模型未公开 thinking_budget）'
          },
          note: 'Qwen3-Omni-Flash 仅支持 enable_thinking 开关，不支持 thinking_budget'
        }
      )
    }
    // qwen3.6-max-preview supports thinking_budget on Chat, but it is not in
    // the current Responses model list. Keep this fail-closed before the
    // generic Qwen Responses matcher below.
    if (apiStyle === 'responses' && /qwen3[._-]?6-max-preview(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: 'qwen3.6-max-preview 未列入百炼 Responses 支持列表' }
      )
    }
    if (apiStyle === 'responses' && isDashscopeQwenReasoningModel(model)) {
      const extended = supportsDashscopeExtendedEffort(context.baseUrl)
      return makeProviderMatch(
        { kind: 'nested_effort' },
        {
          levels: extended
            ? ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
            : ['none', 'minimal', 'low', 'medium', 'high'],
          defaultEffort: extended ? 'xhigh' : 'high',
          note: extended
            ? '百炼 Qwen Responses 使用 reasoning.effort，支持关闭到最高共 7 档'
            : '当前百炼地域的 Qwen Responses 支持关闭到高；极高/最高仅北京、新加坡可用'
        }
      )
    }
    if (apiStyle === 'responses' && /qwen/.test(model)) {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: '该 Qwen 型号不支持 Responses 推理强度' },
        true
      )
    }
    if (/qwen3[._-]?8-max-preview/.test(model)) {
      return makeProviderMatch(
        { kind: 'flat_effort' },
        {
          levels: ['low', 'medium', 'xhigh'],
          defaultEffort: 'xhigh',
          mandatory: true,
          aliases: { minimal: 'low', high: 'xhigh', max: 'xhigh' },
          note: '百炼 Qwen 3.8 Max Preview 使用真实 reasoning_effort：轻度、中、极高'
        }
      )
    }
    if (/qwen/.test(model) && isDashscopeQwenReasoningModel(model)) {
      const maximum = getQwenBudgetMaximum(model)
      if (maximum || supportsQwenThinkingBudget(model)) {
        const lowBudget = maximum ? 4_096 : 1_024
        const mediumBudget = maximum ? 16_384 : 4_096
        const highBudget = maximum ?? 16_384
        const defaultsToThinking = !/qwen3-(?:max|plus|flash|turbo)|qwen-(?:plus|flash|turbo)|qwen3-vl/.test(model)
        return makeProviderMatch(
          {
            kind: 'enable_thinking',
            budgetByEffort: { low: lowBudget, medium: mediumBudget, high: highBudget }
          },
          {
            levels: ['none', 'low', 'medium', 'high'],
            defaultEffort: defaultsToThinking ? 'high' : 'none',
            optionLabels: {
              none: '关闭',
              low: `${Math.round(lowBudget / 1024)}K 预算`,
              medium: `${Math.round(mediumBudget / 1024)}K 预算`,
              high: `${Math.round(highBudget / 1024)}K 预算`
            },
            optionHints: {
              none: 'enable_thinking=false',
              low: `开启思考并发送 thinking_budget=${lowBudget}`,
              medium: `开启思考并发送 thinking_budget=${mediumBudget}`,
              high: `开启思考并发送 thinking_budget=${highBudget}`
            },
            note: maximum
              ? `百炼 Chat 使用真实思考预算；当前模型最大预算 ${maximum.toLocaleString('en-US')} tokens`
              : '百炼 Chat 使用真实 thinking_budget；当前模型最大值未公开，因此只提供明确的 1K/4K/16K 预算'
          }
        )
      }
      const defaultsToThinking = /qwen3[._-]?(?:5|6|7)|qwen3(?![-_.]?(?:max|plus|flash|turbo))/.test(model)
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          defaultEffort: defaultsToThinking ? 'high' : 'none',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '百炼 Chat 对该 Qwen 型号只确认了思考开关；未获知最大预算，因此不伪造强度档'
        }
      )
    }
    if (/kimi(?:\/kimi)?-k3/.test(model)) {
      return makeProviderMatch(
        { kind: 'flat_effort' },
        {
          levels: ['max'],
          defaultEffort: 'max',
          mandatory: true,
          optionLabels: { max: '固定最高' },
          note: '百炼 Kimi K3 当前只公开最高档；请求会显式发送 reasoning_effort=max'
        }
      )
    }
    if (/qwen/.test(model)) {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: '该 Qwen 型号未声明思考开关、预算或推理强度' },
        true
      )
    }
    if (/kimi(?:\/kimi)?-k2[._-]7-code/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '百炼 Kimi K2.7 Code 固定思考，厂家不提供可调强度'
        }
      )
    }
    if (/kimi(?:\/kimi)?-k2[._-]?(?:5|6)/.test(model)) {
      const moonshotHosted = model.includes('kimi/kimi-')
      if (!moonshotHosted) {
        const isK25 = /kimi-k2[._-]?5/.test(model)
        const highBudget = isK25 ? 81_920 : 16_384
        return makeProviderMatch(
          {
            kind: 'enable_thinking',
            budgetByEffort: { low: 1_024, medium: 4_096, high: highBudget }
          },
          {
            levels: ['none', 'low', 'medium', 'high'],
            defaultEffort: 'none',
            optionLabels: {
              none: '关闭',
              low: '1K 预算',
              medium: '4K 预算',
              high: `${Math.round(highBudget / 1024)}K 预算`
            },
            optionHints: {
              none: 'enable_thinking=false',
              low: 'enable_thinking=true，thinking_budget=1024',
              medium: 'enable_thinking=true，thinking_budget=4096',
              high: `enable_thinking=true，thinking_budget=${highBudget}`
            },
            note: isK25
              ? '百炼部署 Kimi K2.5 支持真实 thinking_budget，最大 81,920 tokens'
              : '百炼部署 Kimi K2.6 支持 thinking_budget；最大值未公开，提供明确的 1K/4K/16K 预算'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: moonshotHosted ? ['default', 'none', 'high'] : ['none', 'high'],
          defaultEffort: moonshotHosted ? undefined : 'none',
          optionLabels: moonshotHosted
            ? { default: '厂家默认', ...OFF_ON_LABELS }
            : OFF_ON_LABELS,
          optionHints: moonshotHosted
            ? { default: '省略 enable_thinking，保持该部署默认行为', ...OFF_ON_HINTS }
            : OFF_ON_HINTS,
          note: moonshotHosted
            ? '百炼上的 Moonshot 直供 Kimi 只支持 enable_thinking 开关，不支持 thinking_budget；默认行为保持省略'
            : '百炼部署 Kimi 默认关闭思考，只支持 enable_thinking 开关，不支持 thinking_budget'
        }
      )
    }
    if (/minimax-m3/.test(model)) {
      return makeProviderMatch(
        { kind: 'minimax_adaptive' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: { none: '关闭', high: '自适应' },
          note: 'MiniMax M3 仅支持关闭或自适应思考，没有离散强度档'
        }
      )
    }
    if (/minimax(?:\/minimax)?-m2(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '百炼 MiniMax M2.x 固定思考，厂家不提供可调强度'
        }
      )
    }
    // 百炼同时提供 Model Studio 托管的 glm-* 和智谱直供的
    // ZHIPU/GLM-* 两套路由；它们接受的推理字段与档位并不相同。
    if (/^zhipu\/glm-5[._-]2$/.test(model)) {
      return makeProviderMatch(
        { kind: 'effort_with_enable_thinking', effortField: 'flat' },
        {
          levels: ['none', 'high', 'max'],
          defaultEffort: 'max',
          aliases: OFF_HIGH_MAX_ALIASES,
          note: '百炼智谱直供 GLM-5.2 使用 enable_thinking 与 reasoning_effort，真实档位为关闭、高、最高；默认最高'
        }
      )
    }
    if (/^zhipu\/glm-5(?:[._-]1)?$/.test(model)) {
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '百炼智谱直供 GLM-5/5.1 仅支持 enable_thinking 开关，不发送 reasoning_effort'
        }
      )
    }
    if (/^glm-5[._-]2(?:-fast-preview|-us)?$/.test(model)) {
      return makeProviderMatch(
        { kind: 'effort_with_enable_thinking', effortField: 'flat' },
        {
          levels: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
          defaultEffort: 'high',
          note: '百炼 GLM-5.2 真实支持关闭、极简、轻度、中、高、极高、最高 7 档；默认高'
        }
      )
    }
    if (/^glm-5(?:[._-]1)?$/.test(model)) {
      return makeProviderMatch(
        { kind: 'effort_with_enable_thinking', effortField: 'flat' },
        {
          levels: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
          defaultEffort: 'high',
          note: `百炼 ${/^glm-5[._-]1$/.test(model) ? 'GLM-5.1' : 'GLM-5'} 支持关闭到极高 6 档，不支持 max；默认高`
        }
      )
    }
    if (/glm-4[._-](?:5|6|7)/.test(model)) {
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '百炼上的该 GLM 型号只确认了思考开关，不伪造强度档'
        }
      )
    }
    if (/deepseek-v4/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'nested_effort' },
          {
            levels: ['none', 'high', 'max'],
            defaultEffort: 'high',
            aliases: REAL_HIGH_MAX_ALIASES,
            note: '百炼 Responses 的 DeepSeek V4 使用 reasoning.effort，真实支持关闭、高、最高'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'effort_with_enable_thinking', effortField: 'flat' },
        {
          levels: ['none', 'high', 'max'],
          defaultEffort: 'high',
          aliases: REAL_HIGH_MAX_ALIASES,
          note: '百炼 DeepSeek V4 真实支持关闭、高、最高；低/中会按高处理'
        }
      )
    }
    if (/deepseek-v3[._-]?(?:1|2)/.test(model)) {
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'none',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '百炼 DeepSeek V3.1/V3.2 只支持思考开关，默认关闭'
        }
      )
    }
    if (/deepseek-r1/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '百炼 DeepSeek R1 为固定思考模型，厂家不提供可调强度'
        }
      )
    }
    if (/^xiaomi\/mimo-v2[._-]5-pro$/.test(model)) {
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '百炼 Xiaomi MiMo V2.5 Pro 仅支持 enable_thinking 开关，默认开启思考'
        }
      )
    }
    if (/stepfun\/step-3[._-]7-flash/.test(model)) {
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '百炼 Stepfun 3.7 Flash 当前只确认思考开关，不伪造强度档'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该百炼 Chat 型号未声明可调推理字段，已停止按通用协议猜测' },
      true
    )
  }

  if (provider === 'zhipu') {
    if (apiStyle === 'responses') {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: '智谱官方 OpenAI 兼容接口当前仅声明 Chat Completions' }
      )
    }
    if (/glm-(?:5[._-]?2|[6-9])(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'effort_with_thinking', effortField: 'flat' },
        {
          levels: ['none', 'high', 'max'],
          defaultEffort: 'max',
          aliases: OFF_HIGH_MAX_ALIASES,
          note: '智谱 GLM-5.2+ 的真实档位为关闭、高、最高；默认最高'
        }
      )
    }
    if (/glm-(?:4[._-](?:5v?|6v?|7)|5(?:v(?:[-._]?turbo)?)?)(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '该 GLM 型号只支持 thinking 开关，不存在真实低/中/高档'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该 GLM 型号未声明推理强度或思考开关' },
      true
    )
  }

  if (provider === 'minimax') {
    if (apiStyle === 'responses') {
      if (/minimax-m3/.test(model)) {
        return makeProviderMatch(
          { kind: 'nested_effort' },
          {
            levels: ['none', 'high'],
            defaultEffort: 'none',
            aliases: {
              minimal: 'high',
              low: 'high',
              medium: 'high',
              xhigh: 'high',
              max: 'high'
            },
            optionLabels: { none: '关闭', high: '自适应' },
            optionHints: {
              none: 'reasoning.effort=none',
              high: 'reasoning.effort=high；开启 Adaptive Thinking，但不改变推理深度'
            },
            note: 'MiniMax M3 Responses 使用 reasoning.effort 控制是否输出自适应思考；非 none 值只表示开启，不代表强度档'
          }
        )
      }
      if (/minimax-m2(?:[-._/]|$)/.test(model)) {
        return makeProviderMatch(
          { kind: 'fixed' },
          {
            levels: HIGH_ONLY,
            defaultEffort: 'high',
            mandatory: true,
            optionLabels: FIXED_LABELS,
            note: 'MiniMax M2.x Responses 固定开启思考，厂家不提供可调控制'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: '该 MiniMax 型号未在 Responses 文档中声明推理控制' },
        true
      )
    }
    if (/minimax-m3/.test(model)) {
      return makeProviderMatch(
        { kind: 'minimax_adaptive' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: { none: '关闭', high: '自适应' },
          optionHints: { none: 'thinking.type=disabled', high: 'thinking.type=adaptive' },
          note: 'MiniMax M3 仅支持关闭或自适应思考，没有低/中/高强度'
        }
      )
    }
    if (/minimax-m2(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: 'MiniMax M2.x 固定开启思考；reasoning_split 只改变返回格式，不能调强度'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该 MiniMax 型号未声明可调推理控制' },
      true
    )
  }

  if (provider === 'ark') {
    // 方舟文档当前仅给 DeepSeek V4 的 Chat API 提供 reasoning_effort；
    // Responses API 仍支持 thinking 开关，但不能伪造 reasoning.effort。
    if (/deepseek-v4/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'thinking_toggle' },
          {
            levels: ['none', 'high'],
            defaultEffort: 'high',
            optionLabels: OFF_ON_LABELS,
            optionHints: OFF_ON_HINTS,
            note: '方舟 DeepSeek V4 Responses 当前仅支持 thinking 开关，reasoning.effort 尚未开放'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'effort_with_thinking', effortField: 'flat' },
        {
          levels: ['none', 'high', 'max'],
          defaultEffort: 'high',
          aliases: REAL_HIGH_MAX_ALIASES,
          note: '火山方舟 DeepSeek V4 Chat 真实支持关闭、高、最高 3 档'
        }
      )
    }
    if (/glm-5[._-]?2/.test(model)) {
      return makeProviderMatch(
        getEffortWithThinkingTransport(apiStyle),
        {
          levels: ['none', 'high', 'max'],
          defaultEffort: 'max',
          aliases: OFF_HIGH_MAX_ALIASES,
          note: '火山方舟 GLM-5.2 真实支持关闭、高、最高 3 档'
        }
      )
    }
    const doubaoEffort = /doubao-seed-(?:evolving|2[-._]1-(?:pro|turbo)|2[-._]0-(?:lite|mini|pro|code-preview)|1[-._]8|1[-._]6-251015)|doubao.*character/.test(model)
    if (doubaoEffort) {
      const defaultsHigh = /doubao-seed-(?:evolving|2[-._]1-(?:pro|turbo)-260628)/.test(model)
      return makeProviderMatch(
        getEffortWithThinkingTransport(apiStyle),
        {
          levels: ['none', 'low', 'medium', 'high'],
          defaultEffort: defaultsHigh ? 'high' : 'medium',
          aliases: { minimal: 'none' },
          note: `豆包通过${apiStyle === 'responses' ? ' reasoning.effort' : ' reasoning_effort'}真实支持关闭、轻度、中、高`
        }
      )
    }
    if (
      /doubao-seed-1[-._]6-(?:250615|vision-250815|flash-(?:250615|250828))|doubao-seed-code-preview-251028/.test(model)
    ) {
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '该旧版豆包只支持 thinking 开关，不支持强度档'
        }
      )
    }
    if (/glm-4[._-]7(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '方舟 GLM-4.7 仅支持 thinking 开关，不支持 reasoning_effort'
        }
      )
    }
    if (/deepseek-v3[._-]2(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'none',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '方舟 DeepSeek V3.2 仅支持 thinking 开关，默认关闭'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      {
        levels: NONE,
        note: '方舟 ep-* / 别名无法识别底层模型，已停止猜测强度字段；请使用可识别的官方模型 ID'
      }
    )
  }

  if (provider === 'moonshot') {
    if (apiStyle === 'responses') {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: 'Moonshot 官方直连仅提供 Chat Completions，不支持 Responses API' }
      )
    }
    if (/kimi-k3(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'flat_effort' },
        {
          levels: ['low', 'high', 'max'],
          defaultEffort: 'max',
          mandatory: true,
          note: 'Moonshot Kimi K3 真实支持轻度、高、最高 3 档，且不可关闭'
        }
      )
    }
    if (/kimi-k2[._-]7-code/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: 'Kimi K2.7 Code 固定思考，厂家不提供强度或关闭开关'
        }
      )
    }
    if (/kimi-k2[._-](?:5|6)/.test(model)) {
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: 'Kimi K2.5/K2.6 直连只支持 thinking 开关，没有强度档'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该 Moonshot 型号不支持推理控制' },
      true
    )
  }

  if (provider === 'qianfan') {
    if (/gpt-oss-(?:120b|20b)(?:[-._/]|$)/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '千帆 Responses 当前支持列表不包含 GPT-OSS' }
        )
      }
      return makeProviderMatch(
        { kind: 'flat_effort' },
        {
          levels: ['default', 'low', 'medium', 'high'],
          note: '千帆 GPT-OSS 使用顶层 reasoning_effort；厂家未声明默认档，默认时保持省略'
        }
      )
    }
    if (/deepseek-v4-(?:pro|flash)/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'thinking_toggle' },
          {
            levels: ['none', 'high'],
            defaultEffort: 'high',
            optionLabels: OFF_ON_LABELS,
            optionHints: OFF_ON_HINTS,
            note: '千帆 Responses 对 DeepSeek V4 只公开 thinking 开关，不提供 high/max 强度'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'effort_with_thinking', effortField: 'flat' },
        {
          levels: ['none', 'high', 'max'],
          defaultEffort: 'high',
          aliases: REAL_HIGH_MAX_ALIASES,
          note: '百度千帆 DeepSeek V4 的真实强度只有高、最高 2 档'
        }
      )
    }
    if (/deepseek-v3[._-]?1(?:[-._](?:think))?(?:[-._]250821)?(?:[-._/]|$)/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '千帆 Responses 当前支持列表未明确包含 DeepSeek V3.1' }
        )
      }
      const thinkingVariant = /deepseek-v3[._-]?1[-._]think[-._]250821(?:[-._/]|$)/.test(model)
      if (thinkingVariant) {
        return makeProviderMatch(
          { kind: 'fixed_with_budget', budgetByEffort: { low: 4_096, medium: 16_384, high: 32_768 } },
          {
            levels: ['low', 'medium', 'high'],
            defaultEffort: 'high',
            mandatory: true,
            optionLabels: {
              low: '4K 预算',
              medium: '16K 预算',
              high: '32K 预算'
            },
            optionHints: {
              low: 'thinking_budget=4096；思考模式固定开启',
              medium: 'thinking_budget=16384；思考模式固定开启',
              high: 'thinking_budget=32768；思考模式固定开启'
            },
            note: '千帆 DeepSeek V3.1 Think 固定思考，Chat 支持真实 thinking_budget；官方思维链上限为 32K'
          }
        )
      }
      return makeProviderMatch(
        {
          kind: 'thinking_toggle',
          budgetByEffort: { low: 4_096, medium: 16_384, high: 32_768 }
        },
        {
          levels: ['none', 'low', 'medium', 'high'],
          defaultEffort: 'none',
          optionLabels: {
            none: '关闭',
            low: '4K 预算',
            medium: '16K 预算',
            high: '32K 预算'
          },
          optionHints: {
            none: 'thinking.type=disabled',
            low: 'thinking.type=enabled，thinking_budget=4096',
            medium: 'thinking.type=enabled，thinking_budget=16384',
            high: 'thinking.type=enabled，thinking_budget=32768'
          },
          note: '千帆 DeepSeek V3.1 混合模型使用 thinking.type 与真实 thinking_budget；官方思维链上限为 32K'
        }
      )
    }
    if (/deepseek-r1(?:[-._]250528)?(?:[-._/]|$)/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '千帆 Responses 当前支持列表未明确包含 DeepSeek R1' }
        )
      }
      if (!/deepseek-r1[-._]250528(?:[-._/]|$)/.test(model)) {
        return makeProviderMatch(
          { kind: 'fixed' },
          {
            levels: HIGH_ONLY,
            defaultEffort: 'high',
            mandatory: true,
            optionLabels: FIXED_LABELS,
            note: '千帆 DeepSeek R1 固定思考；官方 thinking_budget 支持清单只明确列出 deepseek-r1-250528，因此该别名不发送预算字段'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'fixed_with_budget', budgetByEffort: { low: 4_096, medium: 16_384, high: 32_768 } },
        {
          levels: ['low', 'medium', 'high'],
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: {
            low: '4K 预算',
            medium: '16K 预算',
            high: '32K 预算'
          },
          optionHints: {
            low: 'thinking_budget=4096；思考模式固定开启',
            medium: 'thinking_budget=16384；思考模式固定开启',
            high: 'thinking_budget=32768；思考模式固定开启'
          },
          note: '千帆 DeepSeek R1 固定思考，Chat 支持真实 thinking_budget；官方思维链上限为 32K'
        }
      )
    }
    if (/deepseek-v3[._-]?2(?:[-._/]|$)/.test(model)) {
      const thinkingVariant = /deepseek-v3[._-]?2[-._]think(?:[-._/]|$)/.test(model)
      if (thinkingVariant && apiStyle !== 'responses') {
        return makeProviderMatch(
          { kind: 'fixed_with_budget', budgetByEffort: { low: 4_096, medium: 16_384, high: 32_768 } },
          {
            levels: ['low', 'medium', 'high'],
            defaultEffort: 'high',
            mandatory: true,
            optionLabels: {
              low: '4K 预算',
              medium: '16K 预算',
              high: '32K 预算'
            },
            optionHints: {
              low: 'thinking_budget=4096；思考模式固定开启',
              medium: 'thinking_budget=16384；思考模式固定开启',
              high: 'thinking_budget=32768；思考模式固定开启'
            },
            note: '千帆 DeepSeek V3.2 Think 固定思考，Chat 支持真实 thinking_budget；官方思维链上限为 32K'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: thinkingVariant ? 'high' : 'none',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: `千帆 DeepSeek V3.2${thinkingVariant ? ' Think' : ''} 使用 thinking.type 开关；仅 Think 型号在官方预算支持清单中，因此普通型号不发送 thinking_budget`
        }
      )
    }
    if (/glm-5[._-]?2(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '千帆已将 GLM-5.2 列为深度思考模型，但尚未在参数支持清单中声明可控字段；固定思考且不猜测请求字段'
        }
      )
    }
    if (/glm-5(?:[-._]?1)?(?:[-/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: `千帆 ${/glm-5[._-]?1/.test(model) ? 'GLM-5.1' : 'GLM-5'} 使用 thinking.type 开关，默认开启`
        }
      )
    }
    if (/kimi-k2[._-]?6(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '千帆已将 Kimi-K2.6 列为深度思考模型，但尚未在参数支持清单中声明可控字段；固定思考且不猜测请求字段'
        }
      )
    }
    if (/kimi-k2[._-]?5(?:[-._/]|$)/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '千帆 Responses 当前支持列表不包含 Kimi K2.5' }
        )
      }
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '千帆 Kimi K2.5 使用 thinking.type 开关，厂家固定默认参数'
        }
      )
    }
    if (/ernie-(?:5[._-]0-thinking|4[._-]5.*vl)/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '千帆 Responses 当前支持列表不包含该 ERNIE 型号' }
        )
      }
      const defaultsToThinking = /ernie-5[._-]0-thinking/.test(model)
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          defaultEffort: defaultsToThinking ? 'high' : 'none',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: `该 ERNIE 型号只公开 enable_thinking 开关，默认${defaultsToThinking ? '开启' : '关闭'}，不提供强度档`
        }
      )
    }
    if (/qwen3[._-]?5-(?:397b-a17b|122b-a10b|35b-a3b|27b)(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '千帆已将该 Qwen3.5 型号列为深度思考模型，但尚未在参数支持清单中声明开关或预算字段；固定思考且不猜测请求字段'
        }
      )
    }
    if (/qwen.*thinking/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '该千帆 Qwen Thinking 型号未列入 Responses 支持列表' }
        )
      }
      // Qianfan explicitly lists the two 2507 thinking-only Qwen checkpoints
      // as supporting a real Chat `thinking_budget` cap (32K). They are not switchable, but
      // omitting the budget entirely would silently use the provider default
      // rather than the user-selected intensity bucket.
      if (/qwen3-(?:235b-a22b|30b-a3b)-thinking-2507(?:[-._/]|$)/.test(model)) {
        return makeProviderMatch(
          {
            kind: 'fixed_with_budget',
            budgetByEffort: { low: 4_096, medium: 16_384, high: 32_768 }
          },
          {
            levels: ['low', 'medium', 'high'],
            defaultEffort: 'high',
            mandatory: true,
            optionLabels: {
              low: '4K 预算',
              medium: '16K 预算',
              high: '32K 预算'
            },
            optionHints: {
              low: 'thinking_budget=4096；思考模式固定开启',
              medium: 'thinking_budget=16384；思考模式固定开启',
              high: 'thinking_budget=32768；思考模式固定开启'
            },
            note: '千帆 Qwen3 Thinking 固定思考，Chat 支持真实 thinking_budget；官方当前思维链上限为 32K'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '该千帆 Qwen Thinking 型号固定思考，厂家不提供可调强度'
        }
      )
    }
    if (/qwen3-(?:235b-a22b|32b|30b-a3b|14b|8b|4b|1[._-]?7b|0[._-]?6b)(?:[-._/]|$)/.test(model)) {
      if (apiStyle === 'responses' && !/qwen3-(?:14b|8b)(?:[-._/]|$)/.test(model)) {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '千帆 Responses 当前仅支持 Qwen3-14B/8B，不支持该型号' }
        )
      }
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'thinking_toggle' },
          {
            levels: ['none', 'high'],
            defaultEffort: 'high',
            optionLabels: OFF_ON_LABELS,
            optionHints: OFF_ON_HINTS,
            note: '该千帆 Qwen3 型号在 Responses 使用 thinking.type 开关；Responses 未公开 thinking_budget'
          }
        )
      }
      const published16KCap = /qwen3-(?:32b|14b|8b)(?:[-._/]|$)/.test(model)
      if (!published16KCap) {
        return makeProviderMatch(
          { kind: 'enable_thinking' },
          {
            levels: ['none', 'high'],
            defaultEffort: 'none',
            optionLabels: OFF_ON_LABELS,
            optionHints: OFF_ON_HINTS,
            note: '千帆明确该 Qwen3 型号支持 enable_thinking 与 thinking_budget，但当前模型表未列出思维链上限；只发送开关，不猜预算值'
          }
        )
      }
      return makeProviderMatch(
        {
          kind: 'enable_thinking',
          budgetByEffort: { low: 1_024, medium: 4_096, high: 16_384 }
        },
        {
          levels: ['none', 'low', 'medium', 'high'],
          defaultEffort: 'none',
          optionLabels: {
            none: '关闭',
            low: '1K 预算',
            medium: '4K 预算',
            high: '16K 预算'
          },
          optionHints: {
            none: 'enable_thinking=false',
            low: 'enable_thinking=true，thinking_budget=1024',
            medium: 'enable_thinking=true，thinking_budget=4096',
            high: 'enable_thinking=true，thinking_budget=16384'
          },
          note: '千帆 Qwen3 混合模型使用 enable_thinking 与真实 thinking_budget；官方当前思维链上限为 16K'
        }
      )
    }
    if (/ernie.*(?:x1|thinking)/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '该 ERNIE 思考模型为固定推理，官方未提供离散强度'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该百度千帆模型未声明可调推理强度' },
      true
    )
  }

  if (provider === 'tencent_tokenhub') {
    if (
      isTokenHubInternationalHost(context.baseUrl) &&
      !/deepseek-(?:v4-(?:pro|flash)(?:-\d+)?|v3[._-]2)|glm-5[._-]2(?:[-._/]|$)|kimi-k2[._-]7-code-highspeed|hy3(?:-preview)?(?:[-._/]|$)/.test(model)
    ) {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: '腾讯 TokenHub 国际入口当前文档只声明 DeepSeek 型号，未知型号不猜测字段' }
      )
    }
    if (/hy3(?:-preview)?(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        apiStyle === 'responses'
          ? { kind: 'nested_effort' }
          : { kind: 'effort_with_thinking', effortField: 'flat' },
        {
          levels: ['default', 'none', 'low', 'medium', 'high'],
          note: apiStyle === 'responses'
            ? '腾讯 TokenHub Hy3 Responses 使用 reasoning.effort，支持关闭、轻度、中、高'
            : '腾讯 TokenHub Hy3 Chat 支持关闭、轻度、中、高；“默认”保持厂家默认关闭，不会伪装成轻度'
        }
      )
    }
    if (/deepseek-(?:v4-(?:pro|flash)(?:-\d+)?|v3[._-]2)/.test(model)) {
      const tokenHubIntl = isTokenHubInternationalHost(context.baseUrl)
      const tokenHubV4 = /deepseek-v4-(?:pro|flash)(?:-\d+)?/.test(model)
      if (tokenHubIntl && apiStyle === 'responses' && tokenHubV4) {
        return makeProviderMatch(
          { kind: 'nested_effort' },
          {
            levels: ['none', 'high', 'max'],
            defaultEffort: 'high',
            aliases: REAL_HIGH_MAX_ALIASES,
            note: '腾讯 TokenHub 国际 DeepSeek Responses 使用 reasoning.effort，真实档位为关闭、高、最高'
          }
        )
      }
      if (apiStyle === 'responses' && !/deepseek-v4-(?:pro|flash)(?:-\d+)?/.test(model)) {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '腾讯 TokenHub Responses 当前仅支持 DeepSeek V4，不支持 V3.2' }
        )
      }
      if (tokenHubIntl && !tokenHubV4) {
        return makeProviderMatch(
          { kind: 'thinking_toggle' },
          {
            levels: ['none', 'high'],
            defaultEffort: tokenHubIntl ? 'none' : 'high',
            optionLabels: OFF_ON_LABELS,
            optionHints: OFF_ON_HINTS,
            note: `腾讯 TokenHub${tokenHubIntl ? ' 国际' : ''} DeepSeek V3.2 仅支持 thinking 开关，默认${tokenHubIntl ? '关闭' : '由平台决定'}`
          }
        )
      }
      return makeProviderMatch(
        tokenHubIntl
          ? { kind: 'effort_inside_thinking' }
          : apiStyle === 'responses'
            ? { kind: 'nested_effort' }
            : { kind: 'effort_with_thinking', effortField: 'flat' },
        {
          levels: tokenHubIntl ? ['none', 'high', 'max'] : ['none', 'low', 'medium', 'high'],
          defaultEffort: 'high',
          aliases: tokenHubIntl ? REAL_HIGH_MAX_ALIASES : undefined,
          note: tokenHubIntl
            ? '腾讯 TokenHub 国际 DeepSeek 使用 thinking.reasoning_effort，真实档位为关闭、高、最高'
            : `腾讯 TokenHub DeepSeek 使用${apiStyle === 'responses' ? ' reasoning.effort' : ' reasoning_effort'}，支持关闭、轻度、中、高`
        }
      )
    }
    if (/glm-5[._-]2(?:[-._/]|$)/.test(model)) {
      return makeProviderMatch(
        apiStyle === 'responses'
          ? { kind: 'nested_effort' }
          : { kind: 'effort_with_thinking', effortField: 'flat' },
        {
          levels: ['none', 'high', 'max'],
          defaultEffort: 'max',
          aliases: OFF_HIGH_MAX_ALIASES,
          note: `腾讯 TokenHub GLM-5.2 使用${apiStyle === 'responses' ? ' reasoning.effort' : ' reasoning_effort'}，真实档位为关闭、高、最高`
        }
      )
    }
    if (/kimi-k3(?:[-._/]|$)/.test(model)) {
      if (apiStyle === 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '腾讯 TokenHub Responses 当前支持列表不包含 Kimi K3' }
        )
      }
      return makeProviderMatch(
        { kind: 'flat_effort' },
        {
          levels: ['max'],
          defaultEffort: 'max',
          mandatory: true,
          optionLabels: { max: '固定最高' },
          note: '腾讯 TokenHub Kimi K3 仅支持固定 max 思考，必须发送顶层 reasoning_effort=max'
        }
      )
    }
    if (/kimi-k2[._-]7-code|minimax-m2/.test(model)) {
      if (apiStyle === 'responses' && !/kimi-k2[._-]7-code-highspeed/.test(model)) {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: '该腾讯 TokenHub 型号未列入 Responses 当前支持列表' }
        )
      }
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '该腾讯 TokenHub 型号固定思考，不支持关闭或强度'
        }
      )
    }
    if (apiStyle === 'chat_completions' && /glm-(?:5|4[._-][567])/.test(model)) {
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '腾讯 TokenHub 上的该 GLM 型号仅公开 thinking 开关'
        }
      )
    }
    if (apiStyle === 'chat_completions' && /kimi-k2[._-](?:5|6)/.test(model)) {
      return makeProviderMatch(
        { kind: 'thinking_toggle' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '腾讯 TokenHub 上的该 Kimi 型号仅公开 thinking 开关'
        }
      )
    }
    if (apiStyle === 'chat_completions' && /minimax-m3/.test(model)) {
      return makeProviderMatch(
        { kind: 'minimax_adaptive' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: { none: '关闭', high: '自适应' },
          note: '腾讯 TokenHub MiniMax M3 仅支持关闭或自适应思考'
        }
      )
    }
    // TokenHub's Qwen endpoint follows the Qwen-specific `enable_thinking`
    // boolean.  It does not accept the generic `thinking:{type}` object used
    // by DeepSeek/GLM/Kimi, even though all of them share the same gateway.
    if (apiStyle === 'chat_completions' && /qwen3[._-]5-(?:plus|flash)/.test(model)) {
      return makeProviderMatch(
        { kind: 'enable_thinking' },
        {
          levels: ['none', 'high'],
          defaultEffort: 'high',
          optionLabels: OFF_ON_LABELS,
          optionHints: OFF_ON_HINTS,
          note: '腾讯 TokenHub Qwen3.5 使用 enable_thinking 开关（默认开启）'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该腾讯 TokenHub 型号未声明可调推理强度' },
      true
    )
  }

  if (provider === 'tencent_hunyuan') {
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '腾讯旧混元 OpenAI 兼容接口未声明推理强度；Hy3 请改用 TokenHub' }
    )
  }

  if (provider === 'stepfun') {
    if (apiStyle === 'responses') {
      if (/step-3[._-]7-flash(?:[-._/]|$)/.test(model)) {
        return makeProviderMatch(
          { kind: 'nested_effort' },
          {
            levels: ['default', 'low', 'medium', 'high'],
            note: 'Step 3.7 Flash Responses 使用 reasoning.effort，支持轻度、中、高'
          }
        )
      }
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: 'StepFun Responses 官方当前仅支持 Step 3.7 Flash；其他型号不发送推理字段' }
      )
    }
    if (/step-3[._-]7-flash/.test(model)) {
      return makeProviderMatch(
        { kind: 'flat_effort' },
        {
          levels: ['default', 'low', 'medium', 'high'],
          note: 'Step 3.7 Flash 支持轻度、中、高；厂家未声明默认档，默认时保持省略'
        }
      )
    }
    if (/step-3[._-]5-flash-2603/.test(model)) {
      return makeProviderMatch(
        { kind: 'flat_effort' },
        {
          levels: ['default', 'low', 'high'],
          note: 'Step 3.5 Flash 2603 只支持轻度、高；厂家未声明默认档'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该 Step 型号未在官方文档中声明可调推理强度' },
      true
    )
  }

  if (provider === 'gemini') {
    if (apiStyle === 'responses') {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: 'Gemini 官方 OpenAI 兼容接口仅声明 Chat Completions，不支持 Responses API' }
      )
    }
    if (/gemini-2[._-]5-pro/.test(model)) {
      return makeProviderMatch(
        getEffortTransport(apiStyle),
        {
          levels: ['default', 'low', 'medium', 'high'],
          note: 'Gemini 2.5 Pro 支持轻度、中、高；默认是动态思考且不可关闭'
        }
      )
    }
    if (/gemini-2[._-]5-(?:flash|flash-lite)/.test(model)) {
      return makeProviderMatch(
        getEffortTransport(apiStyle),
        {
          levels: ['default', 'none', 'low', 'medium', 'high'],
          note: 'Gemini 2.5 Flash 支持关闭与轻度、中、高；minimal 与 low 都映射 1024，因此只显示一档'
        }
      )
    }
    // Gemini 3.x 的精确档位与默认值继续由型号规则提供。
    return { transport: getEffortTransport(apiStyle) }
  }

  if (provider === 'xai') {
    if (/non[-_.]?reasoning/.test(model)) {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: '该 Grok 型号明确为 non-reasoning，不发送推理参数' }
      )
    }
    if (/grok-4[._-]20.*reasoning/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: '该 Grok 4.20 reasoning 型号固定推理，厂家不提供可调强度'
        }
      )
    }
    if (/grok-4[._-]20-multi-agent/.test(model)) {
      if (apiStyle !== 'responses') {
        return makeProviderMatch(
          { kind: 'unsupported' },
          { levels: NONE, note: 'Grok 4.20 Multi-Agent 的 effort 仅支持 Responses API' }
        )
      }
      return makeProviderMatch(
        { kind: 'nested_effort' },
        {
          levels: ['default', 'low', 'medium', 'high', 'xhigh'],
          optionLabels: {
            low: '4 个代理',
            medium: '4 个代理',
            high: '16 个代理',
            xhigh: '16 个代理'
          },
          optionHints: {
            low: 'reasoning.effort=low，运行 4 个代理',
            medium: 'reasoning.effort=medium，运行 4 个代理',
            high: 'reasoning.effort=high，运行 16 个代理',
            xhigh: 'reasoning.effort=xhigh，运行 16 个代理'
          },
          note: '该字段控制多代理数量，不代表单模型思考深度；low/medium 为 4 个代理，high/xhigh 为 16 个代理'
        }
      )
    }
    return { transport: getEffortTransport(apiStyle) }
  }

  if (provider === 'mistral') {
    if (apiStyle === 'responses') {
      return makeProviderMatch(
        { kind: 'unsupported' },
        { levels: NONE, note: 'Mistral 官方当前仅声明 Chat 推理强度，不支持 OpenAI Responses API' }
      )
    }
    if (/magistral/.test(model)) {
      return makeProviderMatch(
        { kind: 'fixed' },
        {
          levels: HIGH_ONLY,
          defaultEffort: 'high',
          mandatory: true,
          optionLabels: FIXED_LABELS,
          note: 'Magistral 固定生成思考轨迹，厂家不提供可调强度'
        }
      )
    }
    if (/mistral-(?:small-(?:latest|2603)|medium-3-5)/.test(model)) {
      return makeProviderMatch(
        getEffortTransport(apiStyle),
        {
          levels: ['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
          note: 'Mistral 支持关闭到极高；厂家未公开默认档，默认时保持省略'
        }
      )
    }
    return makeProviderMatch(
      { kind: 'unsupported' },
      { levels: NONE, note: '该 Mistral 型号未在官方可调 reasoning_effort 列表中' },
      true
    )
  }

  return null
}

function normalizeEffortId(value: unknown): ReasoningEffortId | null {
  const normalized = String(value ?? '').trim().toLowerCase() as ReasoningEffortId
  return KNOWN_EFFORTS.has(normalized) ? normalized : null
}

function normalizeCapabilityLevels(value: unknown): ReasoningEffortId[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,;|]+/g)
      : []
  const unique = new Set<ReasoningEffortId>()
  for (const candidate of values) {
    const effort = normalizeEffortId(candidate)
    if (effort && CAPABILITY_LEVEL_ORDER.includes(effort)) {
      unique.add(effort)
    }
  }
  return CAPABILITY_LEVEL_ORDER.filter((effort) => unique.has(effort))
}

/** 清洗从存储或渠道元数据得到的能力对象。 */
export function normalizeModelReasoningCapability(value: unknown): ModelReasoningCapability | null {
  if (
    !isRecord(value) ||
    (!Array.isArray(value.levels) && typeof value.levels !== 'string')
  ) {
    return null
  }
  let levels = normalizeCapabilityLevels(value.levels)
  const defaultEffort = normalizeEffortId(value.defaultEffort ?? value.default_effort)
  const mandatory = typeof value.mandatory === 'boolean' ? value.mandatory : undefined
  if (mandatory) {
    levels = levels.filter((level) => level !== 'none')
  } else if (defaultEffort === 'none' && !levels.includes('none')) {
    levels = ['none', ...levels]
  }
  const capability: ModelReasoningCapability = { levels }
  if (defaultEffort && defaultEffort !== 'default') {
    capability.defaultEffort = defaultEffort
  }
  if (mandatory !== undefined) {
    capability.mandatory = mandatory
  }
  return capability
}

export function getReasoningCapabilityKey(model: unknown): string {
  return String(model ?? '').trim().toLowerCase()
}

export function normalizeModelReasoningCapabilityMap(
  value: unknown,
  limit = 200
): ModelReasoningCapabilityMap {
  if (!isRecord(value)) {
    return {}
  }
  const result: ModelReasoningCapabilityMap = {}
  for (const [model, rawCapability] of Object.entries(value)) {
    const key = getReasoningCapabilityKey(model)
    const capability = normalizeModelReasoningCapability(rawCapability)
    if (!key || !capability) {
      continue
    }
    result[key] = capability
    if (Object.keys(result).length >= Math.max(1, limit)) {
      break
    }
  }
  return result
}

function getModelCandidates(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }
  if (!isRecord(payload)) {
    return []
  }
  if (Array.isArray(payload.data)) {
    return payload.data
  }
  return Array.isArray(payload.models) ? payload.models : []
}

function parseSupportedFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }
  if (isRecord(value) && typeof value.supported === 'boolean') {
    return value.supported
  }
  return null
}

function extractCapabilityFromEntry(entry: Record<string, unknown>): ModelReasoningCapability | null {
  const reasoning = isRecord(entry.reasoning) ? entry.reasoning : null
  if (reasoning && hasOwn(reasoning, 'supported_efforts')) {
    const rawLevels = reasoning.supported_efforts
    const levels = rawLevels === null
      ? CAPABILITY_LEVEL_ORDER.slice()
      : normalizeCapabilityLevels(rawLevels)
    const defaultEffort = normalizeEffortId(reasoning.default_effort)
      ?? (reasoning.default_enabled === false ? 'none' : null)
    return normalizeModelReasoningCapability({
      levels,
      defaultEffort,
      mandatory: typeof reasoning.mandatory === 'boolean' ? reasoning.mandatory : undefined
    })
  }

  const capabilities = isRecord(entry.capabilities) ? entry.capabilities : null
  const effort = capabilities && isRecord(capabilities.effort) ? capabilities.effort : null
  if (effort) {
    if (parseSupportedFlag(effort) === false) {
      return { levels: [] }
    }
    const explicitLevels = STRENGTH_ORDER.filter((level) => parseSupportedFlag(effort[level]) === true)
    if (explicitLevels.length || parseSupportedFlag(effort) === true) {
      return normalizeModelReasoningCapability({
        levels: explicitLevels,
        defaultEffort: effort.default_effort ?? effort.default,
        mandatory: effort.mandatory
      })
    }
  }

  const reasoningCapability = capabilities && isRecord(capabilities.reasoning)
    ? capabilities.reasoning
    : null
  const commonLevels = entry.supported_reasoning_efforts
    ?? entry.reasoning_efforts
    ?? reasoningCapability?.supported_efforts
    ?? reasoningCapability?.efforts
  if (Array.isArray(commonLevels) || typeof commonLevels === 'string') {
    return normalizeModelReasoningCapability({
      levels: commonLevels,
      defaultEffort: entry.default_reasoning_effort ?? reasoningCapability?.default_effort,
      mandatory: reasoningCapability?.mandatory
    })
  }

  return null
}

/**
 * 从 OpenRouter、Anthropic 以及常见兼容 `/models` 响应提取逐模型能力。
 * 仅采信显式元数据；普通 OpenAI `/models` 只有 ID 时由静态规则兜底。
 */
export function extractModelReasoningCapabilities(payload: unknown): ModelReasoningCapabilityMap {
  const result: ModelReasoningCapabilityMap = {}
  for (const candidate of getModelCandidates(payload)) {
    if (!isRecord(candidate)) {
      continue
    }
    const key = getReasoningCapabilityKey(candidate.id ?? candidate.name)
    const capability = extractCapabilityFromEntry(candidate)
    if (key && capability) {
      result[key] = capability
    }
  }
  return result
}

function createRuleProfile(rule: ReasoningRule): ModelReasoningProfile {
  return {
    supported: rule.levels.length > 1,
    levels: rule.levels.slice(),
    defaultEffort: rule.defaultEffort,
    mandatory: rule.mandatory,
    source: 'model_rule',
    note: rule.note,
    optionLabels: rule.optionLabels,
    optionHints: rule.optionHints,
    aliases: rule.aliases
  }
}

function createMetadataProfile(
  capability: ModelReasoningCapability,
  ruleProfile: ModelReasoningProfile | null
): ModelReasoningProfile {
  const declaredDefaultEffort = capability.defaultEffort ?? ruleProfile?.defaultEffort
  const defaultEffort = declaredDefaultEffort && capability.levels.includes(declaredDefaultEffort)
    ? declaredDefaultEffort
    : undefined
  // A capability list without a declared default does not imply its first
  // (lowest) effort is the provider default. Keep an explicit default option
  // so UI and runtime both preserve omission instead of silently sending low.
  const levels: ReasoningEffortId[] = !defaultEffort && capability.levels.length
    ? ['default', ...capability.levels]
    : capability.levels.slice()
  const labels = levels.map((level) => REASONING_EFFORT_LABELS[level]).join('、')
  const note = levels.length > 1
    ? `已从渠道模型元数据识别 ${levels.length} 档：${labels}`
    : levels.length === 1
      ? `渠道模型元数据表明该模型仅支持${labels}档`
      : '渠道模型元数据表明该模型不支持推理强度调节'
  return {
    levels,
    defaultEffort,
    mandatory: capability.mandatory ?? ruleProfile?.mandatory,
    supported: levels.length > 1,
    source: 'metadata',
    note,
    optionLabels: ruleProfile?.optionLabels,
    optionHints: ruleProfile?.optionHints,
    aliases: ruleProfile?.aliases
  }
}

function findRuleProfile(model: string): ModelReasoningProfile | null {
  for (const rule of REASONING_RULES) {
    if (rule.test.test(model)) {
      return createRuleProfile(rule)
    }
  }
  return null
}

export function getModelReasoningProfile(
  model: unknown,
  capability?: ModelReasoningCapability | null,
  context: ReasoningProviderContext = {}
): ModelReasoningProfile {
  const normalized = getReasoningCapabilityKey(model)
  const ruleProfile = normalized ? findRuleProfile(normalized) : null
  const providerMatch = normalized ? getProviderReasoningMatch(normalized, context) : null
  const normalizedCapability = normalizeModelReasoningCapability(capability)
  if (providerMatch?.profile && !(providerMatch.allowMetadataOverride && normalizedCapability)) {
    return providerMatch.profile
  }
  if (normalizedCapability) {
    return createMetadataProfile(
      normalizedCapability,
      providerMatch?.profile ?? ruleProfile
    )
  }
  return ruleProfile ?? { ...FALLBACK_PROFILE, levels: FALLBACK_PROFILE.levels.slice() }
}

/**
 * 获取最终请求协议。官方直连端点优先使用厂商字段；未知自定义网关仍按其
 * OpenAI-compatible API 类型发送，若拒绝则由 runtime 显式报错。
 */
export function getReasoningTransport(
  model: unknown,
  context: ReasoningProviderContext = {},
  capability?: ModelReasoningCapability | null
): ReasoningTransport {
  const providerMatch = getProviderReasoningMatch(model, context)
  const normalizedCapability = normalizeModelReasoningCapability(capability)
  if (providerMatch?.allowMetadataOverride && normalizedCapability) {
    return normalizedCapability.levels.length
      ? getEffortTransport(context.apiStyle)
      : { kind: 'unsupported' }
  }
  if (providerMatch) {
    return {
      ...providerMatch.transport,
      budgetByEffort: providerMatch.transport.budgetByEffort
        ? { ...providerMatch.transport.budgetByEffort }
        : undefined
    }
  }
  return getEffortTransport(context.apiStyle)
}

export interface ReasoningEffortOption {
  id: ReasoningEffortId
  label: string
  hint: string
}

export function getModelReasoningCapability(
  capabilities: unknown,
  model: unknown
): ModelReasoningCapability | null {
  const normalizedMap = normalizeModelReasoningCapabilityMap(capabilities)
  return normalizedMap[getReasoningCapabilityKey(model)] ?? null
}

/** UI 用：当前模型真正可选的档位（从弱到强）。 */
export function getReasoningEffortOptions(
  model: unknown,
  capability?: ModelReasoningCapability | null,
  context: ReasoningProviderContext = {}
): ReasoningEffortOption[] {
  const profile = getModelReasoningProfile(model, capability, context)
  const levels: ReasoningEffortId[] = profile.levels.length ? profile.levels : ['default']
  return levels.map((id) => ({
    id,
    label: profile.optionLabels?.[id] ?? REASONING_EFFORT_LABELS[id],
    hint: profile.optionHints?.[id] ?? REASONING_EFFORT_HINTS[id]
  }))
}

/**
 * 把存储值收敛到当前模型的合法 UI 档位。default 不改持久化语义，
 * 仅在界面上定位到模型默认档；模型切换不会偷偷覆写用户设置。
 */
export function resolveReasoningEffortForModel(
  model: unknown,
  value: unknown,
  capability?: ModelReasoningCapability | null,
  context: ReasoningProviderContext = {}
): ReasoningEffortId {
  const profile = getModelReasoningProfile(model, capability, context)
  const normalized = normalizeEffortId(value) ?? 'default'
  if (profile.levels.includes(normalized)) {
    return normalized
  }
  const aliased = profile.aliases?.[normalized]
  if (aliased && profile.levels.includes(aliased)) {
    return aliased
  }
  if (
    normalized === 'default' &&
    profile.defaultEffort &&
    profile.levels.includes(profile.defaultEffort)
  ) {
    return profile.defaultEffort
  }
  const requestedIndex = STRENGTH_ORDER.indexOf(normalized)
  if (requestedIndex >= 0) {
    const supportedStrengths = profile.levels.filter((level) => STRENGTH_ORDER.includes(level))
    const nearestLower = supportedStrengths
      .filter((level) => STRENGTH_ORDER.indexOf(level) <= requestedIndex)
      .at(-1)
    if (nearestLower) {
      return nearestLower
    }
    if (supportedStrengths[0]) {
      return supportedStrengths[0]
    }
  }
  return profile.levels[0] ?? 'default'
}
