#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const OUTPUT_DIR = '.perf-fixtures'
const SIZES = [
  { label: '1k', count: 1000 },
  { label: '10k', count: 10000 },
  { label: '50k', count: 50000 }
]

const FIXED_SEED = 0xc0de1234
const FOLDER_TITLES = [
  '工作', '学习', '工具', '开发', '设计', 'AI', '阅读', '影音', '社交', '购物',
  '旅行', '理财', '医疗', '生活', '游戏', '档案', '草稿', '收藏', '资料', '研究'
]
const SUBFOLDER_TITLES = [
  '前端', '后端', '架构', '机器学习', '数据', '论文', '教程', '博客', '工具集', '案例',
  '速查', '灵感', '播客', '视频', '订阅', '客户', '产品', '运营', '日常', '其他'
]
const TITLE_TEMPLATES = [
  '{a} {b} 学习指南',
  '{a}：{b} 完全教程',
  '{b} {a} 实战手册',
  'How to use {b} for {a}',
  '{b} weekly digest',
  '{a} 周刊 #{n}',
  '{b} reference',
  '深入理解 {a} 与 {b}',
  '{a} cookbook',
  '{a} bookmark cluster {n}'
]
const WORDS_A = [
  '前端', '后端', '系统', '设计', '架构', '机器学习', '深度学习', '检索', '搜索', '索引',
  '存储', '调度', '渲染', '性能', '可观测', '调试', '编译器', '运行时', '协议', '密码学'
]
const WORDS_B = [
  'React', 'Vue', 'Svelte', 'TypeScript', 'Python', 'Go', 'Rust', 'Node', 'Deno', 'Vite',
  'Bun', 'Webpack', 'Rollup', 'Tailwind', 'Postgres', 'Redis', 'Kafka', 'gRPC', 'Linux', 'Docker'
]
const TAG_POOL = [
  '前端', '架构', 'AI', '搜索', '工具', '论文', '教程', '案例', '速查', '灵感',
  'TypeScript', 'Rust', '性能', '可观测', '设计'
]
const TOPIC_POOL = ['前端开发', '后端开发', '基础设施', 'AI/ML', '数据工程', '产品设计', '工具使用']
const CONTENT_TYPES = ['博客', '文档', '论文', '工具', '产品', '教程', '视频', '速查']

function createPrng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rand, pool) {
  return pool[Math.floor(rand() * pool.length)]
}

function buildFolders(rand) {
  const folders = []
  let idCounter = 1
  for (const title of FOLDER_TITLES) {
    const id = `folder-${idCounter++}`
    folders.push({
      id,
      title,
      path: title,
      normalizedTitle: title.toLowerCase(),
      normalizedPath: title.toLowerCase(),
      depth: 1,
      folderCount: 0,
      bookmarkCount: 0
    })
    const subCount = 2 + Math.floor(rand() * 3)
    for (let i = 0; i < subCount; i++) {
      const sub = SUBFOLDER_TITLES[(idCounter + i) % SUBFOLDER_TITLES.length]
      const subId = `folder-${idCounter++}`
      const subPath = `${title} / ${sub}`
      folders.push({
        id: subId,
        title: sub,
        path: subPath,
        normalizedTitle: sub.toLowerCase(),
        normalizedPath: subPath.toLowerCase(),
        depth: 2,
        folderCount: 0,
        bookmarkCount: 0
      })
    }
  }
  return folders
}

function buildBookmark(index, rand, folders) {
  const folder = folders[Math.floor(rand() * folders.length)]
  const wordA = pick(rand, WORDS_A)
  const wordB = pick(rand, WORDS_B)
  const tmpl = pick(rand, TITLE_TEMPLATES)
  const title = tmpl
    .replace('{a}', wordA)
    .replace('{b}', wordB)
    .replace('{n}', String(index))
  const domainSeed = index % 500
  const domain = `example${domainSeed}.com`
  const url = `https://${domain}/article/${index}/${wordB.toLowerCase()}-${wordA}`
  const dateAdded = 1_700_000_000_000 + index * 60_000

  return {
    id: `bk-${index}`,
    title,
    url,
    displayUrl: url,
    normalizedTitle: title.toLowerCase(),
    normalizedUrl: url,
    duplicateKey: url,
    domain,
    path: folder.path,
    ancestorIds: [folder.id],
    parentId: folder.id,
    index,
    dateAdded
  }
}

