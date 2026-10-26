import assert from 'node:assert/strict'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: `
      export * from './src/popup/popup-row-presentation'
      export * from './src/newtab/favicon-contrast'
      export * from './src/newtab/icon-settings'
      export * from './src/options/sections/feature-settings-view'
      export { splitHighlightText } from './src/ui/base/HighlightedText'
      export { buildLightPopupSearchIndex } from './src/popup/search-index'
      export { extractBookmarkData } from './src/shared/bookmark-tree'
      export { enrichPinyinTokensCooperatively } from './src/shared/search/pinyin'
      export { searchBookmarks } from './src/popup/search'
    `,
    resolveDir: process.cwd()
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false
})
const subject = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)

assert.equal(subject.POPUP_BOOKMARK_ROW_HEIGHT, 60)
assert.equal(subject.getPopupBookmarkDomain('https://www.example.com/a/long/path?q=value', ''), 'example.com')
assert.equal(subject.getPopupBookmarkDomain('file:///C:/notes.html', 'C:/notes.html'), 'C:/notes.html')
assert.equal(subject.getPopupFolderLabel('收藏夹栏 > 开发 > 前端'), '前端')
assert.equal(subject.getPopupFolderLabel('收藏夹栏 / Design/UX'), 'Design/UX')
const card = { title: '卡网订阅比价 | PriceAI', url: 'https://shop-0.example/deep/path', path: '收藏夹栏 / 市场 / 卡网', parentId: 'cards' }
for (const query of ['kaw', 'kawang', 'kw', '卡网']) {
  const title = subject.buildPopupSearchRowPresentation({ ...card, query, matchReasons: [`命中：标题拼音 ${query}`] })
  assert.deepEqual(title.reasonTokens, [], `${query}: visible title needs no badge`)
  assert.deepEqual(subject.splitHighlightText(card.title, title.titleTerms).filter(part => part.highlight).map(part => part.text), ['卡网'])
  assert.equal(title.rowHeight, 60)
  const folder = subject.buildPopupSearchRowPresentation({ ...card, title: '鹰鹰小铺', query, matchReasons: [`命中：文件夹拼音 ${query}`] })
  assert.deepEqual(folder.reasonTokens, [], `${query}: visible folder needs no badge`)
  assert.deepEqual(folder.folderTerms, ['卡网'])
  assert.equal(folder.rowHeight, 60)
}
const scoped = subject.buildPopupSearchRowPresentation({ ...card, query: 'PriceAI', scopeFolderId: 'cards', matchReasons: ['命中：标题 priceai'] })
assert.equal(scoped.folder, '')
assert.deepEqual(subject.splitHighlightText(card.title, scoped.titleTerms).filter(part => part.highlight).map(part => part.text), ['PriceAI'])
const hiddenFields = subject.buildPopupSearchRowPresentation({ ...card, query: '市场 deep', matchReasons: ['命中：文件夹 市场', '命中：网址 deep', '命中：网页内容 市场'] })
assert.deepEqual(hiddenFields.reasonTokens, ['上级目录命中', '网址命中', '正文命中'])
assert.equal(hiddenFields.rowHeight, 68)
const tagged = subject.buildPopupSearchRowPresentation({ ...card, query: '界面', matchReasons: ['命中：标签 界面', '命中：主题 界面'] })
assert.deepEqual(tagged.reasonTokens, ['标签命中'], 'tags and topics explain the same hidden field once')

const tree = { id: '0', title: '', children: [{ id: '1', title: '收藏夹栏', children: [{ id: 'cards', title: '卡网', children: [
  { id: 'card', ...card },
  { id: 'editor', title: 'Visual Studio Code', url: 'https://code.visualstudio.com/', parentId: 'cards' },
  { id: 'react', title: 'React Documentation', url: 'https://react.dev/learn', parentId: 'cards' }
] }] }] }
const indexed = subject.buildLightPopupSearchIndex({ bookmarks: subject.extractBookmarkData(tree).bookmarks, tagIndex: null })
await subject.enrichPinyinTokensCooperatively(indexed)
for (const [query, id] of [['卡网比价', 'card'], ['比价卡网', 'card'], ['kawagn', 'card'], ['vscode', 'editor'], ['raect doc', 'react']]) {
  const result = subject.searchBookmarks(query, indexed)[0]
  assert.equal(result.id, id)
  const row = subject.buildPopupSearchRowPresentation({ ...result, query })
  assert.deepEqual(row.reasonTokens, [], `${query}: recovered visible text also needs no badge`)
  assert.ok(subject.splitHighlightText(result.title, row.titleTerms).some(part => part.highlight), `${query}: show the recovered title match`)
}

