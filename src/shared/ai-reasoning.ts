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
const KNOWN_EFFORTS = new Set<ReasoningEffortId>([
  'default',
  'none',
  ...STRENGTH_ORDER
])

/** 可持久化的单模型能力，由模型列表接口的元数据提取。 */
export interface ModelReasoningCapability {
  /** 实际可调的强度档位；不包含 default / none。 */
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
}

interface ReasoningRule {
  test: RegExp
  levels: ReasoningEffortId[]
  defaultEffort?: ReasoningEffortId
  mandatory?: boolean
  note: string
}

const NONE: ReasoningEffortId[] = []
const MINIMAL_TO_HIGH: ReasoningEffortId[] = ['minimal', 'low', 'medium', 'high']
const LOW_TO_HIGH: ReasoningEffortId[] = ['low', 'medium', 'high']
const LOW_TO_XHIGH: ReasoningEffortId[] = ['low', 'medium', 'high', 'xhigh']
const LOW_TO_MAX: ReasoningEffortId[] = ['low', 'medium', 'high', 'xhigh', 'max']
const LOW_MEDIUM_HIGH_MAX: ReasoningEffortId[] = ['low', 'medium', 'high', 'max']
const HIGH_ONLY: ReasoningEffortId[] = ['high']
const LOW_HIGH: ReasoningEffortId[] = ['low', 'high']

// 顺序敏感：具体型号必须排在系列规则之前。
const REASONING_RULES: ReasoningRule[] = [
  // 明确非推理 / 非文本模型。
  { test: /embedding|embed\b|whisper|dall-?e|tts|moderation|rerank|speech|voice/, levels: NONE, note: '非推理模型，无需强度设置' },
  { test: /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4(?![.\d])|gpt-3\.?5/, levels: NONE, note: 'GPT-4/3.5 系模型不支持推理强度' },
  { test: /moonshot-v1/, levels: NONE, note: '该模型不支持推理强度' },

  // OpenAI。none 是关闭推理，不计入“推理强度”滑块。
  { test: /gpt-5(?:\.0)?-pro|o[0-9]+-pro/, levels: HIGH_ONLY, defaultEffort: 'high', mandatory: true, note: '该 Pro 模型固定为高强度' },
  { test: /gpt-5\.(?:2|3|4|5)-pro/, levels: ['medium', 'high', 'xhigh'], defaultEffort: 'high', mandatory: true, note: '该 Pro 模型支持中、高、极高 3 档' },
  { test: /gpt-5\.6(?:[-._/]|$)/, levels: LOW_TO_MAX, defaultEffort: 'medium', note: 'GPT-5.6 支持轻度到最高共 5 档' },
  { test: /gpt-5\.(?:2|3|4|5)(?:[-._/]|$)/, levels: LOW_TO_XHIGH, defaultEffort: 'medium', note: '该 GPT-5 系模型支持轻度到极高共 4 档' },
  { test: /gpt-5\.1(?:[-._/]|$)/, levels: LOW_TO_HIGH, defaultEffort: 'none', note: 'GPT-5.1 支持轻度、中、高 3 档；默认不额外推理' },
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
  { test: /gemini-3\.1-flash-lite-image/, levels: ['minimal', 'high'], defaultEffort: 'high', note: '该 Gemini 模型支持极简、高 2 档' },
  { test: /gemini-3(?:\.5)?-flash/, levels: MINIMAL_TO_HIGH, defaultEffort: 'high', note: '该 Gemini Flash 模型支持极简到高共 4 档' },
  { test: /gemini-3-pro/, levels: LOW_HIGH, defaultEffort: 'high', note: 'Gemini 3 Pro 支持轻度、高 2 档' },
  { test: /gemini-2\.5-(?:pro|flash|flash-lite)/, levels: LOW_TO_HIGH, defaultEffort: 'high', note: 'Gemini 2.5 支持轻度、中、高 3 档' },
  { test: /gemini/, levels: NONE, note: '该 Gemini 版本不支持推理强度' },

  // 其他兼容模型。
  { test: /deepseek-(?:v4|reasoner|r1)/, levels: LOW_TO_HIGH, defaultEffort: 'high', note: 'DeepSeek 推理模型；部分渠道会把较低档收敛为高档' },
  { test: /deepseek/, levels: NONE, note: '该 DeepSeek 对话模型不支持推理强度' },
  { test: /grok-4\.[0-9]|grok-4-(?:latest|fast)/, levels: LOW_TO_HIGH, defaultEffort: 'medium', note: '该 Grok 推理模型支持轻度、中、高 3 档' },
  { test: /grok-3-mini/, levels: LOW_HIGH, defaultEffort: 'low', note: 'Grok 3 mini 仅支持轻度、高 2 档' },
  { test: /grok/, levels: NONE, note: '该 Grok 模型不支持推理强度' },
  { test: /glm-5\.2/, levels: LOW_TO_HIGH, defaultEffort: 'medium', note: 'GLM-5.2 支持轻度、中、高 3 档' },
  { test: /glm/, levels: NONE, note: '该 GLM 版本使用思考开关而非强度' },
  { test: /qwen|qwq/, levels: NONE, note: '该模型使用思考预算或开关，而非推理强度' },
  { test: /minimax|abab/, levels: NONE, note: '该模型使用思考开关，而非推理强度' },
  { test: /kimi|moonshot/, levels: NONE, note: '该模型使用思考开关，而非推理强度' }
]

