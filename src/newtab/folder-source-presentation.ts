export function getFolderSourceSecondaryPath(title: string, path: string): string {
  const normalizedPath = path.trim()
  return normalizedPath === title.trim() ? '' : normalizedPath
}
