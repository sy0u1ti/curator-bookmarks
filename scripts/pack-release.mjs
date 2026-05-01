import fs from 'node:fs/promises'
import path from 'node:path'
import { deflateRawSync } from 'node:zlib'

const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'))
const version = packageJson.version
const distDir = path.resolve('dist')
const releaseDir = path.resolve('release')
const outputPath = path.join(releaseDir, `curator-bookmarks-${version}.zip`)
const crcTable = createCrcTable()

await assertDirectory(distDir)
await fs.mkdir(releaseDir, { recursive: true })

const entries = await collectFiles(distDir)
if (!entries.length) {
  throw new Error('dist is empty. Run npm run build first.')
}

const archive = buildZip(entries)
await fs.writeFile(outputPath, archive)

console.log(`Packed ${entries.length} files -> ${path.relative(process.cwd(), outputPath)}`)

async function assertDirectory(directory) {
  const stat = await fs.stat(directory).catch(() => null)
  if (!stat?.isDirectory()) {
    throw new Error(`${path.relative(process.cwd(), directory)} does not exist. Run npm run build first.`)
  }
}

async function collectFiles(rootDir) {
  const files = []

  async function walk(directory) {
    const items = await fs.readdir(directory, { withFileTypes: true })
    for (const item of items) {
      const absolutePath = path.join(directory, item.name)
      if (item.isDirectory()) {
        await walk(absolutePath)
        continue
      }

      if (!item.isFile()) {
        continue
      }

      const relativePath = path
        .relative(rootDir, absolutePath)
        .split(path.sep)
        .join('/')
      if (relativePath.endsWith('.map')) {
        continue
      }
      files.push({
        path: relativePath,
        data: await fs.readFile(absolutePath),
        mtime: (await fs.stat(absolutePath)).mtime
      })
    }
  }

  await walk(rootDir)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function buildZip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8')
    const data = entry.data
    const compressedData = deflateRawSync(data, { level: 9 })
    const crc = crc32(data)
    const { time, date } = toDosDateTime(entry.mtime)
    const localHeader = Buffer.alloc(30)

    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0x0800, 6)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt16LE(time, 10)
    localHeader.writeUInt16LE(date, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressedData.length, 18)
    localHeader.writeUInt32LE(data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, name, compressedData)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(time, 12)
    centralHeader.writeUInt16LE(date, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(compressedData.length, 20)
    centralHeader.writeUInt32LE(data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    centralParts.push(centralHeader, name)
    offset += localHeader.length + name.length + compressedData.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, end])
}

function toDosDateTime(dateValue) {
  const date = new Date(dateValue)
  const year = Math.max(date.getFullYear(), 1980)
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate()
  }
}

function createCrcTable() {
  const table = new Uint32Array(256)
  for (let index = 0; index < table.length; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }

  return table
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
