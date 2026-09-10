import { AiRuntimeError, normalizeAiFolderDecision, validateKnownFolderId, type AiFolderCandidate } from './ai-runtime.js'

export const BOOKMARK_CLASSIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'confidence', 'existing_folders'],
  properties: {
    title: { type: 'string', maxLength: 80 },
    summary: { type: 'string', maxLength: 500 },
    content_type: { type: 'string', maxLength: 40 },
    topics: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string', maxLength: 40 }
    },
    tags: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string', maxLength: 24 }
    },
    aliases: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', maxLength: 40 }
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    existing_folders: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['folder_id', 'confidence'],
        properties: {
          folder_id: { type: 'string', maxLength: 80 },
          folder_path: { type: 'string', maxLength: 240 },
          reason: { type: 'string', maxLength: 180 },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        }
      }
    },
    new_folder: {
      type: 'object',
      additionalProperties: false,
      required: ['folder_path', 'confidence'],
      properties: {
        folder_path: { type: 'string', maxLength: 240 },
        reason: { type: 'string', maxLength: 180 },
        confidence: { type: 'number', minimum: 0, maximum: 1 }
      }
    }
  }
} as const

/** Validate IDs before filling display paths from the trusted local candidates. */
export function validateAiClassificationResult(payload: Record<string, any>, candidates: AiFolderCandidate[]): void {
  const seen = new Set<string>()
  for (const item of payload.existing_folders || []) {
    const folder = validateKnownFolderId(item?.folder_id, candidates)
    if (seen.has(folder.folderId)) throw new AiRuntimeError('schema', 'AI 返回了重复的文件夹建议。')
    seen.add(folder.folderId)
    item.folder_id = folder.folderId
    item.folder_path = folder.folderPath
  }
}

export interface AiPreparedBookmark {
  bookmark: { id: string }
  folderCandidates?: AiFolderCandidate[]
}

export function validateAiBatchResults(payload: Record<string, any>, preparedItems: AiPreparedBookmark[]): void {
  const expected = new Map(preparedItems.map((item) => [String(item.bookmark.id), item]))
  const seen = new Set<string>()
  for (const item of payload.items || []) {
    const id = String(item?.bookmark_id ?? '').trim()
    const prepared = expected.get(id)
    if (!prepared) throw new AiRuntimeError('schema', 'AI 返回了本批次之外的 bookmark_id：' + (id || '(empty)'))
    if (seen.has(id)) throw new AiRuntimeError('schema', 'AI 重复返回了 bookmark_id：' + id)
    seen.add(id)
    if (item.action === 'rename' && !String(item.suggested_title || '').trim()) {
      throw new AiRuntimeError('schema', 'AI 提议重命名，但未提供 suggested_title：' + id)
    }
    const decision = item.folder_decision
    if (!decision) continue
    if (decision.kind === 'existing') {
      const folder = validateKnownFolderId(decision.folder_id, prepared.folderCandidates || [])
      decision.folder_id = folder.folderId
      decision.folder_path = folder.folderPath
    } else if (decision.kind === 'new' && !normalizeAiFolderDecision(decision, []).folderPath) {
      throw new AiRuntimeError('schema', 'AI 返回了 new folder_decision，但缺少有效 folder_path。')
    }
  }
  const missing = Array.from(expected.keys()).filter((id) => !seen.has(id))
  if (missing.length) throw new AiRuntimeError('schema', 'AI 遗漏了 ' + missing.length + ' 条书签：' + missing.slice(0,5).join(', '))
}

/** Zero also represents unknown confidence and cannot authorize an automatic action. */
export function meetsAiConfidenceThreshold(value: unknown, minimum: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1 && value >= minimum
}
