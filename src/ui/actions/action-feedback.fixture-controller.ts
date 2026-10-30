// The browser fixture replaces only I/O dispatch, not the production UI.
export const fixtureActions: Record<string, (detail: any) => void> = {}
export const handleAiProviderSettingsAction = (detail: any) => fixtureActions.ai?.(detail)
export const handleBackupAction = (detail: any) => fixtureActions.backup?.(detail)
export const handleOptionsModalAction = (detail: any) => fixtureActions.modal?.(detail)
export const handleFolderPickerAction = () => {}
