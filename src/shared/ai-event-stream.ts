/** Some compatible gateways return SSE despite a non-streaming request. Parse only
 * final text/data; do not execute tool calls or expose reasoning as UI events. */
export class AiEventStreamError extends Error {
  constructor(message: string) { super(message); this.name = 'AiEventStreamError' }
}

export function parseAiEventStream(rawBody: string): unknown | null {
  if (!/^(?:data|event):/m.test(rawBody)) return null
  const frames = rawBody.replace(/\r\n?/g, '\n').split(/\n\n+/)
  if (frames.length > 25000) throw new AiEventStreamError('AI 事件流过长，已停止解析。')
  let kind = ''
  let complete = false
  let finishReason: unknown
  let finalPayload: unknown = null
  const text: string[] = []
  const reasoning: string[] = []
  const refusal: string[] = []
  const tools = new Map<number, { name: string; arguments: string }>()
  const anthropicBlocks = new Map<number, Record<string, any>>()
  for (const frame of frames) {
    const dataLines: string[] = []
    let event = ''
    for (const line of frame.split('\n')) {
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      else if (line.startsWith('event:')) event = line.slice(6).trim()
    }
    const data = dataLines.join('\n').trim()
    if (!data) continue
    if (data === '[DONE]') { complete = true; continue }
    let payload: Record<string, any>
    try { payload = JSON.parse(data) } catch { throw new AiEventStreamError('AI 事件流内容不完整或格式无效。') }
    if (!payload || typeof payload !== 'object') continue
    event = event || String(payload.type || '')
    if (payload.error || event === 'error' || event === 'response.failed') {
      return payload.response || (payload.error ? payload : { error: { message: payload.message || 'AI 事件流返回错误。', code: payload.code } })
    }
    if (event === 'response.completed' || event === 'response.incomplete') {
      if (payload.response) finalPayload = payload.response
      complete = true
      kind = 'responses'
    } else if (event === 'response.output_text.delta') {
      kind = 'responses'
      if (typeof payload.delta === 'string') text.push(payload.delta)
    } else if (event === 'response.refusal.delta') {
      kind = 'responses'
      if (typeof payload.delta === 'string') refusal.push(payload.delta)
    } else if (Array.isArray(payload.choices)) {
      kind = 'chat'
      const choice = payload.choices.find((item: any) => !item.index) || payload.choices[0]
      if (!choice) continue
      const delta = choice.delta || choice.message || {}
      if (typeof delta.content === 'string') text.push(delta.content)
      else if (Array.isArray(delta.content)) {
        for (const block of delta.content) if ((!block.type || block.type === 'text') && typeof block.text === 'string') text.push(block.text)
      }
      if (typeof delta.reasoning_content === 'string') reasoning.push(delta.reasoning_content)
      if (typeof delta.refusal === 'string') refusal.push(delta.refusal)
      for (const call of delta.tool_calls || (delta.function_call ? [{ index: 0, function: delta.function_call }] : [])) {
        const index = Number(call.index) || 0
        const tool = tools.get(index) || { name: '', arguments: '' }
        if (typeof call.function?.name === 'string') tool.name += call.function.name
        if (typeof call.function?.arguments === 'string') tool.arguments += call.function.arguments
        tools.set(index, tool)
      }
      if (choice.finish_reason) { finishReason = choice.finish_reason; complete = true }
    } else if (event === 'message_start') {
      kind = 'anthropic'
      for (const [index, block] of (payload.message?.content || []).entries()) anthropicBlocks.set(index, { ...block })
    } else if (event === 'content_block_start') {
      kind = 'anthropic'
      anthropicBlocks.set(Number(payload.index) || 0, { ...payload.content_block })
    } else if (event === 'content_block_delta') {
      kind = 'anthropic'
      const index = Number(payload.index) || 0
      const block = anthropicBlocks.get(index) || { type: 'text', text: '' }
      if (payload.delta?.type === 'text_delta') block.text = String(block.text || '') + String(payload.delta.text || '')
      if (payload.delta?.type === 'input_json_delta') block.partialJson = String(block.partialJson || '') + String(payload.delta.partial_json || '')
      anthropicBlocks.set(index, block)
    } else if (event === 'message_delta') {
      kind = 'anthropic'
      finishReason = payload.delta?.stop_reason || finishReason
    } else if (event === 'message_stop') {
      kind = 'anthropic'
      complete = true
    } else if (Array.isArray(payload.candidates) || payload.promptFeedback) {
      kind = 'gemini'
      if (payload.promptFeedback?.blockReason) return payload
      const candidate = payload.candidates?.[0]
      for (const part of candidate?.content?.parts || []) if (!part.thought && typeof part.text === 'string') text.push(part.text)
      if (candidate?.finishReason) { finishReason = candidate.finishReason; complete = true }
    }
  }
  if (finalPayload) return finalPayload
  if (!complete) throw new AiEventStreamError('AI 事件流意外中断，未收到完成标记。')
  if (kind === 'chat') return { choices: [{ finish_reason: finishReason, message: {
    content: text.join(''), reasoning_content: reasoning.join(''), refusal: refusal.join(''),
    tool_calls: Array.from(tools.values(), (tool) => ({ type: 'function', function: tool }))
  } }] }
  if (kind === 'responses') return { output_text: text.join(''), output: refusal.length
    ? [{ type: 'message', content: [{ type: 'refusal', refusal: refusal.join('') }] }] : [] }
  if (kind === 'anthropic') return { stop_reason: finishReason, content: Array.from(anthropicBlocks.values(), (block) => {
    if (!block.partialJson) return block
    try { return { ...block, input: JSON.parse(block.partialJson) } } catch { throw new AiEventStreamError('AI 工具参数事件流不完整。') }
  }) }
  if (kind === 'gemini') return { candidates: [{ finishReason, content: { parts: [{ text: text.join('') }] } }] }
  return null
}