function buildTagRecord(bookmark, rand, generatedAt) {
  const topics = []
  const tags = []
  const aliases = []
  const topicCount = 1 + Math.floor(rand() * 3)
  const tagCount = 2 + Math.floor(rand() * 4)
  const aliasCount = Math.floor(rand() * 2)
  for (let i = 0; i < topicCount; i++) {
    topics.push(pick(rand, TOPIC_POOL))
  }
  for (let i = 0; i < tagCount; i++) {
    tags.push(pick(rand, TAG_POOL))
  }
  for (let i = 0; i < aliasCount; i++) {
    aliases.push(pick(rand, WORDS_B))
  }
  return {
    schemaVersion: 1,
    bookmarkId: bookmark.id,
    url: bookmark.url,
    normalizedUrl: bookmark.url,
    duplicateKey: bookmark.url,
    title: bookmark.title,
    path: bookmark.path,
    summary: `${bookmark.title} 的简要总结，包含 ${pick(rand, WORDS_A)} 与 ${pick(rand, WORDS_B)} 的相关内容。`,
    contentType: pick(rand, CONTENT_TYPES),
    topics: [...new Set(topics)],
    tags: [...new Set(tags)],
    aliases: [...new Set(aliases)],
    confidence: Math.round(rand() * 100) / 100,
    source: 'auto_analyze',
    model: 'fixture-model',
    extraction: { status: 'ok', source: 'fixture', warnings: [] },
    generatedAt,
    updatedAt: generatedAt
  }
}

function buildSnapshotRecord(bookmark, rand, capturedAt) {
  const wordA = pick(rand, WORDS_A)
  const wordB = pick(rand, WORDS_B)
  const summary = `${bookmark.title} 网页快照摘要，覆盖 ${wordA}、${wordB} 等关键概念。`
  return {
    schemaVersion: 1,
    bookmarkId: bookmark.id,
    url: bookmark.url,
    title: bookmark.title,
    capturedAt,
    title_text: bookmark.title,
    summary,
    headings: [`${wordA} 概览`, `${wordB} 用法`],
    keywords: [wordA, wordB],
    contentType: 'text/html',
    extractionStatus: 'ok',
    fullTextStorage: 'none'
  }
}

async function generateFixture(label, count, baseRand) {
  const rand = createPrng(FIXED_SEED ^ count)
  void baseRand
  const folders = buildFolders(rand)
  const bookmarks = []
  for (let i = 0; i < count; i++) {
    bookmarks.push(buildBookmark(i, rand, folders))
  }

  const tagCutoff = Math.floor(count * 0.3)
  const snapshotCutoff = Math.floor(count * 0.3)
  const generatedAt = 1_700_000_000_000

  const tagRecords = {}
  for (let i = 0; i < tagCutoff; i++) {
    const bookmark = bookmarks[i]
    tagRecords[bookmark.id] = buildTagRecord(bookmark, rand, generatedAt + i * 1000)
  }

  const snapshotRecords = {}
  for (let i = 0; i < snapshotCutoff; i++) {
    const bookmark = bookmarks[i]
    snapshotRecords[bookmark.id] = buildSnapshotRecord(bookmark, rand, generatedAt + i * 1000)
  }

  const fixture = {
    label,
    count,
    folders,
    bookmarks,
    tagIndex: {
      version: 1,
      updatedAt: generatedAt,
      records: tagRecords
    },
    snapshotIndex: {
      version: 1,
      updatedAt: generatedAt,
      records: snapshotRecords
    }
  }

  const filename = path.join(OUTPUT_DIR, `bookmarks-${label}.json`)
  await fs.writeFile(filename, JSON.stringify(fixture))
  return { filename, count, folders: folders.length, tags: tagCutoff, snapshots: snapshotCutoff }
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const summary = []
  for (const { label, count } of SIZES) {
    const result = await generateFixture(label, count)
    summary.push(result)
    console.log(`generated ${result.filename} bookmarks=${result.count} folders=${result.folders} tags=${result.tags} snapshots=${result.snapshots}`)
  }
  const summaryPath = path.join(OUTPUT_DIR, 'summary.json')
  await fs.writeFile(summaryPath, JSON.stringify({ generatedAt: Date.now(), fixtures: summary }, null, 2))
  console.log(`fixture summary written to ${summaryPath}`)
}

await main()
