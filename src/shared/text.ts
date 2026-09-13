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
  const rawUrl = String(url ?? '').trim()
  try {
    // Cleanup and quick-save reuse need URL identity, not search normalization.
    // Paths, ports, query values, trailing slashes and fragment routes can all
    // identify different resources. URL only normalizes protocol/host casing,
    // default ports and other equivalences defined by the URL standard.
    return new URL(rawUrl).href
  } catch {
    return rawUrl
  }
}

