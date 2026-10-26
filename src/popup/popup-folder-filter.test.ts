import {
  collectFolderFilterVisibility,
  folderFilterMatchesTarget,
  folderFilterUsesPinyin,
  normalizeFolderFilterQuery
} from './popup-folder-filter.js'
import { buildPinyinTokensSync } from '../shared/search/pinyin.js'

interface TestNode {
  children?: TestNode[]
  id: string
  title: string
  url?: string
}

function run(): void {
  testQueryNormalization()
  testPinyinDetection()
  testTitleAndPathMatching()
  testPinyinMatching()
  testVisibilityKeepsAncestors()
  testVisibilityIgnoresBookmarkLeaves()
}

function testQueryNormalization(): void {
  assert(
    normalizeFolderFilterQuery('  AI   API  ') === 'ai api',
    'queries must be lowercased and collapsed before matching'
  )
  assert(normalizeFolderFilterQuery(null) === '', 'missing queries must normalize to empty')
}

function testPinyinDetection(): void {
  assert(folderFilterUsesPinyin('sc'), 'two ASCII letters should be treated as pinyin initials')
  assert(folderFilterUsesPinyin('shichang'), 'ASCII syllables should be treated as pinyin')
  assert(!folderFilterUsesPinyin('市场'), 'Chinese queries must not wait for the pinyin module')
  assert(!folderFilterUsesPinyin('a'), 'a single letter is too short to be pinyin')
  assert(folderFilterUsesPinyin('ai api'), 'space-separated query terms can require pinyin')
}

function testTitleAndPathMatching(): void {
  const target = { normalizedPath: '书签栏 > 市场 > ai api', normalizedTitle: 'ai api' }
  assert(folderFilterMatchesTarget(target, 'AI'), 'matching must ignore case')
  assert(folderFilterMatchesTarget(target, '市场'), 'a folder must match through its path')
  assert(folderFilterMatchesTarget(target, 'api'), 'substring matches must succeed')
  assert(!folderFilterMatchesTarget(target, '存储'), 'unrelated queries must not match')
  assert(!folderFilterMatchesTarget(target, ''), 'an empty query must not match anything')
  assert(
    !folderFilterMatchesTarget(target, 'sc', { full: [], initials: [] }),
    'without tokens a query must not fall back to a partial match'
  )
}

function testPinyinMatching(): void {
  const target = { normalizedPath: '书签栏 > 市场', normalizedTitle: '市场' }
  const tokens = { full: ['shichang'], initials: ['sc'] }
  assert(folderFilterMatchesTarget(target, 'sc', tokens), 'initials must match')
  assert(folderFilterMatchesTarget(target, 'shichang', tokens), 'full syllables must match')
  assert(folderFilterMatchesTarget(target, 'shic', tokens), 'full syllables must allow prefixes')
  assert(!folderFilterMatchesTarget(target, 'cs', tokens), 'initials must match from the start only')
  const material = { normalizedPath: '书签栏 > 素材', normalizedTitle: '素材' }
  const materialTokens = buildPinyinTokensSync(['素材'])
  assert(!folderFilterMatchesTarget(material, 'ai', materialTokens), 'folder filtering must not match ai inside cai')
  assert(folderFilterMatchesTarget(material, 'cai', materialTokens), 'folder filtering can begin at a later syllable')
  assert(folderFilterMatchesTarget(material, 'suc', materialTokens), 'an unfinished final syllable remains searchable')
}

function testVisibilityKeepsAncestors(): void {
  const tree: TestNode = {
    id: 'root',
    title: '书签栏',
    children: [
      {
        id: 'market',
        title: '市场',
        children: [{ id: 'ai', title: 'AI API', children: [] }]
      },
      { id: 'stores', title: '店', children: [] }
    ]
  }

  const { matched, visible } = collectFolderFilterVisibility(
    tree,
    (node) => node.title.toLowerCase().includes('api')
  )
  assert(matched.has('ai'), 'the matching folder must be reported as a direct match')
  assert(!matched.has('market'), 'an ancestor must not be reported as a direct match')
  assert(visible.has('ai') && visible.has('market'), 'ancestors of a match must stay visible')
  assert(!visible.has('stores'), 'unrelated branches must be removed')
  assert(visible.has('root'), 'the root stays visible while it leads to a match')
  assert(!matched.has('root'), 'the root must not be reported as a direct match')
}

function testVisibilityIgnoresBookmarkLeaves(): void {
  const tree: TestNode = {
    id: 'root',
    title: '书签栏',
    children: [
      {
        id: 'market',
        title: '市场',
        children: [
          { id: 'bookmark', title: 'api.example.com', url: 'https://api.example.com/' }
        ]
      }
    ]
  }

  const { matched, visible } = collectFolderFilterVisibility(
    tree,
    (node) => node.title.toLowerCase().includes('api')
  )
  assert(!matched.has('bookmark'), 'bookmarks must never be treated as folders')
  assert(!visible.has('market'), 'a bookmark title must not keep its parent folder visible')
}

function assert(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message)
  }
}

run()
console.log('Popup folder filter tests passed.')