const FALLBACK_PROFILE: ModelReasoningProfile = {
  supported: true,
  levels: ['default', 'low', 'medium', 'high'],
  source: 'fallback',
  note: '渠道未公开该模型的档位，暂用默认、轻度、中、高；不兼容时会自动回退'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function normalizeEffortId(value: unknown): ReasoningEffortId | null {
  const normalized = String(value ?? '').trim().toLowerCase() as ReasoningEffortId
  return KNOWN_EFFORTS.has(normalized) ? normalized : null
}

function normalizeStrengthLevels(value: unknown): ReasoningEffortId[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\s,;|]+/g)
      : []
  const unique = new Set<ReasoningEffortId>()
  for (const candidate of values) {
    const effort = normalizeEffortId(candidate)
    if (effort && STRENGTH_ORDER.includes(effort)) {
      unique.add(effort)
    }
  }
  return STRENGTH_ORDER.filter((effort) => unique.has(effort))
}

/** 清洗从存储或渠道元数据得到的能力对象。 */
export function normalizeModelReasoningCapability(value: unknown): ModelReasoningCapability | null {
  if (
    !isRecord(value) ||
    (!Array.isArray(value.levels) && typeof value.levels !== 'string')
  ) {
    return null
  }
  const levels = normalizeStrengthLevels(value.levels)
  const defaultEffort = normalizeEffortId(value.defaultEffort ?? value.default_effort)
  const capability: ModelReasoningCapability = { levels }
  if (defaultEffort && defaultEffort !== 'default') {
    capability.defaultEffort = defaultEffort
  }
  if (typeof value.mandatory === 'boolean') {
    capability.mandatory = value.mandatory
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
    const levels = rawLevels === null ? STRENGTH_ORDER.slice() : normalizeStrengthLevels(rawLevels)
    const defaultEffort = normalizeEffortId(reasoning.default_effort)
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
    note: rule.note
  }
}

function createMetadataProfile(
  capability: ModelReasoningCapability,
  ruleProfile: ModelReasoningProfile | null
): ModelReasoningProfile {
  const levels = capability.levels.slice()
  const defaultEffort = capability.defaultEffort ?? ruleProfile?.defaultEffort
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
    note
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
  capability?: ModelReasoningCapability | null
): ModelReasoningProfile {
  const normalized = getReasoningCapabilityKey(model)
  const ruleProfile = normalized ? findRuleProfile(normalized) : null
  const normalizedCapability = normalizeModelReasoningCapability(capability)
  if (normalizedCapability) {
    return createMetadataProfile(normalizedCapability, ruleProfile)
  }
  return ruleProfile ?? { ...FALLBACK_PROFILE, levels: FALLBACK_PROFILE.levels.slice() }
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
  capability?: ModelReasoningCapability | null
): ReasoningEffortOption[] {
  const profile = getModelReasoningProfile(model, capability)
  const levels: ReasoningEffortId[] = profile.levels.length ? profile.levels : ['default']
  return levels.map((id) => ({
    id,
    label: REASONING_EFFORT_LABELS[id],
    hint: REASONING_EFFORT_HINTS[id]
  }))
}

/**
 * 把存储值收敛到当前模型的合法 UI 档位。default 不改持久化语义，
 * 仅在界面上定位到模型默认档；模型切换不会偷偷覆写用户设置。
 */
export function resolveReasoningEffortForModel(
  model: unknown,
  value: unknown,
  capability?: ModelReasoningCapability | null
): ReasoningEffortId {
  const profile = getModelReasoningProfile(model, capability)
  const normalized = normalizeEffortId(value) ?? 'default'
  if (profile.levels.includes(normalized)) {
    return normalized
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
