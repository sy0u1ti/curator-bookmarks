import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'node:test'
import { transform } from 'esbuild'

async function handler(file, name, globals) {
  const source = await readFile(file, 'utf8')
  const match = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm').exec(source)
  assert.ok(match, `${name} exists`)
  const tail = source.slice(match.index)
  const end = /\n(?:export )?(?:async )?function \w+\(/.exec(tail)
  const compiled = await transform(`${tail.slice(0, end?.index).replace(/^export /, '')}\nglobalThis.subject = ${name}`, { loader: 'ts' })
  const context = vm.createContext({ Error, Date, console, ...globals })
  vm.runInContext(compiled.code, context)
  return context
}
const noop = () => {}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const optionsFile = 'src/options/options-controller.ts'
const newtabFile = 'src/newtab/newtab-controller.ts'

test('an unrelated New Tab settings save cannot hide an unresolved write failure', async () => {
  const service = deferred()
  let pending = true
  let message = 'Previous save failed'
  const context = await handler(newtabFile, 'saveSettingsWithFeedback', {
    settingsPersistence: { save: () => service.promise, hasPending: () => pending },
    clearSettingsSaveStatus: () => { message = '' },
    setSettingsSaveStatus: (_, text) => { message = text }
  })
  const running = context.subject({ clock: {} })
  assert.equal(message, 'Previous save failed', 'Starting a different save is not recovery')
  service.resolve()
  await running
  assert.equal(message, 'Previous save failed', 'A failed background edit is still pending')
  pending = false
  await context.subject({ background: {} })
  assert.equal(message, '', 'Clear the error only once all pending settings are persisted')
})

test('an obsolete New Tab failure cannot resurrect an error after recovery', async () => {
  let message = ''
  const context = await handler(newtabFile, 'saveSettingsWithFeedback', {
    settingsPersistence: { save: async () => { throw new Error('Old failure') }, hasPending: () => false },
    clearSettingsSaveStatus: () => { message = '' },
    setSettingsSaveStatus: (_, text) => { message = text }
  })
  await assert.rejects(context.subject({ background: {} }), /Old failure/)
  assert.equal(message, '')
})

test('module toggles leave save feedback ownership to the persistence handler', async () => {
  let duplicateErrors = 0
  const context = await handler(newtabFile, 'handleModuleSettingToggle', {
    state: { moduleSettings: { clock: true } }, normalizeNewTabModuleSettings: value => value,
    saveNewTabModuleSettings: async () => { throw new Error('Already handled write failure') },
    setSettingsSaveStatus: () => { duplicateErrors++ },
    syncNewTabModernSettingsControls: noop, scheduleRender: noop, console: { warn: noop }
  })
  context.subject('clock', false)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(duplicateErrors, 0, 'A late secondary catch must not resurrect an obsolete error')
})

for (const fails of [false, true]) {
  for (const featureSwitch of [undefined, 'autoAnalyzeBookmarks']) {
    test(`AI ${featureSwitch || 'provider'} save ${fails ? 'failure' : 'success'} does not replace analysis feedback`, async () => {
      const state = {
        lastError: 'Previous analysis failed', statusMessage: 'Existing result remains available',
        settingsError: '', featureSwitchErrors: {}, fetchingModels: false, testingConnection: false
      }
      const context = await handler(optionsFile, 'saveAiNamingSettingsFromState', {
        aiNamingState: state, aiSettingsSaving: false,
        syncAiNamingSettingsDraftFromState: () => ({ autoAnalyzeBookmarks: false }),
        validateAiNamingSettings: noop, renderAvailabilitySection: noop,
        hydrateAiNamingPermissionState: async () => {},
        saveAiNamingSettings: async () => { if (fails) throw new Error('Provider storage failed') }
      })
      assert.equal(await context.subject({ featureSwitch }), !fails)
      assert.equal(state.lastError, 'Previous analysis failed')
      assert.equal(state.statusMessage, 'Existing result remains available')
      assert.equal(featureSwitch ? state.featureSwitchErrors[featureSwitch] : state.settingsError, fails ? 'Provider storage failed' : '')
      if (featureSwitch) assert.equal(state.settingsError, '')
    })
  }
}

for (const fails of [false, true]) {
  test(`remote parsing ${fails ? 'failure' : 'success'} owns only its own error`, async () => {
    const state = { lastError: 'Analysis failure', statusMessage: 'Analysis result', featureSwitchErrors: {}, settingsDirty: false }
    const settings = { allowRemoteParsing: true }
    const context = await handler(optionsFile, 'handleAiRemoteParserChange', {
      aiNamingState: state, aiNamingManagerState: { settings },
      areAiProviderSettingsLocked: () => false,
      normalizeAiNamingSettings: value => ({ ...value }), syncAiNamingSettingsDraftFromState: () => settings,
      renderAiNamingSection: noop, renderAvailabilitySection: noop,
      hydrateAiNamingPermissionState: async () => {}, hasJinaReaderPermission: async () => true,
      saveAiNamingSettings: async () => { if (fails) throw new Error('Remote parsing save failed') }
    })
    await context.subject(false)
    assert.equal(state.lastError, 'Analysis failure')
    assert.equal(state.statusMessage, 'Analysis result')
    assert.equal(state.featureSwitchErrors.allowRemoteParsing, fails ? 'Remote parsing save failed' : '')
  })
}

test('testing a provider does not discard a previous analysis error or completion', async () => {
  const state = { lastError: 'Analysis failure', statusMessage: 'Analysis result' }
  const context = await handler(optionsFile, 'handleAiConnectivityTest', {
    aiNamingState: state, aiNamingManagerState: { settings: {} },
    areAiProviderSettingsLocked: () => false, syncAiNamingSettingsDraftFromState: () => ({}),
    validateAiNamingSettings: noop, resetAiNamingConnectivityState: noop,
    renderAvailabilitySection: noop, ensureAiNamingProviderPermission: async () => true,
    requestAiNamingConnectivityTest: async () => 'Connected',
    hydrateAiNamingPermissionState: async () => {}, actionFeedback: status => ({ status }),
    aiConnectionFeedback: { status: 'idle' }
  })
  await context.subject()
  assert.equal(state.lastError, 'Analysis failure')
  assert.equal(state.statusMessage, 'Analysis result')
  assert.equal(state.lastConnectivityTestStatus, 'success')
})

test('disabling remote parsing publishes its pending lock before the storage write', async () => {
  const work = deferred()
  const state = { featureSwitchErrors: {} }
  let renderedPending = false
  const context = await handler(optionsFile, 'handleAiRemoteParserChange', {
    aiNamingState: state, aiNamingManagerState: { settings: { allowRemoteParsing: true } },
    areAiProviderSettingsLocked: () => false,
    normalizeAiNamingSettings: value => ({ ...value }), syncAiNamingSettingsDraftFromState: () => ({}),
    renderAiNamingSection: noop,
    renderAvailabilitySection: () => { renderedPending ||= state.pendingFeatureSwitch === 'allowRemoteParsing' },
    hydrateAiNamingPermissionState: async () => {},
    saveAiNamingSettings: () => work.promise
  })
  const running = context.subject(false)
  assert.equal(renderedPending, true)
  work.resolve()
  await running
})

test('background permission hydration cannot masquerade as an authorizing analysis', async () => {
  const state = { requestingPermission: true, running: false, permissionGranted: true }
  const context = await handler(optionsFile, 'getAiNamingBadgeText', {
    aiNamingState: state, availabilityState: { catalogLoading: false },
    getAiNamingReadinessMeta: () => ({ ready: true })
  })
  assert.notEqual(context.subject(), '授权中')
  state.running = true
  assert.equal(context.subject(), '授权中', 'Actual run authorization remains visible')
})

test('external provider permission refresh does not reload the independent feature card', async () => {
  let view
  const context = await handler(optionsFile, 'renderFeatureSettingsControls', {
    managerState: { inboxSettings: {}, inboxSettingsSaving: false },
    aiNamingState: { permissionStateHydrated: false }, availabilityState: { storageLoading: false },
    normalizeInboxSettings: value => value, buildFeatureSettingsView: value => value,
    publishFeatureSettingsControls: value => { view = value }
  })
  context.subject({}, { featureSwitchesLocked: true, featureSwitchInFlight: '' })
  assert.equal(view.loading, false)
  assert.equal(view.permissionsLoading, true)
  assert.equal(view.inboxSaving, false)
})

for (const name of ['saveAvailabilitySettingsFromDraft', 'resetAvailabilitySettings']) {
  test(`${name} owns its feedback without acquiring the unrelated results mutation lock`, async () => {
    let fails = true
    let claims = 0
    const state = { lastError: 'Previous detection failed', settingsStatus: '', settingsError: '', settingsSaving: false }
    const context = await handler(optionsFile, name, {
      availabilityState: state, availabilitySettingsDraftRevision: 1, availabilitySettingsDraft: {},
      isAvailabilitySettingsDisabled: () => state.settingsSaving,
      readAvailabilitySettingsFromDraft: () => ({ concurrency: 2 }),
      getDefaultAvailabilityRunnerUserSettings: () => ({ concurrency: 2 }),
      createAvailabilitySettingsDraft: value => value,
      claimAvailabilityMutationLock: async () => { claims++; return noop },
      setLocalStorage: async () => { if (fails) throw new Error('Settings write failed') },
      STORAGE_KEYS: { availabilitySettings: 'settings' },
      updateAvailabilityRunnerStatus: noop, renderAvailabilitySection: noop
    })
    await context.subject()
    assert.equal(state.lastError, 'Previous detection failed')
    assert.match(state.settingsError, /Settings write failed/)
    assert.equal(state.settingsSaving, false)
    assert.equal(claims, 0)
    fails = false
    await context.subject()
    assert.equal(state.settingsError, '')
    assert.equal(state.lastError, 'Previous detection failed')
  })
}

test('runner setting saves do not lock unrelated result mutations', async () => {
  const state = { settingsSaving: true }
  const context = await handler('src/options/shared-options/utils.ts', 'isInteractionLocked', { availabilityState: state })
  assert.equal(Boolean(context.subject()), false)
  for (const flag of ['deleting', 'retestingSelection', 'stopRequested', 'runSessionActive']) {
    state[flag] = true
    assert.equal(context.subject(), true, `${flag} still protects result mutations`)
    state[flag] = false
  }
})

test('only detection restarts wait for a settings save; result selection actions remain available', async () => {
  const retestLabel = await handler('src/options/sections/availability-actions.ts', 'getAvailabilityRetestLabel', {})
  const context = await handler(optionsFile, 'getAvailabilitySelectionActionsState', {
    availabilityState: { settingsSaving: true },
    getSelectedAvailabilityResults: () => [{ id: 'saved-result', status: 'failed' }],
    getAvailabilityRetestLabel: retestLabel.subject,
    isInteractionLocked: () => false, hasActiveAvailabilityRunSession: () => false
  })
  const view = context.subject()
  assert.equal(view.retestDisabled, true)
  for (const action of ['deleteDisabled', 'moveDisabled', 'ignoreBookmarkDisabled', 'clearDisabled']) {
    assert.equal(view[action], false, action)
  }
})

test('gallery refresh and download feedback cannot clear an unresolved favorite failure', async () => {
  const state = { featuredBackgroundStatus: '', featuredBackgroundStatusTone: 'info' }
  const context = await handler(newtabFile, 'setFeaturedBackgroundStatus', {
    state, featuredBackgroundStatuses: new Map()
  })
  context.subject('favorite:forest', 'Favorite failed', 'error')
  context.subject('refresh', 'Refreshing', 'info')
  context.subject('download', 'Downloading', 'info')
  context.subject('refresh', 'Refreshed', 'success')
  context.subject('download', 'Downloaded', 'success')
  assert.equal(state.featuredBackgroundStatus, 'Favorite failed')
  context.subject('favorite:forest', '')
  assert.equal(state.featuredBackgroundStatus, 'Downloaded')
  context.subject('download', 'Downloading again', 'info')
  context.subject('refresh', 'Another refresh completed', 'success')
  assert.equal(state.featuredBackgroundStatus, 'Downloading again')
})

test('production gallery handlers retain favorite failures across refresh and clear them on retry', async () => {
  const state = { featuredBackgroundFavoriteIds: [], featuredBackgroundRefreshing: false, featuredBackgroundStatus: '' }
  const feedback = await handler(newtabFile, 'setFeaturedBackgroundStatus', { state, featuredBackgroundStatuses: new Map() })
  let failFavorite = true
  const refresh = deferred()
  const globals = {
    state, newTabControllerStarted: true, newTabControllerGeneration: 1,
    featuredBackgroundFavoriteWrites: new Set(), featuredBackgroundPickerRenderKey: '',
    setFeaturedBackgroundStatus: feedback.subject, syncFeaturedBackgroundModalControls: noop,
    STORAGE_KEYS: { newTabFeaturedBackgroundFavorites: 'favorites', newTabFeaturedBackgroundGallery: 'gallery' },
    withLocalStorageTransaction: task => task({}),
    getLocalStorage: async () => ({ favorites: [], gallery: [] }),
    setLocalStorage: async values => { if (failFavorite && values.favorites) throw new Error('Favorite failed') },
    normalizeFeaturedBackgroundFavoriteIds: value => value,
    normalizeFeaturedBackgroundGallery: value => value,
    loadBackgroundGalleryModule: async () => ({}),
    isFeaturedBackgroundPickerOpen: () => false,
    ensureFeaturedBackgroundPermissions: async () => true,
    loadBackgroundGalleryRefreshModule: async () => ({
      fetchFreshFeaturedBackgroundItems: () => refresh.promise,
      mergeFeaturedGalleryRefresh: ({ fetchedItems }) => fetchedItems,
      getFeaturedBackgroundRefreshProviderCount: () => 1
    }),
    fetchJson: noop, getRemoteImageSize: noop, getFeaturedBackgroundDateSeed: () => 'fixture',
    renderFeaturedBackgroundPickerAfterRefresh: async () => {},
    clearFeaturedBackgroundPreviewCache: async () => {},
    getFeaturedBackgroundRefreshErrorMessage: error => error.message
  }
  const favorite = await handler(newtabFile, 'toggleFeaturedBackgroundFavorite', globals)
  const gallery = await handler(newtabFile, 'refreshFeaturedBackgroundGallery', globals)
  const refreshing = gallery.subject()
  await favorite.subject('forest')
  assert.match(state.featuredBackgroundStatus, /Favorite failed/)
  refresh.resolve([{ id: 'forest' }])
  await refreshing
  assert.match(state.featuredBackgroundStatus, /Favorite failed/)
  failFavorite = false
  await favorite.subject('forest')
  assert.doesNotMatch(state.featuredBackgroundStatus, /Favorite failed/)
  assert.deepEqual(Array.from(state.featuredBackgroundFavoriteIds), ['forest'])
})

for (const stale of ['selection', 'session', 'none']) {
  test(`background task failure respects its ${stale === 'none' ? 'current owner' : `old ${stale}`}`, async () => {
    const work = deferred()
    let message = ''
    const context = await handler(newtabFile, 'runBackgroundTask', {
      newTabControllerStarted: true, newTabControllerGeneration: 1, backgroundMediaMutationVersion: 1,
      setBackgroundStatus: text => { message = text }, render: noop,
      console: { warn: noop }
    })
    context.subject(work.promise, 'Background failed')
    if (stale === 'selection') context.backgroundMediaMutationVersion++
    if (stale === 'session') context.newTabControllerGeneration++
    work.reject(new Error('Old media failed'))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(Boolean(message), stale === 'none')
  })
}

test('an old cache-clear completion cannot reapply a replacement wallpaper', async () => {
  const cache = deferred()
  let applies = 0
  const context = await handler(newtabFile, 'applyBackgroundSettingsAfterCacheUpdate', {
    newTabControllerStarted: true, newTabControllerGeneration: 1, backgroundMediaMutationVersion: 1,
    clearBackgroundUrlCache: () => cache.promise, applyBackgroundSettings: async () => { applies++ }
  })
  const running = context.subject(true)
  context.backgroundMediaMutationVersion++
  cache.resolve()
  await running
  assert.equal(applies, 0)
  await context.subject(false)
  assert.equal(applies, 1)
})

test('mask adjustments preserve pending wallpaper work and skip the source pipeline', async () => {
  const previous = { type: 'image', wallpaperDim: 20 }
  const next = { ...previous, wallpaperDim: 60 }
  let snapshot
  let saved
  const context = await handler(newtabFile, 'commitBackgroundSettings', {
    state: { backgroundSettings: previous },
    backgroundSettingsHydrated: true,
    backgroundSettingsMutationVersion: 1,
    backgroundMediaMutationVersion: 7,
    preloadedBackgroundSettings: previous,
    shouldClearBackgroundUrlCache: () => false,
    haveSameWallpaperSource: () => true,
    getEffectiveWallpaperAdjustments: value => value,
    saveWallpaperAdjustmentsSnapshot: value => { snapshot = value },
    dispatchNewtabBackgroundSettingsView: noop,
    createBackgroundSettingsView: () => ({}),
    STORAGE_KEYS: { newTabBackgroundSettings: 'background' },
    saveSettingsWithFeedback: async value => { saved = value },
    console: { warn: noop }
  })
  context.subject(previous, next)
  assert.equal(context.backgroundSettingsMutationVersion, 2)
  assert.equal(context.backgroundMediaMutationVersion, 7)
  assert.equal(snapshot, next)
  assert.equal(saved.background, next)
})

test('mask adjustments do not cancel an in-flight wallpaper cache clear', async () => {
  const cache = deferred()
  let applies = 0
  const context = await handler(newtabFile, 'applyBackgroundSettingsAfterCacheUpdate', {
    newTabControllerStarted: true, newTabControllerGeneration: 1,
    backgroundSettingsMutationVersion: 1, backgroundMediaMutationVersion: 7,
    clearBackgroundUrlCache: () => cache.promise,
    applyBackgroundSettings: async () => { applies++ }
  })
  const running = context.subject(true)
  context.backgroundSettingsMutationVersion++
  cache.resolve()
  await running
  assert.equal(applies, 1)
})

for (const stale of [false, true]) {
  test(`wallpaper URL permission denial ${stale ? 'ignores a replaced URL' : 'remains visible for the current URL'}`, async () => {
    const permission = deferred()
    let message = ''
    const context = await handler(newtabFile, 'handleBackgroundUrlCommit', {
      state: { backgroundSettings: { type: 'urls' } },
      newTabControllerStarted: true, newTabControllerGeneration: 1,
      backgroundSettingsMutationVersion: 1, backgroundMediaMutationVersion: 1,
      getRemoteBackgroundImageUrl: () => 'https://fixture.invalid/wallpaper.png',
      ensureBackgroundImageFetchPermission: () => permission.promise,
      setBackgroundStatus: text => { message = text }, syncBackgroundSettingsControls: noop
    })
    const running = context.subject()
    context.backgroundSettingsMutationVersion++
    if (stale) context.backgroundMediaMutationVersion++
    permission.resolve(false)
    await running
    assert.equal(Boolean(message), !stale)
  })
}

for (const fails of [false, true]) {
  test(`AI content indexing ${fails ? 'failure' : 'success'} cannot replace an index-settings failure`, async () => {
    const state = {
      settings: { enabled: true }, index: { records: {}, updatedAt: 0 },
      statusMessage: 'Index settings failed', aiRunError: 'Earlier bookmark cache failed',
      aiRunSavedCount: 0, aiRunFailedCount: 1
    }
    const context = await handler(optionsFile, 'saveContentSnapshotsForAiPreparedItems', {
      contentSnapshotState: state,
      saveContentSnapshotsFromContexts: async () => {
        if (fails) throw new Error('Current bookmark cache failed')
        return [{ bookmarkId: 'fixture', extractedAt: 1 }]
      },
      normalizeContentSnapshotIndex: value => value, renderContentSnapshotSettings: noop,
      console: { warn: noop }
    })
    await context.subject([{ bookmark: { id: 'fixture', title: 'Fixture' }, pageMetadata: {} }])
    assert.equal(state.statusMessage, 'Index settings failed')
    assert.match(state.aiRunError, fails ? /Current bookmark cache failed/ : /Earlier bookmark cache failed/)
  })
}

test('starting a new analysis resets only its indexing feedback, not unsaved settings feedback', async () => {
  const state = { statusMessage: 'Index settings failed', aiRunError: 'Earlier cache failed' }
  const context = await handler(optionsFile, 'resetAiNamingRunState', { aiNamingState: {}, contentSnapshotState: state })
  context.subject()
  assert.equal(state.statusMessage, 'Index settings failed')
  assert.equal(state.aiRunError, '')
})

test('index settings and content-write failures both remain readable in their shared bounded slot', async () => {
  let view
  const context = await handler(optionsFile, 'renderContentSnapshotSettings', {
    contentSnapshotState: {
      settings: { enabled: true }, index: { records: {} },
      statusMessage: 'Index settings failed', aiRunError: 'Content write failed'
    },
    availabilityState: { storageLoading: false },
    buildContentSnapshotAiRunStatusCopy: () => '',
    publishContentSnapshotControls: value => { view = value }
  })
  context.subject()
  assert.match(view.statusCopy, /Index settings failed/)
  assert.match(view.statusCopy, /Content write failed/)
})
