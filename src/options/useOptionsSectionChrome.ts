import { useCallback, useEffect, useMemo, useState } from 'react'
import { SECTION_META } from './shared-options/constants.js'
import {
  isOptionsDashboardEmbedMode,
  navigateToOptionsSectionHash,
  readOptionsSectionAnchor,
  readOptionsSectionKey,
  subscribeToOptionsSectionChanges,
  type OptionsSectionKey
} from './options-section-store.js'

export function useOptionsSectionChrome({
  onSectionChange
}: {
  onSectionChange?: () => void
} = {}): {
  sectionKey: OptionsSectionKey
  sectionAnchor: string
  sectionRevision: number
  isDashboardActive: boolean
  isDashboardEmbed: boolean
  navigateToSectionHash: (hash: string) => void
} {
  const [sectionKey, setSectionKey] = useState(() => readOptionsSectionKey())
  const [sectionAnchor, setSectionAnchor] = useState(() => readOptionsSectionAnchor())
  const [sectionRevision, setSectionRevision] = useState(0)
  const isDashboardEmbed = useMemo(() => isOptionsDashboardEmbedMode(), [])

  useEffect(() => {
    const syncSection = () => {
      setSectionKey(readOptionsSectionKey())
      setSectionAnchor(readOptionsSectionAnchor())
      setSectionRevision((revision) => revision + 1)
      onSectionChange?.()
    }

    window.addEventListener('hashchange', syncSection)
    window.addEventListener('popstate', syncSection)
    const unsubscribeFromSectionChanges = subscribeToOptionsSectionChanges(syncSection)
    return () => {
      window.removeEventListener('hashchange', syncSection)
      window.removeEventListener('popstate', syncSection)
      unsubscribeFromSectionChanges()
    }
  }, [onSectionChange])

  useEffect(() => {
    document.title = `${SECTION_META[sectionKey].title} · Curator Bookmark`
  }, [sectionKey])

  const navigateToSectionHash = useCallback((hash: string) => {
    navigateToOptionsSectionHash(hash)
  }, [])

  return {
    sectionKey,
    sectionAnchor,
    sectionRevision,
    isDashboardActive: sectionKey === 'dashboard',
    isDashboardEmbed,
    navigateToSectionHash
  }
}
