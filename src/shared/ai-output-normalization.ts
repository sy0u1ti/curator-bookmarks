import type { JsonSchema, JsonSchemaType } from './ai-runtime.js'

export interface AiOutputNormalization {
  data: unknown
  warnings: string[]
}

const MAX_NORMALIZATION_NODES = 25000
const MAX_NORMALIZATION_WARNINGS = 24
const OMIT = Symbol('optional-null')
const canonicalKey = (key: string) => key.replace(/[_\-\s]/g, '').toLowerCase()

/** Recover representation differences, never invent identifiers or decisions.
 * Confidence is advisory: unknown/out-of-range confidence becomes 0, so it
 * cannot authorize automatic bookmark mutations or high-confidence selection.
 */
export function normalizeAiOutput(value: unknown, schema: JsonSchema): AiOutputNormalization {
  const warnings: string[] = []
  let visited = 0
  const warn = (path: string, reason: string) => {
    if (warnings.length < MAX_NORMALIZATION_WARNINGS) warnings.push(`${path}: ${reason}`)
  }

  const visit = (input: unknown, node: JsonSchema, path: string, field = '', optional = false): unknown => {
    if (++visited > MAX_NORMALIZATION_NODES) throw new Error('AI 输出结构过大，请减小批量大小后重试。')
    const types: readonly JsonSchemaType[] = Array.isArray(node.type) ? node.type : node.type ? [node.type as JsonSchemaType] : []

    if (field === 'confidence' && types.includes('number') && node.minimum === 0 && node.maximum === 1) {
      let confidence: unknown = input
      if (typeof confidence === 'string') {
        const text = confidence.trim()
        confidence = /^\d+(?:\.\d+)?\s*%$/.test(text)
          ? Number(text.replace('%', '').trim()) / 100
          : text !== '' && /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : NaN
      }
      if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        warn(path, '未提供有效置信度，按 0 处理')
        return 0
      }
      if (confidence !== input) warn(path, '已规范置信度格式')
      return confidence
    }

    if (input === null && optional && !types.includes('null') && types.length) return OMIT

    if (typeof input === 'string') {
      const text = input.trim()
      if ((types.includes('number') || types.includes('integer')) && text && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
        const number = Number(text)
        if (Number.isFinite(number) && (!types.includes('integer') || Number.isSafeInteger(number))) {
          warn(path, '数字字符串已转换')
          return number
        }
      }
      if (types.includes('boolean') && /^(true|false)$/i.test(text)) {
        warn(path, '布尔字符串已转换')
        return text.toLowerCase() === 'true'
      }
      if (node.enum && !node.enum.includes(input)) {
        const matches = node.enum.filter((item) => typeof item === 'string' && canonicalKey(item) === canonicalKey(text))
        if (matches.length === 1) {
          warn(path, '枚举拼写已规范')
          return matches[0]
        }
      }
    }
    if (types.includes('string') && typeof input === 'number' && Number.isSafeInteger(input)) {
      warn(path, '整数标识已转换为字符串')
      return String(input)
    }

    if (Array.isArray(input) && node.items) {
      if (node.maxItems !== undefined && input.length > node.maxItems) return input
      return input.map((item, index) => visit(item, node.items!, `${path}[${index}]`))
    }
    if (!input || typeof input !== 'object' || Array.isArray(input) || !node.properties) return input

    const source = input as Record<string, unknown>
    const required = new Set(node.required || [])
    const aliases = new Map<string, string[]>()
    const sourceKeys = Object.keys(source)
    if (sourceKeys.length + visited > MAX_NORMALIZATION_NODES) throw new Error('AI 输出字段过多，请减小批量大小后重试。')
    for (const key of sourceKeys) {
      const normalized = canonicalKey(key)
      const matches = aliases.get(normalized)
      if (matches) matches.push(key)
      else aliases.set(normalized, [key])
    }
    const used = new Set<string>()
    const entries: Array<[string, unknown]> = []
    for (const [key, property] of Object.entries(node.properties)) {
      const matches = aliases.get(canonicalKey(key)) || []
      const sourceKey = Object.hasOwn(source, key) ? key : matches.length === 1 ? matches[0] : undefined
      if (sourceKey !== undefined) used.add(sourceKey)
      const confidence = key === 'confidence' && property.minimum === 0 && property.maximum === 1 && property.type === 'number'
      if (sourceKey === undefined && !confidence) continue
      if (sourceKey !== undefined && sourceKey !== key) warn(`${path}.${key}`, '字段命名已规范')
      const normalized = visit(sourceKey === undefined ? undefined : source[sourceKey], property, `${path}.${key}`, key, !required.has(key))
      if (normalized !== OMIT) entries.push([key, normalized])
    }
    for (const key of sourceKeys) {
      if (used.has(key)) continue
      if (node.additionalProperties === false) {
        warn(path, '已忽略未声明的辅助字段')
      } else {
        const extra = node.additionalProperties && typeof node.additionalProperties === 'object'
          ? visit(source[key], node.additionalProperties, `${path}.*`) : source[key]
        entries.push([key, extra])
      }
    }
    // Unlike assignment to {}, this does not invoke the __proto__ setter.
    return Object.fromEntries(entries)
  }

  return { data: visit(value, schema, '$'), warnings }
}
