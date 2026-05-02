export function normalizeBookmarkSaveUrl(url: unknown): string {
  try {
    const parsedUrl = new URL(String(url || '').trim())
    parsedUrl.hash = ''
    return parsedUrl.toString()
  } catch {
    return String(url || '').trim()
  }
}

export function shouldReuseBookmarkForSave(
  existingUrl: unknown,
  requestedUrl: unknown
): boolean {
  const normalizedExistingUrl = normalizeBookmarkSaveUrl(existingUrl)
  return Boolean(
    normalizedExistingUrl &&
      normalizedExistingUrl === normalizeBookmarkSaveUrl(requestedUrl)
  )
}
