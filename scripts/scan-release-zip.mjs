#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const inflateRawAsync = promisify(zlib.inflateRaw)
const RESULT_DIR = '.perf-results'
const RELEASE_DIR = 'release'
const REPORT_PATH = path.join(RESULT_DIR, 'release-zip-scan.json')
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.json', '.css'])
const CODE_EXTENSIONS = new Set(['.html', '.js', '.mjs'])
const BINARY_CODE_EXTENSIONS = new Set(['.wasm'])

async function main() {
  await fs.mkdir(RESULT_DIR, { recursive: true })
  const packageJson = await readJson('package.json')
  const version = String(packageJson.version || '')
  const zipPath = path.join(RELEASE_DIR, `curator-bookmarks-${version}.zip`)
  const zipBuffer = await fs.readFile(zipPath)
  const entries = await readZipEntries(zipBuffer)
  const scannedEntries = []
  const issues = []

  for (const entry of entries) {
    const ext = path.extname(entry.name).toLowerCase()
    const isText = TEXT_EXTENSIONS.has(ext)
    const isCode = CODE_EXTENSIONS.has(ext)
    const isHtml = ext === '.html'
    const isBinaryCode = BINARY_CODE_EXTENSIONS.has(ext)
    if (isBinaryCode) {
      issues.push({
        entry: entry.name,
        kind: 'wasm',
        detail: 'Wasm is not allowed in the release package without a separate remote-code review.'
      })
    }
    if (!isText) {
      scannedEntries.push({ path: entry.name, sizeBytes: entry.data.length, scanned: false })
      continue
    }

    const text = entry.data.toString('utf8')
    const entryIssues = scanTextEntry(entry.name, text, { isCode, isHtml })
    issues.push(...entryIssues)
    scannedEntries.push({
      path: entry.name,
      sizeBytes: entry.data.length,
      scanned: true,
      issueCount: entryIssues.length
    })
  }

  const report = {
    generatedAt: new Date().toISOString(),
    zipPath: zipPath.split(path.sep).join('/'),
    entryCount: entries.length,
    scannedTextEntries: scannedEntries.filter((entry) => entry.scanned).length,
    ok: issues.length === 0,
    checks: [
      {
        id: 'no-dynamic-code-execution',
        ok: !issues.some((issue) => issue.kind === 'dynamic-code'),
        detail: 'No eval, new Function, document.write, srcdoc, javascript: URLs, or string timers in packaged HTML/JS.'
      },
      {
        id: 'no-remote-script-execution',
        ok: !issues.some((issue) => issue.kind === 'remote-script'),
        detail: 'No remote script/modulepreload/preload imports in packaged HTML/JS.'
      },
      {
        id: 'no-wasm',
        ok: !issues.some((issue) => issue.kind === 'wasm'),
        detail: 'No Wasm payloads in the release package.'
      }
    ],
    issues,
    entries: scannedEntries
  }

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`release zip scan written to ${REPORT_PATH}`)
  if (!report.ok) {
    console.error('release zip remote-code scan failed:')
    for (const issue of issues) {
      console.error(`- ${issue.entry}: ${issue.detail}`)
    }
    process.exit(1)
  }
  console.log('release zip remote-code scan ok')
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

function scanTextEntry(entryName, text, { isCode, isHtml }) {
  const issues = []
  if (!isCode) {
    return issues
  }
  const patterns = [
    { kind: 'dynamic-code', pattern: /\beval\s*\(/, detail: 'eval() found' },
    { kind: 'dynamic-code', pattern: /\bnew\s+Function\s*\(/, detail: 'new Function() found' },
    { kind: 'dynamic-code', pattern: /\bdocument\.write\s*\(/, detail: 'document.write() found' },
    { kind: 'dynamic-code', pattern: /\bsrcdoc\s*=/, detail: 'srcdoc found' },
    { kind: 'dynamic-code', pattern: /\bset(?:Timeout|Interval)\s*\(\s*['"`]/, detail: 'string timer found' },
    { kind: 'remote-script', pattern: /<script\b[^>]*\bsrc=["']https?:\/\//i, detail: 'remote script src found' },
    { kind: 'remote-script', pattern: /<link\b[^>]*\brel=["'](?:modulepreload|preload)["'][^>]*\bhref=["']https?:\/\//i, detail: 'remote preload link found' },
    { kind: 'remote-script', pattern: /\bimport\s*\(\s*['"]https?:\/\//, detail: 'remote dynamic import found' },
    { kind: 'remote-script', pattern: /\bimport\s+[^'"]*['"]https?:\/\//, detail: 'remote static import found' }
  ]
  if (isHtml) {
    patterns.push({
      kind: 'dynamic-code',
      pattern: /\b(?:href|src)\s*=\s*["']?\s*javascript\s*:/i,
      detail: 'javascript: URL found'
    })
  }
  for (const check of patterns) {
    if (check.pattern.test(text)) {
      issues.push({
        entry: entryName,
        kind: check.kind,
        detail: check.detail
      })
    }
  }
  return issues
}

async function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer)
  const entryCount = buffer.readUInt16LE(eocdOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16)
  const entries = []
  let cursor = centralDirectoryOffset
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Invalid zip central directory header.')
    }
    const compressionMethod = buffer.readUInt16LE(cursor + 10)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const fileNameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString('utf8')

    const data = await readLocalEntryData(buffer, {
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    })
    entries.push({ name, data })
    cursor += 46 + fileNameLength + extraLength + commentLength
  }
  return entries
}

async function readLocalEntryData(buffer, entry) {
  const offset = entry.localHeaderOffset
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`Invalid zip local header for ${entry.name}.`)
  }
  const fileNameLength = buffer.readUInt16LE(offset + 26)
  const extraLength = buffer.readUInt16LE(offset + 28)
  const dataStart = offset + 30 + fileNameLength + extraLength
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize)
  if (entry.compressionMethod === 0) {
    return compressed
  }
  if (entry.compressionMethod !== 8) {
    throw new Error(`Unsupported zip compression method ${entry.compressionMethod} for ${entry.name}.`)
  }
  const inflated = await inflateRawAsync(compressed)
  if (inflated.length !== entry.uncompressedSize) {
    throw new Error(`Zip size mismatch for ${entry.name}.`)
  }
  return inflated
}

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 0xffff - 22)
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset
    }
  }
  throw new Error('Zip end of central directory not found.')
}

await main()
