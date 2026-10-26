import { buildDuplicateKey } from '../text.js'

/** Missing legacy URLs are tolerated; a known different page is never active content. */
export function isSearchContentForBookmark(bookmark: { url: string }, content: { url?: string } | null | undefined): boolean {
  return Boolean(content && (!content.url || buildDuplicateKey(content.url) === buildDuplicateKey(bookmark.url)))
}