function iconPixels(color, coverage = 0.5) {
  const pixels = new Uint8ClampedArray(20 * 20 * 4)
  for (let index = 0; index < Math.floor(20 * 20 * coverage); index++) {
    pixels.set([...color, 255], index * 4)
  }
  return pixels
}

assert.equal(subject.classifyFaviconContrast(iconPixels([12, 12, 14])), 'light-backdrop')
assert.equal(subject.classifyFaviconContrast(iconPixels([245, 245, 247])), 'original')
assert.equal(subject.classifyFaviconContrast(iconPixels([80, 188, 168])), 'original')
assert.equal(subject.classifyFaviconContrast(iconPixels([12, 12, 14], 1)), 'original', 'opaque artwork needs no plate')
assert.equal(subject.classifyFaviconContrast(iconPixels([0, 0, 0], 0)), 'original', 'empty images must not create blank light tiles')

globalThis.document = { createElement: () => ({ getContext: () => ({
  drawImage() {},
  getImageData() { throw new DOMException('Cross-origin pixels', 'SecurityError') }
}) }) }
assert.equal(subject.readFaviconContrast({ complete: true, naturalWidth: 32, naturalHeight: 32 }, 'https://remote.example/favicon.ico'), 'neutral-backdrop', 'unreadable pixels need a usable plate, not a false original classification')
assert.equal(subject.getCachedFaviconContrast('https://remote.example/favicon.ico'), 'neutral-backdrop')
delete globalThis.document

const input = {
  settings: { autoAnalyzeBookmarks: false, allowRemoteParsing: false },
  inboxSettings: {},
  inboxStatus: '',
  loading: false,
  remoteParserGranted: false,
  locked: false,
  pending: '',
  testingConnection: false
}
assert.ok(subject.buildFeatureSettingsView(input).switches.every(item => !item.status), 'off switches do not need repeated badges')
const needsPermission = subject.buildFeatureSettingsView({ ...input, settings: { allowRemoteParsing: true } }).switches[1]
assert.equal(needsPermission.status, '待授权')
assert.match(needsPermission.description, /第三方服务会收到目标网址/)
assert.equal(subject.buildFeatureSettingsView({ ...input, pending: 'autoAnalyzeBookmarks' }).switches[0].status, '保存中…')

const custom = { ...subject.DEFAULT_ICON_SETTINGS, titleLines: 2, tileWidth: 210, iconShellSize: 34, columns: 6 }
const normalized = subject.normalizeIconSettings(custom)
for (const field of ['titleLines', 'tileWidth', 'iconShellSize', 'columns']) {
  assert.equal(normalized[field], custom[field], `existing custom ${field} must survive normalization`)
}
assert.equal(subject.DEFAULT_ICON_SETTINGS.titleLines, 1, 'do not overwrite the established default or user preference')

// Each fact has one owner on screen; helper copy the layout already explains stays out.
const { readFile } = await import('node:fs/promises')
const source = async file => readFile(new URL(`./${file}`, import.meta.url), 'utf8')
const drawer = await source('newtab/components/SettingsDrawer.tsx')
const moduleRow = drawer.slice(drawer.indexOf('function ModuleSettingRow'), drawer.indexOf('function handleBackgroundFileChange'))
assert.match(moduleRow, /settingRowClassName\(SETTINGS_SWITCH_ROW_CLASS\)/, 'module switches share the switch-row layout at narrow widths')
assert.doesNotMatch(drawer, /可在下方精细调整|透过玻璃看纹理/)
const popupController = await source('popup/popup-controller.ts')
const caption = popupController.slice(popupController.indexOf('function getViewCaptionText'), popupController.indexOf('function getNaturalSearchPendingCaption'))
assert.doesNotMatch(caption, /searchResults\.length|getCurrentTreeRoot/, 'the pane header owns result counts and the folder title')
assert.doesNotMatch(await source('popup/components/PopupWorkspaceTools.tsx'), /左侧|右侧|中间/, 'help must not describe a fixed spatial layout')
assert.doesNotMatch(await source('popup/components/PopupModalsHost.tsx'), /设置名称与保存位置|选择目标文件夹/)
const metrics = await source('options/components/AvailabilityDecisionMetrics.tsx')
assert.doesNotMatch(metrics, /'progress'|'scope'/, 'progress and scope are owned by the progress row and scope picker')
const optionsController = await source('options/options-controller.ts')
assert.doesNotMatch(optionsController, /配置已保存，可继续获取模型或测试连接/)
assert.match(optionsController, /saveStatusText: aiSettingsSaving \? '正在保存' : ''/, 'steady AI config state lives only in the header badge')
assert.doesNotMatch(await source('options/components/ScopePickerTrigger.tsx'), /state\.copy/, 'the picker label already names the current scope')
console.log('Interface refinement logic tests passed.')
