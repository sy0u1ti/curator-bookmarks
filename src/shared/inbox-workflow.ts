export type InboxWorkflowMode = 'capture' | 'move' | 'tags' | 'keep'

export interface InboxWorkflowSettings {
  autoAnalyzeEnabled?: boolean
  autoMoveToRecommendedFolder: boolean
  tagOnlyNoAutoMove: boolean
}

export function getInboxWorkflowMode(settings: InboxWorkflowSettings): InboxWorkflowMode {
  if (settings.autoAnalyzeEnabled === false) return 'capture'
  return settings.tagOnlyNoAutoMove ? 'tags' : settings.autoMoveToRecommendedFolder ? 'move' : 'keep'
}

export function getInboxWorkflowSettings(mode: InboxWorkflowMode): InboxWorkflowSettings {
  return { autoAnalyzeEnabled: mode !== 'capture', autoMoveToRecommendedFolder: mode === 'move', tagOnlyNoAutoMove: mode === 'tags' }
}

export function shouldAnalyzeInbox(settings: InboxWorkflowSettings): boolean {
  return settings.autoAnalyzeEnabled !== false
}
