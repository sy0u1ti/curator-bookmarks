/** Respect the search provider chosen in Chrome, including after it changes. */
export async function searchWithBrowserDefault(text: string, openInNewTab = false): Promise<void> {
  const query = String(text || '').trim()
  if (!query) return

  await chrome.search.query({
    text: query,
    disposition: openInNewTab ? 'NEW_TAB' : 'CURRENT_TAB'
  })
}
