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
  const [sectionState, setSectionState] = useState(() => ({
    sectionKey: readOptionsSectionKey(),
    sectionAnchor: readOptionsSectionAnchor(),
    sectionRevision: 0
  }))
  const isDashboardEmbed = useMemo(() => isOptionsDashboardEmbedMode(), [])

  useEffect(() => {
    const syncSection = () => {
      setSectionState((current) => ({
        sectionKey: readOptionsSectionKey(),
        sectionAnchor: readOptionsSectionAnchor(),
        sectionRevision: current.sectionRevision + 1
      }))
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
    document.title = `${SECTION_META[sectionState.sectionKey].title} · Curator Bookmark`
  }, [sectionState.sectionKey])

  const navigateToSectionHash = useCallback((hash: string) => {
    navigateToOptionsSectionHash(hash)
  }, [])

  return {
    sectionKey: sectionState.sectionKey,
    sectionAnchor: sectionState.sectionAnchor,
    sectionRevision: sectionState.sectionRevision,
    isDashboardActive: sectionState.sectionKey === 'dashboard',
    isDashboardEmbed,
    navigateToSectionHash
  }
}
