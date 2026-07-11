/**
 * 模型推理强度适配表：从 model id 推断该模型支持哪些「推理强度」档位，
 * 用于让 UI 选择器随模型联动、对非推理模型自动禁用。
 *
 * 运行时只发送标准 reasoning_effort（chat）/ reasoning.effort（responses），
 * 靠 400 自动降级兜底不支持的情况；本表是 UI 提示层，不必 100% 精确。
 * 依据 2026-07 各家官方文档调研（OpenAI/Gemini/DeepSeek/Grok/GLM 等）。
 */

export type ReasoningEffortId = 'default' | 'minimal' | 'low' | 'medium' | 'high'

export const REASONING_EFFORT_LABELS: Record<ReasoningEffortId, string> = {
  default: '默认',
  minimal: '极简',
  low: '低',
  medium: '中',
  high: '高'
}

export const REASONING_EFFORT_HINTS: Record<ReasoningEffortId, string> = {
  default: '不发送推理参数，由模型自行决定（兼容所有模型）',
  minimal: '几乎不额外推理，最快最省',
  low: '少量推理，速度优先',
  medium: '推理与速度平衡',
  high: '充分推理，质量优先'
}

export interface ModelReasoningProfile {
  /** 是否支持推理强度调节（levels 是否多于「默认」一档）。 */
  supported: boolean
  /** 可选档位，含 'default'，从弱到强。 */
  levels: ReasoningEffortId[]
  /** 面向用户的一句说明。 */
  note: string
}

const NONE: ReasoningEffortId[] = ['default']
const TRIPLE: ReasoningEffortId[] = ['default', 'low', 'medium', 'high']
const QUAD: ReasoningEffortId[] = ['default', 'minimal', 'low', 'medium', 'high']
const HIGH_ONLY: ReasoningEffortId[] = ['default', 'high']
const LOW_HIGH: ReasoningEffortId[] = ['default', 'low', 'high']

interface ReasoningRule {
  test: RegExp
  levels: ReasoningEffortId[]
  note: string
}

// 顺序敏感：从具体到一般，首个命中即返回。
const REASONING_RULES: ReasoningRule[] = [
  // 明确非推理 / 非文本模型
  { test: /embedding|embed\b|whisper|dall-?e|tts|moderation|rerank|speech|voice/, levels: NONE, note: '非推理模型，无需强度设置' },
  { test: /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4(?![.\d])|gpt-3\.?5|chatgpt/, levels: NONE, note: 'GPT-4/3.5 系非推理模型' },
  { test: /moonshot-v1/, levels: NONE, note: '该模型不支持思考强度' },

  // OpenAI 推理系（先 Pro，再小数版本，再基础版，最后 o 系）
  { test: /gpt-5[.\d]*-pro|o[0-9]+-pro/, levels: HIGH_ONLY, note: 'Pro 模型仅支持高强度' },
  { test: /gpt-5\.[1-9]/, levels: TRIPLE, note: 'GPT-5.1+ 支持低/中/高（已移除极简档）' },
  { test: /gpt-5/, levels: QUAD, note: 'GPT-5 系支持极简/低/中/高' },
  { test: /(?:^|\/)o[1-9](?:[.\-]|$)|(?:^|\/)o[1-9]-(?:mini|preview|pro)/, levels: TRIPLE, note: 'OpenAI o 系推理模型' },

  // Google Gemini（OpenAI 兼容层把 reasoning_effort 作为一等公民）
  { test: /gemini-(?:2\.5|3)/, levels: QUAD, note: 'Gemini 思考模型' },
  { test: /gemini/, levels: NONE, note: '旧版 Gemini 不支持思考强度' },

  // DeepSeek（V4 混合模型；低/中档会被收敛为高档但不报错）
  { test: /deepseek-(?:v4|reasoner|r1)/, levels: TRIPLE, note: 'DeepSeek 会把低/中档收敛为高档' },
  { test: /deepseek/, levels: NONE, note: 'DeepSeek 对话模型不支持思考强度' },

  // xAI Grok
  { test: /grok-4\.[0-9]|grok-4-(?:latest|fast)/, levels: TRIPLE, note: 'Grok 4.3+ 推理模型' },
  { test: /grok-3-mini/, levels: LOW_HIGH, note: 'Grok 3 mini 仅低/高两档' },
  { test: /grok-4(?![.\d])/, levels: NONE, note: '旧版 Grok 4 不支持思考强度参数' },
  { test: /grok/, levels: NONE, note: '该 Grok 模型不支持思考强度' },

  // 智谱 GLM
  { test: /glm-5\.2/, levels: TRIPLE, note: 'GLM-5.2 支持推理强度' },
  { test: /glm/, levels: NONE, note: '该 GLM 版本用思考开关而非强度（可用高级 JSON 覆盖）' },

  // 无「强度」概念，用思考开关 / 预算：Qwen、MiniMax、Kimi
  { test: /qwen|qwq/, levels: NONE, note: 'Qwen 用思考预算而非强度（可用高级 JSON 覆盖）' },
  { test: /minimax|abab/, levels: NONE, note: '该模型用思考开关而非强度' },
  { test: /kimi|moonshot/, levels: NONE, note: '该模型用思考开关而非强度' },

  // Claude：经 OpenRouter 生效，直连兼容层会忽略（无害）
  { test: /claude|anthropic/, levels: TRIPLE, note: 'Claude 经 OpenRouter 生效；直连兼容层会忽略此设置' }
]

const FALLBACK_PROFILE: ModelReasoningProfile = {
  supported: true,
  levels: TRIPLE,
  note: '未知模型，将尝试标准推理强度参数，不支持会自动回退'
}

export function getModelReasoningProfile(model: unknown): ModelReasoningProfile {
  const normalized = String(model ?? '').trim().toLowerCase()
  if (!normalized) {
    return { ...FALLBACK_PROFILE }
  }
  for (const rule of REASONING_RULES) {
    if (rule.test.test(normalized)) {
      return {
        supported: rule.levels.length > 1,
        levels: rule.levels,
        note: rule.note
      }
    }
  }
  return { ...FALLBACK_PROFILE }
}

export interface ReasoningEffortOption {
  id: ReasoningEffortId
  label: string
  hint: string
}

/** UI 用：某模型的可选档位（含 label/hint）。 */
export function getReasoningEffortOptions(model: unknown): ReasoningEffortOption[] {
  return getModelReasoningProfile(model).levels.map((id) => ({
    id,
    label: REASONING_EFFORT_LABELS[id],
    hint: REASONING_EFFORT_HINTS[id]
  }))
}

/**
 * 把存储的强度值收敛到某模型的合法档位：不支持时回落 'default'。
 * 用于模型切换后 UI 显示，不改动持久化值。
 */
export function resolveReasoningEffortForModel(model: unknown, value: unknown): ReasoningEffortId {
  const profile = getModelReasoningProfile(model)
  const normalized = String(value ?? 'default').trim().toLowerCase() as ReasoningEffortId
  return profile.levels.includes(normalized) ? normalized : 'default'
}
