export function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripCommonUrlPrefix(value: unknown): string {
  return String(value || '').replace(/^\s*(https?:\/\/)?(www\.)?/i, '')
}

export function normalizeUrl(url: unknown): string {
  return normalizeText(stripCommonUrlPrefix(url))
}

export function normalizeSearchTextCompact(value: unknown): string {
  return normalizeText(stripCommonUrlPrefix(value))
    .replace(/[^a-z0-9\u3400-\u9fff+#]+/gi, '')
    .trim()
}

export function displayUrl(url: unknown): string {
  return String(url || '')
    .replace(/^(https?:\/\/)?(www\.)?/i, '')
    .replace(/\/$/, '')
}

export function extractDomain(url: unknown): string {
  try {
    return new URL(String(url || ''))
      .hostname.replace(/^www\./i, '')
      .toLowerCase()
  } catch {
    return ''
  }
}

export function buildDuplicateKey(url: unknown): string {
  try {
    const parsedUrl = new URL(String(url || ''))
    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/'
    return `${parsedUrl.hostname.replace(/^www\./i, '').toLowerCase()}${pathname}${parsedUrl.search}`.toLowerCase()
  } catch {
    return normalizeText(String(url || '').replace(/#.*$/, '').replace(/\/+$/, ''))
  }
}

const DISPLAY_TEXT_PROTECTED_PATTERNS = [
  /`[^`]*`/g,
  /\b(?:site|domain|url):[A-Za-z0-9+.#/_:-]+/gi,
  /\b(?:folder|path|type|kind):[A-Za-z0-9+.#/_-]+/gi,
  /\b(?:folder|path|type|kind):/gi,
  /\b(?:Cmd|Ctrl|Control|Alt|Shift|Enter|Esc|Escape|Tab|Space|Backspace|Delete|Meta|Option)(?:\s*(?:[+/]|or)\s*(?:Cmd|Ctrl|Control|Alt|Shift|Enter|Esc|Escape|Tab|Space|Backspace|Delete|Meta|Option|[A-Z0-9]))+\b/gi,
  /\b(?:https?:\/\/|chrome:\/\/|file:\/\/|mailto:|www\.)[A-Za-z0-9._~:/?#[\]@!$&()*+;=%-]*(?:[\u3400-\u9fff]+[A-Za-z0-9._~:/?#[\]@!$&()*+;=%-]*)*/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<>"'“”‘’]*)?/gi,
  /#[A-Za-z][\w:-]*/g
]

const CJK_RANGE = '\u3400-\u9fff'
const DISPLAY_TEXT_PLACEHOLDER_RANGE = '\ue000-\uf8ff'
const CJK_PATTERN = new RegExp(`[${CJK_RANGE}]`)
const CJK_BEFORE_ASCII_PATTERN = new RegExp(`([${CJK_RANGE}])(?=([A-Za-z0-9]))`, 'g')
const ASCII_BEFORE_CJK_PATTERN = new RegExp(`([A-Za-z0-9])(?=([${CJK_RANGE}]))`, 'g')
const DISPLAY_TEXT_PLACEHOLDER_PATTERN = /[\ue000-\uf8ff]/
const CJK_BEFORE_PROTECTED_PATTERN = new RegExp(`([${CJK_RANGE}])(?=([${DISPLAY_TEXT_PLACEHOLDER_RANGE}]))`, 'g')
const PROTECTED_BEFORE_CJK_PATTERN = new RegExp(`([${DISPLAY_TEXT_PLACEHOLDER_RANGE}])(?=([${CJK_RANGE}]))`, 'g')
const PROTECTED_BEFORE_ASCII_PATTERN = new RegExp(`([${DISPLAY_TEXT_PLACEHOLDER_RANGE}])(?=([A-Za-z0-9]))`, 'g')
const ASCII_BEFORE_PROTECTED_PATTERN = new RegExp(`([A-Za-z0-9])(?=([${DISPLAY_TEXT_PLACEHOLDER_RANGE}]))`, 'g')

export function formatDisplayText(value: unknown): string {
  const source = String(value || '')
  if (!source) {
    return ''
  }

  const protectedParts: string[] = []
  const protectedText = protectDisplayTextSegments(source, protectedParts)
  const formatted = formatDisplayTextSegment(protectedText)
  return normalizeRestoredDisplayText(restoreDisplayTextSegments(formatted, protectedParts))
}

function protectDisplayTextSegments(source: string, protectedParts: string[]): string {
  let protectedText = source

  for (const pattern of DISPLAY_TEXT_PROTECTED_PATTERNS) {
    protectedText = protectedText.replace(pattern, (match) => {
      const placeholderIndex = match.search(DISPLAY_TEXT_PLACEHOLDER_PATTERN)
      if (placeholderIndex === 0) {
        return match
      }
      if (placeholderIndex > 0) {
        const protectedMatch = match.slice(0, placeholderIndex)
        const suffix = match.slice(placeholderIndex)
        const index = protectedParts.push(protectedMatch) - 1
        return `${String.fromCharCode(0xe000 + index)}${suffix}`
      }

      const index = protectedParts.push(match) - 1
      return String.fromCharCode(0xe000 + index)
    })
  }

  return protectedText
}

function restoreDisplayTextSegments(source: string, protectedParts: string[]): string {
  return source.replace(/[\ue000-\uf8ff]/g, (placeholder) => {
    const index = placeholder.charCodeAt(0) - 0xe000
    return protectedParts[index] || placeholder
  })
}

function formatDisplayTextSegment(value: string): string {
  return value
    .replace(/\.{3}/g, '…')
    .replace(/([A-Za-z])\s*\/\s*([A-Za-z])/g, '$1/$2')
    .replace(CJK_BEFORE_ASCII_PATTERN, '$1 ')
    .replace(ASCII_BEFORE_CJK_PATTERN, '$1 ')
    .replace(CJK_BEFORE_PROTECTED_PATTERN, '$1 ')
    .replace(PROTECTED_BEFORE_CJK_PATTERN, '$1 ')
    .replace(PROTECTED_BEFORE_ASCII_PATTERN, '$1 ')
    .replace(ASCII_BEFORE_PROTECTED_PATTERN, '$1 ')
    .replace(new RegExp(`([${CJK_RANGE}]),`, 'g'), '$1，')
    .replace(new RegExp(`,([${CJK_RANGE}])`, 'g'), '，$1')
    .replace(new RegExp(`([${CJK_RANGE}])\\.`, 'g'), '$1。')
    .replace(new RegExp(`\\.([${CJK_RANGE}])`, 'g'), '。$1')
    .replace(new RegExp(`([${CJK_RANGE}])!`, 'g'), '$1！')
    .replace(new RegExp(`!([${CJK_RANGE}])`, 'g'), '！$1')
    .replace(new RegExp(`([${CJK_RANGE}])\\?`, 'g'), '$1？')
    .replace(new RegExp(`\\?([${CJK_RANGE}])`, 'g'), '？$1')
    .replace(new RegExp(`([${CJK_RANGE}]);`, 'g'), '$1；')
    .replace(new RegExp(`;([${CJK_RANGE}])`, 'g'), '；$1')
    .replace(new RegExp(`([${CJK_RANGE}]):`, 'g'), '$1：')
    .replace(new RegExp(`:([${CJK_RANGE}])`, 'g'), '：$1')
    .replace(new RegExp(`([${CJK_RANGE}])\\(`, 'g'), '$1（')
    .replace(new RegExp(`\\)([${CJK_RANGE}])`, 'g'), '）$1')
    .replace(/\s+([，。！？；：、）])/g, '$1')
    .replace(/（\s+/g, '（')
    .replace(/\s+）/g, '）')
    .replace(/\s{2,}/g, ' ')
    .replace(new RegExp(`([${CJK_RANGE}]) ([，。！？；：、）])`, 'g'), '$1$2')
    .replace(new RegExp(`([（]) ([${CJK_RANGE}])`, 'g'), '$1$2')
    .trim()
}

function normalizeRestoredDisplayText(value: string): string {
  return value.replace(/\b(folder|path|type|kind):\s+([\u3400-\u9fff])/gi, '$1:$2')
}

export function containsCjkText(value: unknown): boolean {
  return CJK_PATTERN.test(String(value || ''))
}
